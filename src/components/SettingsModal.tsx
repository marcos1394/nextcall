/* eslint-disable @typescript-eslint/no-explicit-any */
import { useRef, useState } from 'react';
import { X, Palette, LayoutTemplate, Video, Upload, Image as ImageIcon, Link } from 'lucide-react';

interface SettingsModalProps {
  config: any;
  onClose: () => void;
  onSave: (key: string, value: string) => Promise<boolean>; 
}

export default function SettingsModal({ config, onClose, onSave }: SettingsModalProps) {
  // Estados locales
  const [menuUrl, setMenuUrl] = useState(config.menu_url || '');
  const [voiceMessage, setVoiceMessage] = useState(config.voice_message || 'Atención turno {{turno}}, favor de pasar a caja.');
  const [adMedia, setAdMedia] = useState(config.ad_image || '');
  const [isVideo, setIsVideo] = useState(config.ad_is_video === 'true'); 
  const [footerImage, setFooterImage] = useState(config.footer_image || '');
  const [logo, setLogo] = useState(config.restaurant_logo || '');
  const [brandColor, setBrandColor] = useState(config.brand_color || '#456df2');

  // Referencias
  const adInputRef = useRef<HTMLInputElement>(null);
  const footerInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Colores NextCall
  const theme = {
      primary: '#456df2',
      dark: '#000033',
  };

  // Manejador de Archivos (Imagen o Video)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, setter: (val: string) => void, isAd = false) => {
    const file = e.target.files?.[0];
    if (file) {
      const limit = file.type.startsWith('video') ? 20 * 1024 * 1024 : 5 * 1024 * 1024;
      
      if (file.size > limit) {
        alert("El archivo es muy pesado. Máximo 20MB para video / 5MB para imagen.");
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        setter(reader.result as string);
        if (isAd) {
            setIsVideo(file.type.startsWith('video'));
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    await onSave('menu_url', menuUrl);
    await onSave('voice_message', voiceMessage);
    await onSave('ad_image', adMedia); 
    await onSave('ad_is_video', String(isVideo)); 
    await onSave('footer_image', footerImage);
    await onSave('restaurant_logo', logo);
    await onSave('brand_color', brandColor);
    
    window.location.reload();
  };

  return (
    <div className="absolute inset-0 bg-[#000033]/90 z-50 flex items-center justify-center backdrop-blur-md animate-in fade-in duration-200">
        <div className="bg-white rounded-3xl shadow-2xl w-[60rem] max-h-[90vh] overflow-hidden flex flex-col border border-zinc-200">
            
            {/* HEADER */}
            <div className="flex justify-between items-center px-8 py-6 border-b border-zinc-100 bg-white sticky top-0 z-10">
                <div>
                    <h2 className="text-2xl font-black" style={{ color: theme.dark }}>Ajustes NextCall</h2>
                    <p className="text-sm text-zinc-400 font-medium">Personalice la apariencia de su pantalla.</p>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-zinc-100 rounded-full transition text-zinc-400 hover:text-zinc-600">
                    <X className="w-6 h-6"/>
                </button>
            </div>

            {/* CONTENIDO SCROLLABLE */}
            <div className="p-8 overflow-y-auto custom-scrollbar flex-1 bg-zinc-50/50">

                {/* SECCIÓN 1: MARCA */}
                <div className="mb-8">
                    <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-4 pl-1">Identidad Visual</h3>
                    <div className="grid grid-cols-2 gap-6">
                        {/* Logo */}
                        <div className="p-6 bg-white rounded-2xl border border-zinc-200 shadow-sm">
                            <label className="text-xs font-bold text-[#456df2] uppercase mb-4 block flex items-center gap-2">
                                <ImageIcon className="w-4 h-4"/> Logo Principal
                            </label>
                            <div className="flex items-center gap-4">
                                <div className="w-24 h-24 bg-zinc-50 rounded-xl border-2 border-dashed border-zinc-200 flex items-center justify-center overflow-hidden relative group">
                                    {logo ? <img src={logo} className="w-full h-full object-contain p-2"/> : <span className="text-[10px] text-zinc-400 font-bold uppercase">Sin Logo</span>}
                                    {logo && <button onClick={() => setLogo('')} className="absolute inset-0 bg-black/60 text-white text-xs font-bold opacity-0 group-hover:opacity-100 transition flex items-center justify-center">Eliminar</button>}
                                </div>
                                <div className="flex-1 flex flex-col gap-2">
                                    <input type="file" ref={logoInputRef} className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, setLogo)}/>
                                    <button onClick={() => logoInputRef.current?.click()} className="bg-[#edf2fe] text-[#456df2] px-4 py-2.5 rounded-xl text-xs font-bold hover:bg-[#dfe7fd] transition border border-[#456df2]/20">
                                        Subir Imagen (PNG)
                                    </button>
                                    <p className="text-[10px] text-zinc-400">Recomendado: Fondo transparente.</p>
                                </div>
                            </div>
                        </div>

                        {/* Color */}
                        <div className="p-6 bg-white rounded-2xl border border-zinc-200 shadow-sm">
                            <label className="text-xs font-bold text-[#456df2] uppercase mb-4 block flex gap-2 items-center">
                                <Palette className="w-4 h-4"/> Color de Marca
                            </label>
                            <div className="flex items-center gap-4">
                                <div className="relative overflow-hidden rounded-xl shadow-inner w-16 h-16 border border-zinc-200">
                                    <input type="color" value={brandColor} onChange={(e) => setBrandColor(e.target.value)} className="absolute -top-2 -left-2 w-24 h-24 cursor-pointer p-0 border-0"/>
                                </div>
                                <div>
                                    <p className="font-black text-lg uppercase tracking-wider" style={{ color: brandColor }}>{brandColor}</p>
                                    <p className="text-xs text-zinc-400 font-medium">Color principal del sistema.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* SECCIÓN 2: PUBLICIDAD */}
                <div className="mb-8">
                    <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-4 pl-1">Pantalla TV & Publicidad</h3>
                    <div className="grid grid-cols-2 gap-6">
                        {/* Ads Media */}
                        <div className="p-6 bg-white rounded-2xl border border-zinc-200 shadow-sm">
                            <label className="text-xs font-bold text-[#456df2] uppercase mb-4 flex gap-2 items-center">
                                <Video className="w-4 h-4"/> Publicidad (Full Screen)
                            </label>
                            
                            <div className="aspect-video bg-zinc-50 rounded-xl border-2 border-dashed border-zinc-200 flex items-center justify-center overflow-hidden relative mb-4 group hover:border-[#456df2]/50 transition">
                                {adMedia ? (
                                    isVideo ? (
                                        <video src={adMedia} className="w-full h-full object-cover" autoPlay loop muted />
                                    ) : (
                                        <img src={adMedia} className="w-full h-full object-cover" />
                                    )
                                ) : (
                                    <div className="text-center">
                                        <Upload className="w-8 h-8 text-zinc-300 mx-auto mb-2"/>
                                        <span className="text-xs text-zinc-400 font-bold uppercase">Vacío</span>
                                    </div>
                                )}
                                
                                {adMedia && <button onClick={() => setAdMedia('')} className="absolute inset-0 bg-black/60 text-white opacity-0 group-hover:opacity-100 font-bold text-xs transition flex items-center justify-center">Eliminar Medio</button>}
                            </div>

                            <input type="file" ref={adInputRef} className="hidden" accept="image/*,video/mp4,video/webm" onChange={(e) => handleFileUpload(e, setAdMedia, true)}/>
                            <button onClick={() => adInputRef.current?.click()} className="w-full bg-[#000033] text-white py-3 rounded-xl text-xs font-bold hover:opacity-90 transition shadow-lg shadow-indigo-100 flex justify-center gap-2 items-center">
                                <Upload className="w-3 h-3"/> Subir Foto o Video
                            </button>
                            <p className="text-[10px] text-zinc-400 mt-2 text-center">MP4 (Max 20MB) o JPG/PNG (Max 5MB)</p>
                        </div>

                        {/* Footer Banner */}
                        <div className="p-6 bg-white rounded-2xl border border-zinc-200 shadow-sm flex flex-col">
                             <label className="text-xs font-bold text-[#456df2] uppercase mb-4 flex gap-2 items-center">
                                <LayoutTemplate className="w-4 h-4"/> Banner Inferior
                             </label>
                             
                             <div className="h-28 bg-zinc-50 rounded-xl border-2 border-dashed border-zinc-200 flex items-center justify-center overflow-hidden relative mb-4 group hover:border-[#456df2]/50 transition flex-1">
                                {footerImage ? <img src={footerImage} className="w-full h-full object-cover" /> : (
                                    <div className="text-center">
                                        <Upload className="w-6 h-6 text-zinc-300 mx-auto mb-1"/>
                                        <span className="text-xs text-zinc-400 font-bold uppercase">Vacío</span>
                                    </div>
                                )}
                                {footerImage && <button onClick={() => setFooterImage('')} className="absolute inset-0 bg-black/60 text-white opacity-0 group-hover:opacity-100 font-bold text-xs transition flex items-center justify-center">Eliminar Banner</button>}
                             </div>

                             <input type="file" ref={footerInputRef} className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, setFooterImage)}/>
                             <button onClick={() => footerInputRef.current?.click()} className="w-full bg-white border-2 border-zinc-100 text-zinc-600 py-3 rounded-xl text-xs font-bold hover:border-[#456df2] hover:text-[#456df2] transition">
                                Subir Banner (JPG/PNG)
                             </button>
                        </div>
                    </div>
                </div>
            
                {/* SECCIÓN 3: MENÚ Y AUDIO */}
                <div className="grid grid-cols-2 gap-6 mb-8">
                    {/* Link QR Menú */}
                    <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm">
                        <label className="text-xs font-bold text-[#456df2] uppercase mb-3 block flex gap-2 items-center">
                            <Link className="w-4 h-4"/> Enlace PDF Menú (QR)
                        </label>
                        <div className="flex gap-2">
                            <input 
                                value={menuUrl} 
                                onChange={(e) => setMenuUrl(e.target.value)} 
                                className="flex-1 border-2 border-zinc-100 bg-zinc-50 p-3 rounded-xl text-sm font-medium focus:outline-none focus:border-[#456df2] transition text-zinc-700" 
                                placeholder="https://..."
                            />
                        </div>
                        <p className="text-[10px] text-zinc-400 mt-2 ml-1">Este enlace generará el código QR en la pantalla.</p>
                    </div>

                    {/* Mensaje de Voz (TTS) */}
                    <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm">
                        <label className="text-xs font-bold text-[#456df2] uppercase mb-3 block flex gap-2 items-center">
                            Mensaje de Voz (Llamado)
                        </label>
                        <div className="flex gap-2">
                            <input 
                                value={voiceMessage} 
                                onChange={(e) => setVoiceMessage(e.target.value)} 
                                className="flex-1 border-2 border-zinc-100 bg-zinc-50 p-3 rounded-xl text-sm font-medium focus:outline-none focus:border-[#456df2] transition text-zinc-700" 
                                placeholder="Atención turno {{turno}}"
                            />
                        </div>
                        <p className="text-[10px] text-zinc-400 mt-2 ml-1">
                            Usa la etiqueta <strong className="text-[#456df2]">{"{{turno}}"}</strong> donde desees que el asistente lea el número de ticket.
                        </p>
                    </div>
                </div>
            </div>

            {/* FOOTER ACTIONS */}
            <div className="flex justify-end gap-3 px-8 py-6 border-t border-zinc-100 bg-white z-10">
                <button onClick={onClose} className="px-6 py-3 text-zinc-500 font-bold hover:bg-zinc-50 rounded-xl transition">Cancelar</button>
                <button onClick={handleSave} className="text-white px-8 py-3 rounded-xl font-bold shadow-xl hover:brightness-110 transition" style={{ backgroundColor: brandColor }}>
                    Guardar Cambios
                </button>
            </div>
        </div>
    </div>
  );
}