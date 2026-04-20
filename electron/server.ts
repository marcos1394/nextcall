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

// === RUTA AL DIST ===
// En producción (isPackaged): el dist está como carpeta real junto al .exe
// gracias a extraFiles. NO está dentro del asar porque express.static
// no puede leer archivos dentro de un .asar (sistema de archivos virtual).
//
// En desarrollo (npm run dev): el dist está en la raíz del proyecto,
// dos niveles arriba de dist-electron donde vive este archivo compilado.
const distPath = app.isPackaged
  ? path.join(path.dirname(app.getPath('exe')), 'dist')
  : path.join(__dirname, '../../dist');

logger.info(`📂 distPath resuelto: ${distPath}`);
logger.info(`📂 distPath existe: ${fs.existsSync(distPath)}`);

// Middleware: loguear TODOS los requests (ANTES de static para visibilidad total)
server.use((req, _res, next) => {
  logger.info(`HTTP ${req.method} ${req.path} desde ${req.ip}`);
  next();
});

// === SERVIR ARCHIVOS ESTÁTICOS (SMART TV / WIFI) ===
server.use(express.static(distPath));

// Helper para servir index.html de forma robusta y compatible con cualquier navegador
const serveIndex = (_req: express.Request, res: express.Response) => {
  const indexPath = path.resolve(distPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(indexPath);
  } else {
    logger.error(`index.html no encontrado en: ${indexPath}`);
    res.status(404).send(`
      <h2>NextCall — Archivo no encontrado</h2>
      <p>distPath: ${distPath}</p>
      <p>Existe: ${fs.existsSync(distPath)}</p>
      <p>Si ves este mensaje, reporta esta ruta al soporte.</p>
    `);
  }
};

// === RUTAS SPA EXPLÍCITAS ===
// Navegadores de Smart TV (Hisense VIDAA, LG WebOS, Samsung Tizen) a veces
// no manejan bien los hash fragments en redirects (#/display).
// Servimos index.html directamente para que React Router/HashRouter resuelva la vista.
server.get('/', serveIndex);
server.get('/display', serveIndex);
server.get('/admin', serveIndex);

let adminWin: BrowserWindow | null = null;
let displayWin: BrowserWindow | null = null;

// === HEALTH CHECK ===
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

// === CONFIG ENDPOINT (Para navegadores / Smart TV) ===
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

  httpServer.on('error', (err: NodeJS.ErrnoException) => {
    logger.error(`❌ NO SE PUDO INICIAR EL SERVIDOR: ${err.message}`);
    if (err.code === 'EADDRINUSE') {
      logger.error(`El puerto ${PORT} ya está en uso. Ciérralo e intenta de nuevo.`);
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

// 1. OBTENER TURNOS
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

// 2. CREAR TURNO
server.post('/api/turns', (req, res) => {
  try {
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

// 3. LLAMAR / VOCEAR
server.post('/api/call', (req, res) => {
  const { id, code } = req.body;

  try {
    let targetId = id;
    let finalCode = code;

    // CASO A: LLAMADA MANUAL (id = 0 o sin id)
    if (!id || id === 0) {
      const existing = db.prepare("SELECT * FROM turns WHERE code = ?").get(code) as { id: number, code: string };

      if (existing) {
        targetId = existing.id;
        finalCode = existing.code;
      } else {
        db.prepare("UPDATE turns SET status = 'completed' WHERE status = 'active'").run();

        const stmt = db.prepare("INSERT INTO turns (code, status) VALUES (?, 'active')");
        const info = stmt.run(code);
        targetId = info.lastInsertRowid;
        finalCode = code;

        logger.info(`📢 Llamado manual creado: ${finalCode}`);

        notifyAll('remote-voice-trigger', finalCode);
        notifyAll('db-update');
        return res.json({ success: true });
      }
    }

    // CASO B: LLAMADA NORMAL O RECALL (id > 0)
    const updateTransaction = db.transaction(() => {
      db.prepare("UPDATE turns SET status = 'completed' WHERE status = 'active'").run();
      db.prepare("UPDATE turns SET status = 'active' WHERE id = ?").run(targetId);
    });

    updateTransaction();

    if (!finalCode) {
      const t = db.prepare("SELECT code FROM turns WHERE id = ?").get(targetId) as { code: string };
      finalCode = t?.code;
    }
    notifyAll('remote-voice-trigger', finalCode);

    logger.info(`📢 Turno llamado: ${finalCode} (ID: ${targetId})`);
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
// Compatible con Smart TVs, celulares y cualquier navegador
server.get(/(.*)/, serveIndex);