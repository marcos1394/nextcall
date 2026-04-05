import { useState, useEffect, useRef, useCallback } from 'react';
import QRCode from 'react-qr-code';
import { CheckCircle2, Monitor, Clock, List, History, Volume2 } from 'lucide-react';
import { useTurnSystem } from '../hooks/useTurnSystem';
import { useTurnSystemHttp } from '../hooks/useTurnSystemHttp';
import { useVoice } from '../hooks/useVoice';

// Detectar si estamos dentro de Electron o en un navegador externo (Smart TV, WiFi)
const isElectron = typeof window !== 'undefined' && typeof window.electron !== 'undefined';

// Helper para saber si es video
const isVideoFile = (url?: string) => {
  if (!url) return false;
  return url.startsWith('data:video') || url.endsWith('.mp4') || url.endsWith('.webm');
};

export default function DisplayScreen() {
  // Auto-seleccionar hook según el contexto:
  // - Electron (ventana local): IPC directo (instantáneo)
  // - Navegador (Smart TV / WiFi): HTTP polling (1s delay)
  const electronData = useTurnSystem();
  const httpData = useTurnSystemHttp();
  const { activeTurn, waitingList, historyList, config } = isElectron ? electronData : httpData;
  
  // === VOZ EN NAVEGADOR ===
  const { speak } = useVoice();
  const [audioEnabled, setAudioEnabled] = useState(isElectron); // Electron no necesita gesto
  const prevCalledCodeRef = useRef<string | null>(null);

  // Cuando el hook HTTP detecta un nuevo turno, disparar voz
  const lastCalledCode = !isElectron ? httpData.lastCalledCode : null;

  useEffect(() => {
    if (isElectron || !audioEnabled || !lastCalledCode) return;
    if (lastCalledCode === prevCalledCodeRef.current) return;
    prevCalledCodeRef.current = lastCalledCode;

    const readableCode = lastCalledCode.replace('-', ' ');
    speak(`Atención turno ${readableCode}, favor de pasar a caja.`);
  }, [lastCalledCode, audioEnabled, speak]);

  // Función para activar audio (requiere gesto del usuario en navegadores)
  const enableAudio = useCallback(() => {
    // Hacer un speak vacío para "desbloquear" el audio del navegador
    if ('speechSynthesis' in window) {
      const u = new SpeechSynthesisUtterance('');
      u.volume = 0;
      window.speechSynthesis.speak(u);
    }
    setAudioEnabled(true);
  }, []);

  // Estado para controlar la vista: 'turn' (Número) o 'ad' (Publicidad)
  const [viewMode, setViewMode] = useState<'turn' | 'ad'>('turn');
  const videoRef = useRef<HTMLVideoElement>(null);

  // === CONFIGURACIÓN Y COLORES NEXTCALL ===
  const menuUrl = config.menu_url || "https://www.mercadopago.com.mx"; 
  const adMedia = config.ad_image;        // Puede ser Imagen o Video (Base64)
  const footerImage = config.footer_image;  // Banner Inferior
  const logo = config.restaurant_logo;      // Logo del Restaurante
  
  // Colores de la marca NextCall (o personalizados si vienen de config)
  const brandColor = config.brand_color || '#456df2'; 
  const theme = {
      primary: brandColor,      // Azul Vibrante (#456df2)
      secondary: '#3c4add',     // Indigo (#3c4add)
      dark: '#000033',          // Navy Oscuro (#000033)
      panel: '#0a0a4a',         // Un tono un poco más claro para paneles
  };

  const isVideoAd = config.ad_is_video === 'true' || isVideoFile(adMedia);

  // === LÓGICA DE ROTACIÓN (INTACTA) ===
  useEffect(() => {
    // 1. Prioridad: Si cambia el turno (o hacen Recall), FORZAMOS mostrar el número
    setViewMode('turn');

    // 2. Solo si hay publicidad, iniciamos el ciclo
    if (adMedia) {
      const cycleInterval = setInterval(() => {
        setViewMode(current => {
           return current === 'turn' ? 'ad' : 'turn';
        });
      }, 15000); // 15 segundos por vista

      return () => clearInterval(cycleInterval);
    }
  }, [activeTurn, adMedia]); 

  // Efecto para reproducir video cuando entra en vista
  useEffect(() => {
    if (viewMode === 'ad' && isVideoAd && videoRef.current) {
        videoRef.current.currentTime = 0;
        videoRef.current.play().catch(e => console.log("Auto-play prevented", e));
    }
  }, [viewMode, isVideoAd]);

  // Cálculo de tamaño de fuente
  const getFontSize = (text: string) => {
      if (!text) return '13rem';
      if (text.length > 5) return '8rem'; 
      if (text.length > 3) return '11rem';
      return '16rem'; 
  };

  return (
    <div className="h-screen w-screen text-white overflow-hidden flex font-sans antialiased cursor-none" style={{ backgroundColor: theme.dark }}>
      
      {/* =========================================
          COLUMNA IZQUIERDA (CONTENIDO PRINCIPAL)
         ========================================= */}
      <div className="flex-1 relative flex flex-col overflow-hidden border-r border-[#456df2]/20">
        
        {/* Fondo Ambiental Dinámico */}
        <div 
            className="absolute inset-0 opacity-20 pointer-events-none transition-colors duration-1000" 
            style={{ background: `radial-gradient(circle at 50% 50%, ${theme.primary}, transparent 70%)` }}
        ></div>

        {/* --- ÁREA CENTRAL (CAMBIANTE) --- */}
        <div className="flex-1 relative overflow-hidden">
            
            {/* VISTA A: TURNO GIGANTE */}
            <div className={`absolute inset-0 flex flex-col items-center justify-center transition-all duration-1000 transform ${viewMode === 'turn' ? 'opacity-100 scale-100 z-20' : 'opacity-0 scale-95 z-0'}`}>
                <main className="relative z-10 text-center flex flex-col items-center pb-10 w-full px-4">
                  
                  {/* Header: Logo o Texto */}
                  <div className="flex items-center gap-3 mb-10 opacity-90 animate-in fade-in slide-in-from-top-10 duration-700">
                      {logo ? (
                          <img src={logo} className="h-28 object-contain drop-shadow-2xl" alt="Logo" />
                      ) : (
                          <div className="flex items-center gap-3">
                             <Monitor className="w-8 h-8" style={{ color: theme.primary }} />
                             <span className="text-3xl font-black uppercase tracking-[0.3em] text-white">SU TURNO</span>
                          </div>
                      )}
                  </div>
                  
                  {/* CAJA DEL NÚMERO (Diseño Cristal NextCall) */}
                  <div 
                    className="border-[4px] rounded-[3rem] backdrop-blur-md relative group flex items-center justify-center min-w-[50%] min-h-[40vh] px-10 shadow-2xl"
                    style={{ 
                        backgroundColor: `${theme.panel}80`, // Transparencia sobre el panel dark
                        borderColor: theme.primary, 
                        boxShadow: `0 0 100px -20px ${theme.primary}60, inset 0 0 30px ${theme.primary}20` 
                    }}
                  >
                    {/* Efecto Glow interno */}
                    <div className="absolute inset-0 rounded-[3rem] opacity-10 animate-pulse" style={{ backgroundColor: theme.primary }}></div>
                    
                    <span 
                        className="leading-none font-black tracking-tighter text-white block drop-shadow-2xl relative z-10 break-words text-center"
                        style={{ fontSize: getFontSize(activeTurn?.code || '') }}
                    >
                      {activeTurn ? activeTurn.code : '--'}
                    </span>
                  </div>

                  {/* Mensaje de Estado */}
                  <div className="mt-12 inline-flex items-center gap-4 px-10 py-5 rounded-full border border-[#456df2]/30 shadow-xl animate-bounce-slow" style={{ backgroundColor: theme.panel }}>
                    {activeTurn ? (
                        <>
                            <span className="relative flex h-5 w-5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: theme.primary }}></span>
                                <span className="relative inline-flex rounded-full h-5 w-5" style={{ backgroundColor: theme.primary }}></span>
                            </span>
                            <p className="text-4xl font-bold tracking-tight uppercase" style={{ color: theme.primary }}>
                                Pase a Caja
                            </p>
                        </>
                    ) : (
                        <p className="text-3xl font-medium text-zinc-400 flex items-center gap-3">
                            <Clock className="w-8 h-8"/> Esperando turnos...
                        </p>
                    )}
                  </div>
                </main>
            </div>

            {/* VISTA B: PUBLICIDAD FULL SCREEN */}
            {adMedia && (
                <div className={`absolute inset-0 transition-all duration-1000 transform ${viewMode === 'ad' ? 'opacity-100 scale-100 z-20' : 'opacity-0 scale-105 z-0'}`}>
                    {isVideoAd ? (
                        <video 
                            ref={videoRef}
                            src={adMedia} 
                            className="w-full h-full object-cover" 
                            muted 
                            loop 
                            playsInline
                        />
                    ) : (
                        <img src={adMedia} className="w-full h-full object-cover opacity-95" alt="Publicidad" />
                    )}
                    
                    {/* Degradado sutil */}
                    <div className="absolute inset-0 bg-gradient-to-t pointer-events-none" style={{ background: `linear-gradient(to top, ${theme.dark}E6, transparent)` }}></div>
                </div>
            )}
        </div>

        {/* --- BANNER INFERIOR FIJO (FOOTER) --- */}
        {footerImage && (
            <div className="h-32 xl:h-40 w-full border-t border-[#456df2]/20 relative z-30 shrink-0 shadow-2xl" style={{ backgroundColor: theme.dark }}>
                <img src={footerImage} className="w-full h-full object-cover" alt="Footer Banner" />
                <div className="absolute top-0 right-0 text-white text-[9px] px-2 py-1 font-bold uppercase tracking-wider rounded-bl-lg backdrop-blur-sm bg-black/70">
                    Anuncio
                </div>
            </div>
        )}

      </div>

      {/* =========================================
          COLUMNA DERECHA (SIDEBAR MIXTO)
         ========================================= */}
      <div className="w-[380px] xl:w-[450px] border-l border-[#456df2]/20 flex flex-col z-40 shadow-2xl relative" style={{ backgroundColor: theme.dark }}>
        
        {/* === SECCIÓN 1: PRÓXIMOS (WAITING LIST) === */}
        <div className="flex-1 flex flex-col border-b border-[#456df2]/20">
            <div className="p-6 border-b border-[#456df2]/20 backdrop-blur" style={{ backgroundColor: `${theme.panel}CC` }}>
                <h3 className="text-xl font-bold text-white tracking-tight flex items-center gap-3">
                    <List className="w-6 h-6" style={{ color: theme.primary }} /> 
                    Próximos
                </h3>
            </div>
            
            <div className="flex-1 p-6 space-y-3 overflow-y-hidden relative bg-black/10">
                {/* Degradado para indicar scroll */}
                <div className="absolute bottom-0 left-0 right-0 h-10 pointer-events-none z-10" style={{ background: `linear-gradient(to top, ${theme.dark}, transparent)` }}></div>
                
                {waitingList.length === 0 && (
                     <div className="flex flex-col items-center justify-center h-full opacity-30">
                         <p className="text-indigo-200 italic">No hay espera</p>
                     </div>
                )}

                {/* Mostramos máximo los próximos 5 */}
                {waitingList.slice(0, 5).map((turn) => (
                     <div key={turn.id} className="flex items-center justify-between p-4 rounded-xl border border-[#456df2]/20 shadow-sm" style={{ backgroundColor: `${theme.panel}80` }}>
                         <span className="text-3xl font-bold text-white tracking-wider">{turn.code}</span>
                         <span className="text-[10px] font-bold text-white px-2 py-1 rounded uppercase" style={{ backgroundColor: theme.secondary }}>
                            En fila
                         </span>
                     </div>
                ))}
                {waitingList.length > 5 && (
                    <p className="text-center text-indigo-300 text-xs mt-2">... y {waitingList.length - 5} más</p>
                )}
            </div>
        </div>


        {/* === SECCIÓN 2: HISTORIAL (COMPLETED LIST) === */}
        <div className="flex-1 flex flex-col">
            <div className="p-6 border-b border-[#456df2]/20 backdrop-blur border-t border-[#456df2]/20" style={{ backgroundColor: `${theme.panel}CC` }}>
                <h3 className="text-xl font-bold text-white tracking-tight flex items-center gap-3">
                    <History className="w-6 h-6 text-zinc-400" /> 
                    Recién Atendidos
                </h3>
            </div>

            <div className="flex-1 p-6 space-y-3 overflow-hidden bg-black/20">
                {historyList.length === 0 && (
                     <div className="flex flex-col items-center justify-center h-full opacity-30">
                         <p className="text-zinc-500 italic">Historial vacío</p>
                     </div>
                )}

                {/* Mostramos los últimos 4 atendidos */}
                {historyList.slice(0, 4).map((turn) => (
                    <div 
                        key={turn.id} 
                        className="flex items-center justify-between p-4 rounded-xl border border-white/5 opacity-60 grayscale"
                        style={{ backgroundColor: 'rgba(255,255,255,0.03)' }}
                    >
                        <span className="text-3xl font-bold text-zinc-500 line-through decoration-zinc-600">{turn.code}</span>
                        <CheckCircle2 className="w-5 h-5 text-zinc-600" />
                    </div>
                ))}
            </div>
        </div>

        {/* === FOOTER QR === */}
        <div className="p-6 border-t border-[#456df2]/20 flex items-center gap-6 relative overflow-hidden bg-black">
            <div className="absolute inset-0 opacity-20" style={{ background: `linear-gradient(45deg, ${theme.primary}, transparent)` }}></div>
            
            <div className="relative z-10 bg-white p-2 rounded-xl shadow-lg shrink-0">
                <QRCode 
                    value={menuUrl} 
                    size={80} 
                    style={{ height: "auto", maxWidth: "100%", width: "80px" }} 
                    viewBox={`0 0 256 256`}
                />
            </div>
            
            <div className="relative z-10">
                <p className="font-bold text-lg leading-tight mb-1 text-white">Escanee para<br/><span style={{ color: theme.primary }}>ver Menú</span></p>
                <p className="text-zinc-400 text-xs uppercase tracking-widest">Sin contacto • Rápido</p>
            </div>
        </div>

      </div>

      {/* === OVERLAY: ACTIVAR AUDIO (Solo navegador, una vez) === */}
      {!isElectron && !audioEnabled && (
        <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center">
          <button
            onClick={enableAudio}
            className="flex flex-col items-center gap-6 px-16 py-12 rounded-3xl border-2 border-blue-500/50 bg-[#0a0a4a] hover:bg-[#1a1a6a] transition-all duration-300 shadow-2xl hover:shadow-blue-500/30 hover:scale-105 active:scale-95 cursor-pointer"
          >
            <Volume2 className="w-20 h-20 text-blue-400 animate-pulse" />
            <span className="text-3xl font-bold text-white tracking-tight">Activar Audio</span>
            <span className="text-sm text-zinc-400">Toque para escuchar los anuncios de turno</span>
          </button>
        </div>
      )}

    </div>
  );
}