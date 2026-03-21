/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electron', {
  // === MÉTODOS DE ACCIÓN (Frontend -> Backend) ===

  // Obtener listas (Activos, Espera, Historial)
  getTurns: () => ipcRenderer.invoke('get-turns'),

  // Crear turno (Opcional, ya que el POS lo hace, pero útil para pruebas)
  createTurn: () => ipcRenderer.invoke('create-turn'),
  
  // LLAMAR TURNO (Validación Estricta)
  // Acepta: number (ID) O { id: 0, code: string } (Manual)
  // Devuelve: Promise<boolean> (true = éxito, false = no existe/error)
  callTurn: (data: any) => ipcRenderer.invoke('call-turn', data),
  
  // Completar / Finalizar turno
  completeTurn: (id: number) => ipcRenderer.invoke('complete-turn', id),

  // Guardar configuración (colores, títulos, etc.)
  saveSetting: (key: string, value: string) => ipcRenderer.invoke('save-setting', key, value),
  
  // Obtener IP local para generar el QR
  getServerUrl: () => ipcRenderer.invoke('get-server-ip'),


  // === LISTENERS DE EVENTOS (Backend -> Frontend) ===

  // 1. Escuchar cambios en la Base de Datos (Para refrescar listas)
  onUpdate: (callback: () => void) => {
    const subscription = (_event: any, _value: any) => callback();
    ipcRenderer.on('db-update', subscription);
    
    // Retornamos función de limpieza para React (useEffect cleanup)
    return () => {
      ipcRenderer.removeListener('db-update', subscription);
    };
  },

  // 2. Escuchar disparador de Voz (Sincronización Celular -> PC Admin -> TV)
  // Cuando el celular da "Llamar", el servidor avisa a la PC Admin para que hable.
  onVoiceTrigger: (callback: (code: string) => void) => {
    const subscription = (_event: any, code: string) => callback(code);
    ipcRenderer.on('remote-voice-trigger', subscription);
    
    // Retornamos función de limpieza
    return () => {
      ipcRenderer.removeListener('remote-voice-trigger', subscription);
    };
  }
});