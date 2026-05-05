/**
 * useTurnSystemHttp — Hook para contextos de navegador (Smart TV, WiFi)
 * 
 * Usado cuando window.electron NO está disponible.
 * Hace polling HTTP contra la API REST del servidor.
 * Intervalo: 1 segundo para minimizar delay percibido.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { Turn, AppConfig } from '../types';

// Construir la base URL dinámicamente desde la URL del navegador
const getBaseUrl = (): string => {
  // Cuando la TV abre http://192.168.1.X:3000/#/display
  // window.location.hostname = "192.168.1.X" y port = "3000"
  const { hostname, port, protocol } = window.location;
  return `${protocol}//${hostname}${port ? ':' + port : ''}`;
};

export const useTurnSystemHttp = () => {
  const [activeTurn, setActiveTurn] = useState<Turn | null>(null);
  const [waitingList, setWaitingList] = useState<Turn[]>([]);
  const [historyList, setHistoryList] = useState<Turn[]>([]);
  const [config, setConfig] = useState<AppConfig>({});
  const [isLocked, setIsLocked] = useState(true);
  const [metrics, setMetrics] = useState({ totalServed: 0, avgWaitTime: '0 min' });

  // Tracking de cambio de turno para disparar voz en el navegador
  const [lastCalledCode, setLastCalledCode] = useState<string | null>(null);
  const [voiceTimestamp, setVoiceTimestamp] = useState<number>(0);
  const prevTurnIdRef = useRef<number | null>(null);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const baseUrl = useRef(getBaseUrl());

  const fetchTurns = useCallback(async () => {
    try {
      const res = await fetch(`${baseUrl.current}/api/turns`, {
        signal: AbortSignal.timeout(3000),
      });
      if (!res.ok) return;
      const data = await res.json();

      const newActive: Turn | null = data.active || null;

      // Detectar cambio de turno activo para disparar voz
      if (newActive && newActive.id !== prevTurnIdRef.current) {
        setLastCalledCode(newActive.code);
      }
      prevTurnIdRef.current = newActive?.id ?? null;

      // Leer el timestamp del audio generado en el servidor
      if (data.voiceTimestamp) {
        setVoiceTimestamp(data.voiceTimestamp);
      }

      setActiveTurn(newActive);
      setWaitingList(data.waiting || []);
    } catch {
      // Pérdida momentánea de señal — silencioso
    }
  }, []);

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch(`${baseUrl.current}/api/config`, {
        signal: AbortSignal.timeout(3000),
      });
      if (!res.ok) return;
      const data = await res.json();

      setConfig(data.config || {});
      setHistoryList(data.history || []);

      // Métricas
      const total = (data.history || []).length;
      setMetrics({ totalServed: total, avgWaitTime: total > 0 ? '5 min' : '0 min' });

      // Licencia
      if (data.config?.license_expiry) {
        const today = new Date();
        const expiry = new Date(data.config.license_expiry);
        setIsLocked(today > expiry);
      } else {
        setIsLocked(true);
      }
    } catch {
      // Silencioso
    }
  }, []);

  useEffect(() => {
    // Fetch inicial
    fetchTurns();
    fetchConfig();

    // Polling de turnos cada 1 segundo (mínimo delay práctico)
    intervalRef.current = setInterval(fetchTurns, 1000);

    // Config se actualiza cada 10 segundos (no cambia con frecuencia)
    const configInterval = setInterval(fetchConfig, 10000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      clearInterval(configInterval);
    };
  }, [fetchTurns, fetchConfig]);

  // Las acciones desde la TV/browser son de solo lectura por ahora.
  // Si se quisieran habilitar, se usaría fetch POST contra la API REST.
  const generateTurn = async () => null;
  const callTurn = async () => false;
  const finishTurn = async () => false;
  const saveSetting = async () => false;

  return {
    activeTurn,
    waitingList,
    historyList,
    config,
    isLocked,
    metrics,
    lastCalledCode,
    voiceTimestamp,
    generateTurn,
    callTurn,
    finishTurn,
    saveSetting,
  };
};
