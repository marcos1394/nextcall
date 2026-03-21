/* eslint-disable @typescript-eslint/no-unused-vars */
import { useState, useEffect } from 'react';
import {
    Plus, Settings, Lock, CreditCard, BarChart3, Users,
    Cast, Mic, Keyboard, History, List, Wifi,
    Monitor, Smartphone, AlertTriangle, Copy
} from 'lucide-react';

import { useVoice } from '../hooks/useVoice';
import { useTurnSystem } from '../hooks/useTurnSystem';
import SettingsModal from '../components/SettingsModal';
import TurnCard from '../components/TurnCard';
import QRCode from 'react-qr-code';

export default function AdminPanel() {
    const { speak } = useVoice();
    const {
        activeTurn, waitingList, historyList, metrics, isLocked, config,
        generateTurn, callTurn, finishTurn, saveSetting
    } = useTurnSystem();

    // ESTADOS
    const [activeTab, setActiveTab] = useState<'waiting' | 'history'>('waiting');
    const [showSettings, setShowSettings] = useState(false);
    const [showConnectModal, setShowConnectModal] = useState(false);
    const [showManualModal, setShowManualModal] = useState(false);
    const [manualCode, setManualCode] = useState('');

    const [licenseInput, setLicenseInput] = useState('');
    const [serverUrl, setServerUrl] = useState('');

    // Usamos el color de marca #456df2 por defecto si no viene de la DB
    const dynamicColor = config.brand_color || '#456df2';
    const MP_LINK = "https://mpago.li/2anM7iM";

    // Colores del tema NextCall
    const theme = {
        primary: '#456df2',
        secondary: '#3c4add',
        dark: '#000033',
    };

    // Cargar URL del servidor
    useEffect(() => {
        if (window.electron) {
            window.electron.getServerUrl().then(url => setServerUrl(url));
        }
    }, []);

    // --- ACCIONES ---

    const handleCall = async (id: number, code: string) => {
        // Validación Estricta
        const result = await callTurn(id, code) as unknown;
        if (typeof result === 'boolean' && result === false) {
            alert("Error: El folio no existe en la base de datos.");
            return;
        }
        const readableCode = code.replace('-', ' ');
        speak(`Atención turno ${readableCode}, favor de pasar.`);
    };

    const handleRecall = async () => {
        if (!activeTurn) return;
        await handleCall(activeTurn.id, activeTurn.code);
    };

    const handleManualCall = async () => {
        if (!manualCode.trim()) return;
        await handleCall(0, manualCode.toUpperCase());
        setShowManualModal(false);
        setManualCode('');
    };

    // --- LÓGICA DE ACTIVACIÓN POR BASE64 ---
    const handleActivate = async () => {
        // IMPORTANTE: Base64 es sensible a mayúsculas y minúsculas. NO usamos toUpperCase()
        const code = licenseInput.trim();

        let decodedCode = "";
        try {
            // Intentamos decodificar el Base64 a texto plano
            decodedCode = atob(code);
        } catch (e) {
            // Si falla, significa que escribieron basura que no es formato Base64
            decodedCode = "";
        }

        let diasDeGracia = 0;

        // Evaluamos el texto oculto
        if (decodedCode === "NEXT30") {
            diasDeGracia = 30;
        } else if (decodedCode === "NEXT365") {
            diasDeGracia = 365;
        } else if (decodedCode === "MASTERKEY") {
            diasDeGracia = 36500; // 100 años
        }

        // SI HAY DÍAS DE GRACIA, APLICAMOS DESDE HOY
        if (diasDeGracia > 0) {
            // Calculamos la fecha de vencimiento partiendo del instante actual
            const fechaVencimiento = new Date();
            fechaVencimiento.setDate(fechaVencimiento.getDate() + diasDeGracia);

            // Guardamos en la base de datos local
            await saveSetting('license_expiry', fechaVencimiento.toISOString());

            alert(`¡Activación Exitosa!\nLicencia válida por ${diasDeGracia} días.\nVence el: ${fechaVencimiento.toLocaleDateString()}`);

            // Recargamos la app para que quite el bloqueo
            window.location.reload();
        } else {
            alert("Código de activación incorrecto o alterado. Verifique el pago en Mercado Pago.");
        }
    };

    // ==========================================
    // VISTA 1: BLOQUEO (LOCK SCREEN)
    // ==========================================
    if (isLocked) {
        return (
            <div className="h-screen w-screen flex flex-col items-center justify-center text-white p-8" style={{ backgroundColor: theme.dark }}>
                <div className="bg-white/5 p-12 rounded-3xl w-full max-w-xl border border-white/10 text-center relative overflow-hidden shadow-2xl backdrop-blur-sm">
                    <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r" style={{ background: `linear-gradient(to right, ${theme.primary}, ${theme.secondary})` }}></div>
                    <Lock className="w-20 h-20 mx-auto mb-6 text-white/20" />
                    <h1 className="text-4xl font-black mb-2 text-white">Suscripción Vencida</h1>
                    <p className="text-zinc-400 mb-8">Renueve su licencia NextCall para continuar.</p>

                    <a href={MP_LINK} target="_blank" className="block w-full text-white py-4 rounded-xl font-bold mb-8 flex items-center justify-center gap-2 hover:opacity-90 transition" style={{ backgroundColor: theme.primary }}>
                        <CreditCard className="w-5 h-5" /> Pagar Licencia Anual
                    </a>

                    <div className="flex gap-2">
                        {/* Quitamos la clase 'uppercase' visual para evitar confusión al pegar un Base64 */}
                        <input
                            value={licenseInput} onChange={(e) => setLicenseInput(e.target.value)}
                            placeholder="CÓDIGO DE ACTIVACIÓN"
                            className="flex-1 bg-black/30 border border-white/10 rounded-xl px-4 text-white font-mono placeholder:text-zinc-600 focus:outline-none focus:border-[#456df2]"
                        />
                        <button onClick={handleActivate} className="px-6 py-3 rounded-xl font-bold text-white hover:opacity-90 transition" style={{ backgroundColor: theme.secondary }}>
                            Validar
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ==========================================
    // VISTA 2: PANEL PRINCIPAL
    // ==========================================
    return (
        <div className="h-screen w-screen bg-zinc-50 flex text-zinc-900 font-sans relative overflow-hidden">

            {/* MODAL AJUSTES */}
            {showSettings && (
                <SettingsModal config={config} onClose={() => setShowSettings(false)} onSave={saveSetting} />
            )}

            {/* MODAL MANUAL */}
            {showManualModal && (
                <div className="absolute inset-0 bg-black/60 z-50 flex items-center justify-center backdrop-blur-sm">
                    <div className="bg-white p-8 rounded-2xl w-96 text-center shadow-2xl">
                        <h2 className="text-xl font-black mb-4" style={{ color: theme.dark }}>Llamada Manual</h2>
                        <input
                            autoFocus
                            value={manualCode}
                            onChange={(e) => setManualCode(e.target.value)}
                            placeholder="Ej: 1045"
                            className="w-full text-center text-3xl font-bold border-2 border-zinc-200 rounded-xl p-4 mb-4 uppercase focus:outline-none focus:border-[#456df2]"
                        />
                        <div className="flex gap-2">
                            <button onClick={() => setShowManualModal(false)} className="flex-1 py-3 text-zinc-500 font-bold hover:bg-zinc-100 rounded-xl transition">Cancelar</button>
                            <button onClick={handleManualCall} className="flex-1 py-3 text-white rounded-xl font-bold shadow-lg hover:opacity-90 transition" style={{ backgroundColor: theme.dark }}>
                                VOCEAR
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL CONEXIÓN — GUÍA VISUAL PARA USUARIOS NO TÉCNICOS */}
            {showConnectModal && (
                <div className="absolute inset-0 bg-[#000033]/90 z-50 flex items-center justify-center backdrop-blur-md overflow-y-auto py-6">
                    <div className="bg-white p-8 rounded-3xl max-w-4xl w-full shadow-2xl mx-4 max-h-[95vh] overflow-y-auto">

                        {/* HEADER */}
                        <div className="text-center mb-6">
                            <div className="inline-flex items-center gap-2 bg-[#edf2fe] px-4 py-2 rounded-full mb-4">
                                <Wifi className="w-5 h-5 text-[#456df2]" />
                                <span className="text-sm font-bold text-[#456df2]">Guía de Conexión</span>
                            </div>
                            <h2 className="text-3xl font-black mb-2" style={{ color: theme.dark }}>¿Cómo conecto mis dispositivos?</h2>
                            <p className="text-zinc-500 text-sm">Sigue los pasos para conectar tu TV, celular o tablet a NextCall</p>
                        </div>

                        {/* REQUISITO #1 — MISMA RED (DESTACADO) */}
                        <div className="flex items-center gap-4 bg-gradient-to-r from-[#456df2] to-[#3c4add] p-5 rounded-2xl mb-6 shadow-lg shadow-blue-200">
                            <div className="bg-white/20 p-3 rounded-xl backdrop-blur">
                                <Wifi className="w-8 h-8 text-white" />
                            </div>
                            <div className="text-white">
                                <p className="font-black text-base">⚠️ Requisito Importante</p>
                                <p className="text-sm opacity-90">Todos los dispositivos (esta computadora, la TV y el celular) deben estar conectados <b>al mismo WiFi o router</b>. Si la PC usa cable y el celular WiFi, funciona siempre que sea el <b>mismo router</b>.</p>
                            </div>
                        </div>

                        {/* DIRECCIÓN DEL SERVIDOR + QR */}
                        <div className="flex flex-col md:flex-row items-center gap-6 mb-8 bg-zinc-50 p-6 rounded-2xl border border-zinc-100">
                            <div className="p-3 bg-white border rounded-2xl shadow-sm shrink-0">
                                <QRCode value={serverUrl} size={120} />
                            </div>
                            <div className="text-center md:text-left">
                                <p className="text-xs font-bold text-zinc-400 uppercase mb-1">📍 Dirección de tu servidor</p>
                                <p className="text-3xl font-black mb-2" style={{ color: theme.primary }}>{serverUrl}</p>
                                <p className="text-xs text-zinc-400 mb-2">Esta es la dirección que debes escribir en la TV o en la app del celular</p>
                                <button
                                    onClick={() => { navigator.clipboard.writeText(serverUrl); }}
                                    className="inline-flex items-center gap-1 text-xs font-bold text-white px-4 py-2 rounded-lg transition hover:opacity-90"
                                    style={{ backgroundColor: theme.primary }}
                                >
                                    <Copy className="w-3 h-3" /> Copiar dirección
                                </button>
                            </div>
                        </div>

                        {/* ============= INSTRUCCIONES POR DISPOSITIVO ============= */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">

                            {/* === PANTALLA / SMART TV === */}
                            <div className="bg-zinc-50 rounded-2xl border border-zinc-100 overflow-hidden">
                                <div className="flex items-center gap-3 p-4 border-b border-zinc-100" style={{ backgroundColor: '#edf2fe' }}>
                                    <div className="p-2 rounded-xl bg-white shadow-sm">
                                        <Monitor className="w-6 h-6" style={{ color: theme.primary }} />
                                    </div>
                                    <div>
                                        <h3 className="font-black text-sm" style={{ color: theme.dark }}>📺 Pantalla / Smart TV</h3>
                                        <p className="text-[10px] text-zinc-500">Para mostrar los turnos en una pantalla grande</p>
                                    </div>
                                </div>
                                <div className="p-5 space-y-4">
                                    <div className="flex gap-3 items-start">
                                        <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-white font-black text-sm shadow" style={{ backgroundColor: theme.primary }}>1</div>
                                        <div>
                                            <p className="text-sm font-bold" style={{ color: theme.dark }}>Conecta la TV al WiFi</p>
                                            <p className="text-xs text-zinc-500">Ve a Configuración → Red → WiFi en tu televisor y conéctate a la <b>misma red</b> que esta computadora</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-3 items-start">
                                        <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-white font-black text-sm shadow" style={{ backgroundColor: theme.primary }}>2</div>
                                        <div>
                                            <p className="text-sm font-bold" style={{ color: theme.dark }}>Abre el navegador de la TV</p>
                                            <p className="text-xs text-zinc-500">Busca la app <b>"Internet"</b>, <b>"Navegador Web"</b> o <b>"Chrome"</b> en tu Smart TV. Si no tiene navegador, puedes usar un <b>Amazon Fire Stick</b> o <b>Chromecast</b> con navegador</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-3 items-start">
                                        <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-white font-black text-sm shadow" style={{ backgroundColor: theme.primary }}>3</div>
                                        <div>
                                            <p className="text-sm font-bold" style={{ color: theme.dark }}>Escribe esta dirección en la barra</p>
                                            <p className="text-xs text-zinc-500">Escribe exactamente: <b className="text-[#456df2] text-sm">{serverUrl}</b></p>
                                        </div>
                                    </div>
                                    <div className="flex gap-3 items-start">
                                        <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-white font-black text-sm shadow bg-emerald-500">✓</div>
                                        <div>
                                            <p className="text-sm font-bold text-emerald-700">¡Listo!</p>
                                            <p className="text-xs text-zinc-500">La pantalla de turnos aparecerá <b>automáticamente</b>. Puedes poner la TV en pantalla completa presionando <b>F11</b></p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* === CELULAR / APP MÓVIL === */}
                            <div className="bg-zinc-50 rounded-2xl border border-zinc-100 overflow-hidden">
                                <div className="flex items-center gap-3 p-4 border-b border-zinc-100" style={{ backgroundColor: '#edf2fe' }}>
                                    <div className="p-2 rounded-xl bg-white shadow-sm">
                                        <Smartphone className="w-6 h-6" style={{ color: theme.primary }} />
                                    </div>
                                    <div>
                                        <h3 className="font-black text-sm" style={{ color: theme.dark }}>📱 App Móvil NextCall</h3>
                                        <p className="text-[10px] text-zinc-500">Para gestionar turnos desde el celular</p>
                                    </div>
                                </div>
                                <div className="p-5 space-y-4">
                                    <div className="flex gap-3 items-start">
                                        <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-white font-black text-sm shadow" style={{ backgroundColor: theme.primary }}>1</div>
                                        <div>
                                            <p className="text-sm font-bold" style={{ color: theme.dark }}>Conecta el celular al WiFi</p>
                                            <p className="text-xs text-zinc-500">Ve a Configuración → WiFi en tu celular y conéctate a la <b>misma red</b> que esta computadora</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-3 items-start">
                                        <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-white font-black text-sm shadow" style={{ backgroundColor: theme.primary }}>2</div>
                                        <div>
                                            <p className="text-sm font-bold" style={{ color: theme.dark }}>Abre la app NextCall</p>
                                            <p className="text-xs text-zinc-500">Abre la aplicación <b>NextCall</b> en tu celular Android. Si no la tienes, descárgala primero</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-3 items-start">
                                        <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-white font-black text-sm shadow" style={{ backgroundColor: theme.primary }}>3</div>
                                        <div>
                                            <p className="text-sm font-bold" style={{ color: theme.dark }}>Ingresa solo la IP (sin http)</p>
                                            <p className="text-xs text-zinc-500">En el campo de conexión, escribe solo: <b className="text-[#456df2] text-sm">{serverUrl.replace('http://', '').replace(':3000', '')}</b></p>
                                            <p className="text-[10px] text-zinc-400 mt-1">💡 Solo los números y puntos, sin "http://" ni ":3000"</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-3 items-start">
                                        <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-white font-black text-sm shadow" style={{ backgroundColor: theme.primary }}>4</div>
                                        <div>
                                            <p className="text-sm font-bold" style={{ color: theme.dark }}>Presiona "CONECTAR"</p>
                                            <p className="text-xs text-zinc-500">Si todo está correcto, verás el mensaje <b>"Conectado"</b> y podrás gestionar los turnos</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-3 items-start">
                                        <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-white font-black text-sm shadow bg-emerald-500">✓</div>
                                        <div>
                                            <p className="text-sm font-bold text-emerald-700">¡Listo!</p>
                                            <p className="text-xs text-zinc-500">Ya puedes crear, llamar y completar turnos desde tu celular</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* SECCIÓN DE SOLUCIÓN DE PROBLEMAS */}
                        <details className="mb-6 bg-amber-50 rounded-2xl border border-amber-200 overflow-hidden">
                            <summary className="flex items-center gap-2 p-4 cursor-pointer hover:bg-amber-100 transition">
                                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                                <span className="font-bold text-sm text-amber-800">¿No se conecta? — Toca aquí para ver soluciones</span>
                            </summary>
                            <div className="px-5 pb-5 space-y-3">
                                <div className="bg-white p-4 rounded-xl border border-amber-100">
                                    <p className="text-xs font-bold text-amber-700 mb-1">📶 ¿Están en la misma red WiFi?</p>
                                    <p className="text-xs text-zinc-600">Verifica que la PC, la TV y el celular estén conectados <b>al mismo WiFi</b>. Si estás en un lugar con varias redes (ej: "WiFi-Oficina" y "WiFi-Invitados"), todos deben estar en la <b>misma</b>.</p>
                                </div>
                                <div className="bg-white p-4 rounded-xl border border-amber-100">
                                    <p className="text-xs font-bold text-amber-700 mb-1">🛡️ ¿El Firewall bloquea la conexión?</p>
                                    <p className="text-xs text-zinc-600">El instalador configura esto automáticamente, pero si no funciona, pídele a alguien de sistemas que ejecute esto en <b>PowerShell como Administrador</b>:</p>
                                    <code className="block bg-zinc-900 text-green-400 text-[10px] p-2 rounded-lg mt-2 font-mono break-all">netsh advfirewall firewall add rule name="NextCall" dir=in action=allow protocol=TCP localport=3000 profile=any</code>
                                </div>
                                <div className="bg-white p-4 rounded-xl border border-amber-100">
                                    <p className="text-xs font-bold text-amber-700 mb-1">🔄 ¿La IP cambió?</p>
                                    <p className="text-xs text-zinc-600">Si reiniciaste el router o la computadora, la IP puede cambiar. <b>Cierra y abre NextCall</b> en la PC para ver la nueva IP, y actualízala en la TV y el celular.</p>
                                </div>
                                <div className="bg-white p-4 rounded-xl border border-amber-100">
                                    <p className="text-xs font-bold text-amber-700 mb-1">🏢 ¿Estás en un hotel o red de empresa?</p>
                                    <p className="text-xs text-zinc-600">Algunas redes empresariales o de hotel no permiten que los dispositivos se comuniquen entre sí. Solución: usa un <b>router WiFi propio</b> (portátil) conectado a la red del lugar.</p>
                                </div>
                                <div className="bg-white p-4 rounded-xl border border-amber-100">
                                    <p className="text-xs font-bold text-amber-700 mb-1">🔒 ¿Tienes antivirus como Kaspersky, Norton o ESET?</p>
                                    <p className="text-xs text-zinc-600">Estos antivirus tienen su propio firewall que puede bloquear NextCall. Agrega <b>NextCall Enterprise.exe</b> a las excepciones del antivirus.</p>
                                </div>
                            </div>
                        </details>

                        <button onClick={() => setShowConnectModal(false)} className="w-full text-white px-8 py-4 rounded-2xl font-bold hover:opacity-90 transition shadow-lg" style={{ backgroundColor: theme.dark }}>
                            Entendido, Cerrar
                        </button>
                    </div>
                </div>
            )}

            {/* SIDEBAR */}
            <aside className="w-72 bg-white border-r border-zinc-200 flex flex-col justify-between z-10">
                <div>
                    {/* Header / Logo */}
                    <div className="p-8 text-center border-b border-zinc-50">
                        {config.restaurant_logo ? (
                            <img src={config.restaurant_logo} className="h-16 mx-auto object-contain mb-2" />
                        ) : (
                            <h1 className="text-3xl font-black tracking-tight" style={{ color: theme.primary }}>NextCall</h1>
                        )}
                        <span className="text-[10px] font-bold bg-[#edf2fe] px-2 py-1 rounded text-[#456df2]">ADMIN v2.0</span>
                    </div>

                    {/* WIDGET MÉTRICAS (Estilo NextCall Dark) */}
                    <div className="m-6 p-5 rounded-2xl text-white shadow-xl relative overflow-hidden" style={{ backgroundColor: theme.dark }}>
                        <div className="absolute top-0 right-0 w-24 h-24 bg-[#456df2] rounded-full blur-3xl -mr-10 -mt-10 opacity-40"></div>
                        <div className="flex items-center gap-2 mb-4 border-b border-white/10 pb-3 relative z-10">
                            <BarChart3 className="w-4 h-4 text-[#456df2]" />
                            <span className="text-xs font-bold uppercase text-zinc-300">Resumen</span>
                        </div>
                        <div className="flex justify-between items-end relative z-10">
                            <div><p className="text-3xl font-black">{metrics.totalServed}</p><p className="text-[10px] uppercase text-zinc-400">Atendidos</p></div>
                            <div className="w-px h-8 bg-white/20"></div>
                            <div><p className="text-xl font-bold text-[#456df2]">{metrics.avgWaitTime}</p><p className="text-[10px] uppercase text-zinc-400">Espera</p></div>
                        </div>
                    </div>

                    <nav className="px-4 space-y-2">
                        <button
                            onClick={() => setShowConnectModal(true)}
                            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition duration-200"
                            style={{ color: theme.primary, backgroundColor: '#edf2fe' }}
                        >
                            <Cast className="w-5 h-5" /> ¿Cómo Conecto?
                        </button>
                        <div className="flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-zinc-400 border border-zinc-100 cursor-default">
                            <Users className="w-5 h-5" /> Caja Principal
                        </div>
                    </nav>
                </div>

                <div className="p-4 border-t border-zinc-100">
                    <button onClick={() => setShowSettings(true)} className="w-full flex items-center justify-center gap-2 text-zinc-500 hover:text-[#000033] font-bold py-4 hover:bg-zinc-50 rounded-xl transition">
                        <Settings className="w-5 h-5" /> Configuración
                    </button>
                </div>
            </aside>

            {/* WORKSPACE */}
            <main className="flex-1 flex flex-col p-10 bg-zinc-50/50">
                <div className="flex justify-between items-end mb-6">
                    <div>
                        <h2 className="text-4xl font-black" style={{ color: theme.dark }}>Gestión de Turnos</h2>
                        <p className="text-zinc-400 font-medium mt-1">Control de flujo y llamados</p>

                        {/* BOTONERA PRINCIPAL */}
                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={generateTurn}
                                className="text-white px-6 py-4 rounded-2xl font-bold flex gap-2 items-center shadow-xl shadow-blue-200 active:scale-95 transition hover:brightness-110"
                                style={{ backgroundColor: theme.primary }}
                            >
                                <Plus className="w-6 h-6" strokeWidth={3} /> Ticket Nuevo
                            </button>

                            <button
                                onClick={() => setShowManualModal(true)}
                                className="bg-white border-2 border-zinc-100 px-6 py-4 rounded-2xl font-bold flex gap-2 items-center shadow-sm hover:border-[#456df2] hover:text-[#456df2] active:scale-95 transition"
                                style={{ color: theme.dark }}
                            >
                                <Keyboard className="w-6 h-6" /> Manual
                            </button>
                        </div>
                    </div>

                    {/* TURNO ACTIVO ACTUAL */}
                    {activeTurn && (
                        <div className="bg-white border-2 border-[#edf2fe] p-4 rounded-2xl shadow-xl flex items-center gap-6 animate-in slide-in-from-right">
                            <div>
                                <p className="text-xs font-bold text-zinc-400 uppercase">Atendiendo Ahora</p>
                                <p className="text-4xl font-black" style={{ color: theme.primary }}>{activeTurn.code}</p>
                            </div>
                            <button onClick={handleRecall} className="text-white p-4 rounded-xl hover:opacity-90 transition shadow-lg" style={{ backgroundColor: theme.dark }} title="Volver a llamar">
                                <Mic className="w-6 h-6" />
                            </button>
                        </div>
                    )}
                </div>

                {/* PESTAÑAS DE NAVEGACIÓN */}
                <div className="flex gap-6 border-b border-zinc-200 mb-4">
                    <button
                        onClick={() => setActiveTab('waiting')}
                        className={`pb-3 px-2 font-bold flex items-center gap-2 transition-all text-sm uppercase tracking-wide ${activeTab === 'waiting' ? 'border-b-4' : 'text-zinc-400 hover:text-zinc-600'}`}
                        style={activeTab === 'waiting' ? { color: theme.dark, borderColor: theme.primary } : {}}
                    >
                        <List className="w-5 h-5" /> En Espera <span className="bg-zinc-100 text-zinc-600 px-2 rounded-full text-xs py-0.5 ml-1">{waitingList.length}</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('history')}
                        className={`pb-3 px-2 font-bold flex items-center gap-2 transition-all text-sm uppercase tracking-wide ${activeTab === 'history' ? 'border-b-4' : 'text-zinc-400 hover:text-zinc-600'}`}
                        style={activeTab === 'history' ? { color: theme.dark, borderColor: theme.primary } : {}}
                    >
                        <History className="w-5 h-5" /> Historial <span className="bg-zinc-100 text-zinc-600 px-2 rounded-full text-xs py-0.5 ml-1">{historyList.length}</span>
                    </button>
                </div>

                {/* CONTENIDO DE LA LISTA */}
                <div className="flex-1 overflow-y-auto pr-2 space-y-2 pb-10 custom-scrollbar">

                    {/* VISTA 1: ESPERA */}
                    {activeTab === 'waiting' && (
                        <>
                            {waitingList.length === 0 && !activeTurn && (
                                <div className="h-64 flex flex-col items-center justify-center border-3 border-dashed border-zinc-200 rounded-3xl opacity-60">
                                    <div className="p-4 rounded-full bg-zinc-50 mb-3">
                                        <List className="w-8 h-8 text-zinc-300" />
                                    </div>
                                    <p className="text-zinc-400 font-bold text-lg">Sin clientes en espera</p>
                                    <p className="text-zinc-300 text-sm">Todo tranquilo por ahora.</p>
                                </div>
                            )}

                            {/* Primero el activo */}
                            {activeTurn && (
                                <TurnCard key={activeTurn.id} turn={activeTurn} index={0} color={dynamicColor} isActive={true} onCall={handleCall} onRecall={handleRecall} onFinish={finishTurn} />
                            )}

                            {/* Luego los que esperan */}
                            {waitingList.map((turn, index) => (
                                <TurnCard key={turn.id} turn={turn} index={index} color={dynamicColor} onCall={handleCall} onRecall={handleRecall} onFinish={finishTurn} />
                            ))}
                        </>
                    )}

                    {/* VISTA 2: HISTORIAL */}
                    {activeTab === 'history' && (
                        <>
                            {historyList.length === 0 && (
                                <div className="h-64 flex flex-col items-center justify-center border-3 border-dashed border-zinc-200 rounded-3xl opacity-60">
                                    <div className="p-4 rounded-full bg-zinc-50 mb-3">
                                        <History className="w-8 h-8 text-zinc-300" />
                                    </div>
                                    <p className="text-zinc-400 font-bold text-lg">Historial vacío</p>
                                </div>
                            )}

                            {historyList.map((turn, index) => (
                                <TurnCard
                                    key={turn.id}
                                    turn={turn}
                                    index={index}
                                    color={dynamicColor}
                                    onCall={handleCall}
                                    onRecall={handleRecall}
                                    onFinish={finishTurn}
                                    isHistory={true}
                                />
                            ))}
                        </>
                    )}
                </div>
            </main>
        </div>
    );
}