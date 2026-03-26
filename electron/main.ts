/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable prefer-const */
import { app, BrowserWindow, ipcMain, screen } from 'electron';
import path from 'path';
import db from './database';
import { execSync } from 'child_process';
import { startServer } from './server';
import { getLocalIp, logger } from './logger';

// Variables globales para las ventanas
let adminWindow: BrowserWindow | null = null;
let displayWindow: BrowserWindow | null = null;

// Función para enviar datos a TODAS las ventanas activas
const broadcastUpdate = (channel: string, ...args: any[]) => {
  if (adminWindow && !adminWindow.isDestroyed()) adminWindow.webContents.send(channel, ...args);
  if (displayWindow && !displayWindow.isDestroyed()) displayWindow.webContents.send(channel, ...args);
};

// Validar si la licencia está vigente leyendo directamente de la DB local
function isLicenseValid() {
  try {
    const setting = db.prepare("SELECT value FROM settings WHERE key = 'license_expiry'").get() as { value: string } | undefined;
    if (!setting || !setting.value) return false;
    const expiryDate = new Date(setting.value);
    const today = new Date();
    return today < expiryDate;
  } catch (error) {
    logger.error(`Error verificando licencia: ${error}`);
    return false;
  }
}

// Resolver la ruta al index.html según el contexto:
// - Dev:        raíz del proyecto / dist / index.html
// - Producción: carpeta del .exe / dist / index.html
//               (dist llega ahí gracias a extraFiles en package.json)
const getIndexHtml = (): string => {
  if (process.env.VITE_DEV_SERVER_URL) {
    // En dev no se usa loadFile, se usa loadURL — este valor no importa
    return '';
  }
  if (app.isPackaged) {
    // Junto al .exe: C:\Program Files\NextCall Enterprise\dist\index.html
    return path.join(path.dirname(app.getPath('exe')), 'dist', 'index.html');
  }
  // npm run dev con build previo: dos niveles arriba de dist-electron
  return path.join(__dirname, '../../dist/index.html');
};

function createWindows() {
  const displays = screen.getAllDisplays();
  const primaryDisplay = screen.getPrimaryDisplay();

  logger.info(`🖥️ Pantallas detectadas: ${displays.length}`);
  displays.forEach((d, i) => {
    logger.info(`  Pantalla ${i + 1}: ${d.size.width}x${d.size.height} en (${d.bounds.x}, ${d.bounds.y})`);
  });

  const externalDisplay = displays.find((display) => {
    return display.bounds.x !== 0 || display.bounds.y !== 0;
  });

  adminWindow = new BrowserWindow({
    width: 1024,
    height: 768,
    x: primaryDisplay.bounds.x + 50,
    y: primaryDisplay.bounds.y + 50,
    title: "Panel Admin - NextCall",
    icon: path.join(__dirname, '../public/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      sandbox: false,
      nodeIntegration: false,
      contextIsolation: true
    },
  });

  const hasValidLicense = isLicenseValid();
  logger.info(`🔑 Licencia válida: ${hasValidLicense}`);

  if (hasValidLicense) {
    let displayX = primaryDisplay.bounds.x;
    let displayY = primaryDisplay.bounds.y;

    if (externalDisplay) {
      displayX = externalDisplay.bounds.x + 50;
      displayY = externalDisplay.bounds.y + 50;
      logger.info(`📺 Pantalla externa detectada, abriendo Display en (${displayX}, ${displayY})`);
    } else {
      logger.info(`📺 Sin pantalla externa, Display se abrirá en la pantalla principal`);
    }

    displayWindow = new BrowserWindow({
      width: 1280,
      height: 720,
      x: displayX,
      y: displayY,
      title: "Pantalla Pública",
      icon: path.join(__dirname, '../public/icon.png'),
      fullscreen: !!externalDisplay,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        sandbox: false,
        nodeIntegration: false,
        contextIsolation: true
      },
    });
  } else {
    logger.warn("[Licencia] Sistema bloqueado o sin activar. No se abrirá la pantalla TV.");
  }

  if (process.env.VITE_DEV_SERVER_URL) {
    adminWindow.loadURL(`${process.env.VITE_DEV_SERVER_URL}#/admin`);
    if (displayWindow) displayWindow.loadURL(`${process.env.VITE_DEV_SERVER_URL}#/display`);
  } else {
    const indexHtml = getIndexHtml();
    logger.info(`📄 Cargando index.html desde: ${indexHtml}`);
    adminWindow.loadFile(indexHtml, { hash: 'admin' });
    if (displayWindow) displayWindow.loadFile(indexHtml, { hash: 'display' });
  }

  adminWindow.on('closed', () => {
    app.quit();
  });
}

app.whenReady().then(() => {
  logger.info('🚀 NextCall Enterprise iniciando...');
  logger.info(`📁 Datos de usuario: ${app.getPath('userData')}`);
  logger.info(`📁 Logs: ${logger.getLogsDir()}`);

  // Configurar perfil de red como Privado para permitir conexiones LAN
  // Se hace aquí porque NSIS no puede manejar $_ de PowerShell sin conflictos
  if (app.isPackaged) {
    try {
      execSync(
        'powershell -Command "Get-NetConnectionProfile | ForEach-Object { if ($_.NetworkCategory -eq 1) { Set-NetConnectionProfile -InterfaceIndex $_.InterfaceIndex -NetworkCategory Private } }"',
        { timeout: 5000 }
      );
      logger.info('✅ Perfil de red configurado como Privado');
    } catch (e) {
      logger.warn(`⚠️ No se pudo cambiar perfil de red (no critico): ${e}`);
    }
  }

  createWindows();

  if (adminWindow) {
    startServer(adminWindow, displayWindow || undefined);
  }

  // === API IPC ===

  ipcMain.handle('get-turns', () => {
    try {
      const active = db.prepare("SELECT * FROM turns WHERE status = 'active' LIMIT 1").get();
      const waiting = db.prepare("SELECT * FROM turns WHERE status = 'waiting' ORDER BY id ASC").all();
      const history = db.prepare("SELECT * FROM turns WHERE status = 'completed' ORDER BY id DESC LIMIT 10").all();
      const settingsRows = db.prepare("SELECT * FROM settings").all() as { key: string, value: string }[];
      const config = settingsRows.reduce((acc, curr) => ({ ...acc, [curr.key]: curr.value }), {});
      return { active, waiting, history, config };
    } catch (error) {
      logger.error(`Error DB en get-turns: ${error}`);
      return { active: null, waiting: [], history: [], config: {} };
    }
  });

  ipcMain.handle('create-turn', () => {
    try {
      const count = db.prepare('SELECT COUNT(*) as total FROM turns').get() as { total: number };
      const code = `A-${(count.total + 1).toString().padStart(3, '0')}`;
      const stmt = db.prepare("INSERT INTO turns (code, status) VALUES (?, 'waiting')");
      const info = stmt.run(code);
      const newTurn = db.prepare('SELECT * FROM turns WHERE id = ?').get(info.lastInsertRowid);
      broadcastUpdate('db-update');
      return newTurn;
    } catch (e) { return null; }
  });

  ipcMain.handle('call-turn', (_, data) => {
    try {
      let id = typeof data === 'object' ? data.id : data;
      let code = typeof data === 'object' ? data.code : null;
      let targetId = id;
      let finalCode = code;

      // CASO MANUAL
      if ((!id || id === 0) && code) {
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
          if (adminWindow && !adminWindow.isDestroyed()) {
            adminWindow.webContents.send('remote-voice-trigger', finalCode);
          }
          broadcastUpdate('db-update');
          return true;
        }
      }

      // CASO NORMAL (Lista de espera o Recall)
      if (targetId) {
        const updateTransaction = db.transaction(() => {
          db.prepare("UPDATE turns SET status = 'completed' WHERE status = 'active'").run();
          db.prepare("UPDATE turns SET status = 'active' WHERE id = ?").run(targetId);
        });
        updateTransaction();

        if (!finalCode) {
          const t = db.prepare("SELECT code FROM turns WHERE id = ?").get(targetId) as { code: string };
          finalCode = t?.code;
        }
        if (adminWindow && !adminWindow.isDestroyed()) {
          adminWindow.webContents.send('remote-voice-trigger', finalCode);
        }
        broadcastUpdate('db-update');
        return true;
      }

      return false;
    } catch (e) {
      logger.error(`Error en call-turn: ${e}`);
      return false;
    }
  });

  ipcMain.handle('complete-turn', (_, id) => {
    try {
      db.prepare("UPDATE turns SET status = 'completed' WHERE id = ?").run(id);
      broadcastUpdate('db-update');
      return true;
    } catch (e) { return false; }
  });

  ipcMain.handle('save-setting', (_, key, value) => {
    try {
      const stmt = db.prepare(`INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`);
      stmt.run(key, value);
      broadcastUpdate('db-update');
      return true;
    } catch (e) { return false; }
  });

  ipcMain.handle('get-server-ip', () => {
    return `http://${getLocalIp()}:3000`;
  });

  ipcMain.handle('relaunch-app', () => {
    app.relaunch();
    app.exit(0);
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});