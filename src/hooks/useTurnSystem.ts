import { useState, useEffect } from 'react';
import { Turn, AppConfig } from '../types';

export const useTurnSystem = () => {
  const [activeTurn, setActiveTurn] = useState<Turn | null>(null);
  const [waitingList, setWaitingList] = useState<Turn[]>([]);
  const [historyList, setHistoryList] = useState<Turn[]>([]);
  const [config, setConfig] = useState<AppConfig>({});
  const [isLocked, setIsLocked] = useState(true);
  
  // Métricas
  const [metrics, setMetrics] = useState({ totalServed: 0, avgWaitTime: '0 min' });

  const fetchData = async () => {
    // Guard: si no estamos en Electron, no hacer nada (el hook HTTP se encargará)
    if (typeof window === 'undefined' || !window.electron) return;

    try {
      const data = await window.electron.getTurns();
      setActiveTurn(data.active || null);
      setWaitingList(data.waiting || []);
      setHistoryList(data.history || []);
      setConfig(data.config || {});

      // Calcular Métricas Simples
      const completed = data.history || [];
      const total = completed.length;
      
      setMetrics({
        totalServed: total,
        avgWaitTime: total > 0 ? '5 min' : '0 min' // Estimado simple
      });

      // Validación Licencia estricta
      if (data.config.license_expiry) {
        const today = new Date();
        const expiry = new Date(data.config.license_expiry);
        setIsLocked(today > expiry);
      } else {
        setIsLocked(true); // Bloqueado por defecto si no hay licencia
      }

    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    // Guard: si no estamos en Electron, no registrar listeners IPC
    if (typeof window === 'undefined' || !window.electron) return;

    fetchData();
    // Escuchamos actualizaciones de base de datos (DB)
    const cleanup = window.electron.onUpdate(() => fetchData());
    return () => cleanup();
  }, []);

  // --- ACCIONES DEL SISTEMA ---
  
  // Generar Turno Normal
  const generateTurn = async () => {
      return await window.electron.createTurn();
  };
  
  // Llamar / Vocear (Alineado con el main.ts mixto)
  const callTurn = async (id: number, code?: string) => {
    // IMPORTANTE: Agregamos el "return" para saber si la llamada (manual o normal) fue exitosa o rechazada
    return await window.electron.callTurn({ id, code });
  };

  // Finalizar / Completar (Palomita gris)
  const finishTurn = async (id: number) => {
      return await window.electron.completeTurn(id);
  };
  
  // Guardar configuración / Licencia
  const saveSetting = async (key: string, value: string) => {
      return await window.electron.saveSetting(key, value);
  };

  return { 
    activeTurn, 
    waitingList, 
    historyList, 
    config, 
    isLocked, 
    metrics, 
    generateTurn, 
    callTurn, 
    finishTurn, 
    saveSetting 
  };
};