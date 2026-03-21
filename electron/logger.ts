import { app } from 'electron';
import path from 'path';
import fs from 'fs';

// =====================================================
// SISTEMA DE LOGGING - NextCall Enterprise
// Escribe logs a archivo en %APPDATA%/nextcall-enterprise/logs/
// =====================================================

const logsDir = path.join(app.getPath('userData'), 'logs');

// Crear directorio de logs si no existe
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

/**
 * Obtiene el nombre del archivo de log del día actual
 */
function getLogFileName(): string {
    const now = new Date();
    const date = now.toISOString().split('T')[0]; // YYYY-MM-DD
    return path.join(logsDir, `nextcall-${date}.log`);
}

/**
 * Formatea una línea de log con timestamp y nivel
 */
function formatLine(level: string, message: string): string {
    const now = new Date();
    const timestamp = now.toISOString().replace('T', ' ').substring(0, 19);
    return `[${timestamp}] [${level}] ${message}\n`;
}

/**
 * Escribe una línea al archivo de log (append)
 */
function writeToFile(line: string): void {
    try {
        fs.appendFileSync(getLogFileName(), line, 'utf-8');
    } catch {
        // Si falla escribir al archivo, al menos lo mostramos en la consola
        console.error('[LOGGER] No se pudo escribir al archivo de log:', line);
    }
}

/**
 * Elimina archivos de log con más de 7 días de antigüedad
 */
function cleanOldLogs(): void {
    try {
        const files = fs.readdirSync(logsDir);
        const now = Date.now();
        const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 días en ms

        for (const file of files) {
            if (!file.startsWith('nextcall-') || !file.endsWith('.log')) continue;
            const filePath = path.join(logsDir, file);
            const stats = fs.statSync(filePath);
            if (now - stats.mtimeMs > maxAge) {
                fs.unlinkSync(filePath);
            }
        }
    } catch {
        // Silencioso, la limpieza no es crítica
    }
}

// Ejecutar limpieza al cargar el módulo
cleanOldLogs();

/**
 * Logger principal de NextCall
 */
export const logger = {
    info(message: string): void {
        const line = formatLine('INFO', message);
        writeToFile(line);
        console.log(message);
    },

    warn(message: string): void {
        const line = formatLine('WARN', message);
        writeToFile(line);
        console.warn(message);
    },

    error(message: string): void {
        const line = formatLine('ERROR', message);
        writeToFile(line);
        console.error(message);
    },

    /** Devuelve la ruta del directorio de logs */
    getLogsDir(): string {
        return logsDir;
    }
};

// =====================================================
// DETECCIÓN DE IP LOCAL (reemplazo del paquete 'ip')
// =====================================================

import os from 'os';

/**
 * Obtiene la IP local (LAN) de la máquina.
 * Busca interfaces IPv4 que no sean loopback ni virtuales.
 * Fallback: '127.0.0.1'
 */
export function getLocalIp(): string {
    try {
        const interfaces = os.networkInterfaces();

        // Prioridad: interfaces reales (Ethernet, WiFi) sobre virtuales
        const priorityNames = ['ethernet', 'wi-fi', 'wifi', 'wlan', 'eth', 'en0', 'en1', 'lan'];

        let fallbackIp: string | null = null;

        for (const [name, addrs] of Object.entries(interfaces)) {
            if (!addrs) continue;

            for (const addr of addrs) {
                // Solo IPv4, no loopback, no link-local
                if (addr.family !== 'IPv4' || addr.internal) continue;
                if (addr.address.startsWith('169.254.')) continue; // Link-local

                const nameLower = name.toLowerCase();

                // Si el nombre coincide con una interfaz prioritaria, devolver inmediatamente
                if (priorityNames.some(p => nameLower.includes(p))) {
                    logger.info(`🌐 IP detectada en interfaz "${name}": ${addr.address}`);
                    return addr.address;
                }

                // Guardar como fallback cualquier IP válida
                if (!fallbackIp) {
                    fallbackIp = addr.address;
                }
            }
        }

        if (fallbackIp) {
            logger.info(`🌐 IP detectada (fallback): ${fallbackIp}`);
            return fallbackIp;
        }

        logger.warn('⚠️ No se detectó ninguna IP de red local. Usando 127.0.0.1');
        return '127.0.0.1';
    } catch (err) {
        logger.error(`❌ Error detectando IP local: ${err}`);
        return '127.0.0.1';
    }
}

export default logger;
