import express from 'express';
import cors from 'cors';
import { BrowserWindow, app } from 'electron';
import db from './database';
import { getLocalIp, logger } from './logger';
import path from 'path';
import fs from 'fs';

const server = express();
const PORT = 3000;

server.use(cors());
server.use(express.json());

// === SERVIR ARCHIVOS ESTÁTICOS (SMART TV WIFI) ===
const distPath = app.isPackaged
  ? path.join(process.resourcesPath, 'dist')
  : path.join(__dirname, '../../dist');

server.use(express.static(distPath));

// Middleware: Loguear cada request HTTP entrante
server.use((req, _res, next) => {
  logger.info(`HTTP ${req.method} ${req.path} desde ${req.ip}`);
  next();
});

// CORRECCIÓN 1: _req (Evita error de linter)
server.get('/', (_req, res) => {
  res.redirect('/#/display');
});

let adminWin: BrowserWindow | null = null;
let displayWin: BrowserWindow | null = null;

// === HEALTH CHECK ENDPOINT ===
// Endpoint ligero para verificar que el servidor está activo
// Usado por: app móvil, TV, diagnósticos
const startTime = Date.now();

server.get('/api/health', (_req, res) => {
  const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);
  res.json({
    ok: true,
    app: 'NextCall Enterprise',
    ip: getLocalIp(),
    port: PORT,
    uptime: uptimeSeconds,
    timestamp: new Date().toISOString()
  });
});

// === CONFIG ENDPOINT (Para navegadores/Smart TV) ===
// Devuelve configuración de personalización + historial para displays HTTP
server.get('/api/config', (_req, res) => {
  try {
    const settingsRows = db.prepare('SELECT * FROM settings').all() as { key: string, value: string }[];
    const config = settingsRows.reduce((acc: Record<string, string>, curr) => ({ ...acc, [curr.key]: curr.value }), {});
    const history = db.prepare("SELECT * FROM turns WHERE status = 'completed' ORDER BY id DESC LIMIT 10").all();
    res.json({ config, history });
  } catch (e) {
    logger.error(`Error en GET /api/config: ${e}`);
    res.status(500).json({ error: 'Config Error' });
  }
});

export const startServer = (mainWindow: BrowserWindow, secondWindow?: BrowserWindow) => {
  adminWin = mainWindow;
  if (secondWindow) displayWin = secondWindow;

  const myIp = getLocalIp();
  logger.info(`📡 SERVIDOR ACTIVO EN: http://${myIp}:${PORT}`);

  const httpServer = server.listen(PORT, '0.0.0.0', () => {
    logger.info(`✅ API escuchando en puerto ${PORT} (bind: 0.0.0.0)`);
  });

  // Manejo de errores del servidor
  httpServer.on('error', (err: NodeJS.ErrnoException) => {
    logger.error(`❌ NO SE PUDO INICIAR EL SERVIDOR: ${err.message}`);
    if (err.code === 'EADDRINUSE') {
      logger.error(`El puerto ${PORT} ya está en uso por otro proceso. Ciérralo e intenta de nuevo.`);
    }
    if (err.code === 'EACCES') {
      logger.error(`Sin permisos para escuchar en el puerto ${PORT}. Ejecuta como administrador.`);
    }
  });
};

// Función auxiliar para notificar a TODAS las ventanas
const notifyAll = (channel: string, data?: any) => {
  if (adminWin && !adminWin.isDestroyed()) adminWin.webContents.send(channel, data);
  if (displayWin && !displayWin.isDestroyed()) displayWin.webContents.send(channel, data);
};

// --- ENDPOINTS API ---

// 1. OBTENER TURNOS (Para el polling del celular y pantallas)
server.get('/api/turns', (_req, res) => {
  try {
    const waiting = db.prepare("SELECT * FROM turns WHERE status = 'waiting' ORDER BY id ASC").all();
    const active = db.prepare("SELECT * FROM turns WHERE status = 'active' LIMIT 1").get();
    res.json({ waiting, active });
  } catch (e) {
    logger.error(`Error en GET /api/turns: ${e}`);
    res.status(500).json({ error: 'DB Error' });
  }
});

// 2. CREAR TURNO (Conector POS o botón "Generar Ticket")
server.post('/api/turns', (req, res) => {
  try {
    // Si el conector envía un folio del POS, lo usamos. Si no, auto-generamos.
    let code = req.body?.code?.toString().trim();

    if (!code) {
      const count = db.prepare('SELECT COUNT(*) as total FROM turns').get() as { total: number };
      code = `A-${(count.total + 1).toString().padStart(3, '0')}`;
    }

    const stmt = db.prepare('INSERT INTO turns (code) VALUES (?)');
    stmt.run(code);

    logger.info(`🎫 Turno creado: ${code}${req.body?.code ? ' (desde POS)' : ' (manual)'}`);
    notifyAll('db-update');
    res.json({ success: true, code });
  } catch (e) {
    logger.error(`Error en POST /api/turns: ${e}`);
    res.status(500).json({ error: 'Error creating' });
  }
});

// 3. LLAMAR / VOCEAR (Lógica Enterprise Mejorada)
// Maneja: Siguiente, Recall y Manual
server.post('/api/call', (req, res) => {
  const { id, code } = req.body;

  try {
    let targetId = id;
    let finalCode = code;

    // === CASO A: LLAMADA MANUAL (ID viene como 0) ===
    if (!id || id === 0) {
      // 1. Buscamos si el código manual YA existe en la historia (ej: "A-005")
      const existing = db.prepare("SELECT * FROM turns WHERE code = ?").get(code) as { id: number, code: string };

      if (existing) {
        // Si existe, usamos ese ID para reactivarlo
        targetId = existing.id;
        finalCode = existing.code;
      } else {
        // Si NO existe (ej: "MESA 5"), lo creamos al vuelo directo como 'active'
        // Primero desactivamos cualquier otro activo para limpieza
        db.prepare("UPDATE turns SET status = 'completed' WHERE status = 'active'").run();

        const stmt = db.prepare("INSERT INTO turns (code, status) VALUES (?, 'active')");
        const info = stmt.run(code);
        targetId = info.lastInsertRowid;
        finalCode = code;

        logger.info(`📢 Llamado manual creado: ${finalCode}`);

        // Trigger inmediato y salir
        if (adminWin && !adminWin.isDestroyed()) {
          adminWin.webContents.send('remote-voice-trigger', finalCode);
        }
        notifyAll('db-update');
        return res.json({ success: true });
      }
    }

    // === CASO B: LLAMADA NORMAL O RECALL (ID > 0) ===
    // Usamos una transacción para que sea atómico (todo o nada)
    const updateTransaction = db.transaction(() => {
      // 1. Poner el turno ACTIVO actual en 'completed' (si es diferente al target, o incluso si es el mismo para forzar refresh)
      db.prepare("UPDATE turns SET status = 'completed' WHERE status = 'active'").run();

      // 2. Poner el turno TARGET en 'active'
      db.prepare("UPDATE turns SET status = 'active' WHERE id = ?").run(targetId);
    });

    updateTransaction();

    // === NOTIFICACIONES ===
    // 1. VOZ: Le decimos al AdminPanel que hable
    if (adminWin && !adminWin.isDestroyed()) {
      // Aseguramos tener el código correcto por si acaso
      if (!finalCode) {
        const t = db.prepare("SELECT code FROM turns WHERE id = ?").get(targetId) as { code: string };
        finalCode = t?.code;
      }
      adminWin.webContents.send('remote-voice-trigger', finalCode);
    }

    logger.info(`📢 Turno llamado: ${finalCode} (ID: ${targetId})`);

    // 2. PANTALLA: Avisamos a todos que la DB cambió
    notifyAll('db-update');

    res.json({ success: true });

  } catch (e) {
    logger.error(`Error en POST /api/call: ${e}`);
    res.status(500).json({ error: 'Error calling' });
  }
});

// 4. COMPLETAR TURNO
server.post('/api/complete', (req, res) => {
  const { id } = req.body;
  try {
    db.prepare("UPDATE turns SET status = 'completed' WHERE id = ?").run(id);
    logger.info(`✅ Turno completado: ID ${id}`);
    notifyAll('db-update');
    res.json({ success: true });
  } catch (e) {
    logger.error(`Error en POST /api/complete: ${e}`);
    res.status(500).json({ error: 'Error completing' });
  }
});

// === CATCH-ALL: SPA ROUTING PARA NAVEGADORES ===
// Cualquier ruta que no sea /api/* devuelve index.html
// Esto permite que http://IP:3000/#/display funcione en Smart TVs
server.get('*', (_req, res) => {
  const indexPath = path.join(distPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('App not found. Is the app built?');
  }
});