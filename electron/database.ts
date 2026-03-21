import Database from 'better-sqlite3';
import { app } from 'electron';
import path from 'path';

// En producción, usamos 'userData' para que la DB sobreviva a actualizaciones
const dbPath = path.join(app.getPath('userData'), 'rest_turnos_prod.db');
const db = new Database(dbPath);

// Inicializar tablas
db.exec(`
  CREATE TABLE IF NOT EXISTS turns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL,
    status TEXT DEFAULT 'waiting', -- waiting, active, completed
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );
`);

// Limpieza al inicio: Si se cerró la app con alguien "activo", lo marcamos como completado
db.exec("UPDATE turns SET status = 'completed' WHERE status = 'active'");

export default db;