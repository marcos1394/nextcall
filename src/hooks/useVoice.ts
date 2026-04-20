import { useCallback, useEffect } from 'react';

export const useVoice = (voiceMessageTemplate?: string) => {
  // Función para hablar (Text-to-Speech)
  const speak = useCallback((text: string) => {
    if (!('speechSynthesis' in window)) return;

    window.speechSynthesis.cancel(); // Limpiar cola anterior para que no se acumulen

    const utterance = new SpeechSynthesisUtterance(text);
    
    // Ajustes de Locución (Para que suene como sala de espera profesional)
    utterance.rate = 0.85;  // Velocidad un poco más lenta para claridad
    utterance.pitch = 1.0;  // Tono normal
    utterance.volume = 1.0; // Volumen máximo

    // Buscar voz en español (Priorizar México, luego genérico)
    const voices = window.speechSynthesis.getVoices();
    const spanishVoices = voices.filter(v => v.lang.startsWith('es'));
    const mxVoice = spanishVoices.find(v => v.lang === 'es-MX');

    if (mxVoice) {
        utterance.voice = mxVoice;
    } else if (spanishVoices.length > 0) {
        utterance.voice = spanishVoices[0];
    }

    window.speechSynthesis.speak(utterance);
  }, []);

  // === MAGIA AUTOMÁTICA ===
  // Escuchamos el evento 'remote-voice-trigger' que viene del servidor (Server/Main)
  // Esto permite que cuando el celular haga POST /api/call, esta PC hable.
  useEffect(() => {
    // Definimos la función que se ejecutará cuando llegue la señal
    const handleRemoteTrigger = (code: string) => {
        if (!code) return;
        
        // Usar la plantilla personalizada o la predeterminada
        const template = voiceMessageTemplate || "Atención turno {{turno}}, favor de pasar a caja.";
        
        // Formatear para que suene natural: "A guión Ciento Uno"
        const readableCode = code.replace('-', ' ');
        
        // Reemplazar la etiqueta dinámica con el código
        const finalMessage = template.replace('{{turno}}', readableCode);
        
        speak(finalMessage);
    };

    // Suscribirse al evento
    let cleanup = () => {};
    
    if (window.electron && window.electron.onVoiceTrigger) {
        cleanup = window.electron.onVoiceTrigger(handleRemoteTrigger);
    } else {
        console.warn("Falta agregar 'onVoiceTrigger' en preload.ts para voz remota.");
    }

    return () => cleanup();
  }, [speak, voiceMessageTemplate]);

  return { speak };
};