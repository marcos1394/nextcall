import { Mic, Check, Repeat, RotateCcw } from 'lucide-react';

interface TurnCardProps {
  turn: { id: number; code: string; status: string };
  index: number;
  color: string; // Este será el azul #456df2
  onCall: (id: number, code: string) => void;
  onRecall: (id: number, code: string) => void;
  onFinish: (id: number) => void;
  isActive?: boolean;
  isHistory?: boolean;
}

export default function TurnCard({ turn, index, onCall, onRecall, onFinish, isActive, isHistory }: TurnCardProps) {
  
  // Colores NextCall
  const theme = {
      primary: '#456df2',
      dark: '#000033',
  };

  // Estilos dinámicos según el estado
  let borderColor = 'border-zinc-100';
  let shadow = '';
  let scale = '';
  let bgColor = 'bg-white';

  if (isActive) {
      borderColor = `border-[#456df2] border-2`;
      shadow = 'shadow-xl shadow-blue-100';
      scale = 'scale-[1.02]';
  } else if (isHistory) {
      borderColor = 'border-zinc-200 opacity-60 hover:opacity-100';
      bgColor = 'bg-zinc-50';
  } else {
      // Normal (En espera)
      borderColor = 'border-zinc-200 hover:border-[#456df2]';
  }

  return (
    <div className={`${bgColor} p-4 rounded-2xl border-2 ${borderColor} ${shadow} ${scale} flex justify-between items-center transition-all duration-300 mb-3`}>
        <div className="flex items-center gap-6">
            {/* Número Gigante */}
            <div 
                className={`w-20 h-20 rounded-2xl flex items-center justify-center text-3xl font-black border-4 transition-colors`}
                style={
                    isHistory 
                    ? { backgroundColor: '#f4f4f5', color: '#a1a1aa', borderColor: '#e4e4e7' } // Gris apagado
                    : isActive 
                        ? { backgroundColor: '#fff', color: theme.primary, borderColor: theme.primary } // Azul NextCall
                        : { backgroundColor: '#fff', color: theme.dark, borderColor: '#edf2fe' } // Navy Oscuro con borde suave
                }
            >
                {turn.code}
            </div>
            
            <div>
                {/* Badge de Estado */}
                <span 
                    className={`text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider ${
                        isActive 
                        ? 'bg-blue-100 text-[#456df2]' 
                        : isHistory 
                            ? 'bg-zinc-200 text-zinc-500' 
                            : 'bg-[#edf2fe] text-[#000033]'
                    }`}
                >
                    {isActive ? 'Atendiendo' : isHistory ? 'Finalizado' : 'En Espera'}
                </span>
                
                <p className="text-zinc-400 text-sm mt-1 font-bold">Ticket #{turn.id}</p>
                {!isActive && !isHistory && <p className="text-zinc-400 text-xs mt-1">Posición: <span className="text-[#000033] font-black">{index + 1}</span></p>}
            </div>
        </div>

        <div className="flex items-center gap-2">
            {isHistory ? (
                // BOTÓN REACTIVAR (Para historial)
                <button 
                    onClick={() => onCall(turn.id, turn.code)} 
                    className="text-zinc-500 bg-white border-2 border-zinc-200 px-4 py-3 rounded-xl font-bold flex gap-2 items-center hover:bg-white hover:text-[#456df2] hover:border-[#456df2] transition shadow-sm"
                    title="Volver a llamar (Reactivar)"
                >
                    <RotateCcw className="w-4 h-4"/> <span className="hidden sm:inline">REACTIVAR</span>
                </button>
            ) : isActive ? (
                // BOTÓN REPETIR (Para activo)
                <button 
                    onClick={() => onRecall(turn.id, turn.code)} 
                    className="text-white px-6 py-3 rounded-xl font-bold flex gap-2 items-center hover:opacity-90 transition shadow-lg"
                    style={{ backgroundColor: theme.dark }}
                >
                    <Repeat className="w-4 h-4"/> REPETIR
                </button>
            ) : (
                // BOTÓN LLAMAR (Para espera)
                <button 
                    onClick={() => onCall(turn.id, turn.code)} 
                    className="text-white px-6 py-3 rounded-xl font-bold flex gap-2 items-center shadow-lg hover:shadow-blue-200 hover:-translate-y-0.5 transition"
                    style={{ backgroundColor: theme.primary }}
                >
                    <Mic className="w-4 h-4"/> LLAMAR
                </button>
            )}
            
            {/* Botón Finalizar (Solo visible si NO es historial) */}
            {!isHistory && (
                <button 
                    onClick={() => onFinish(turn.id)} 
                    className="p-3 text-zinc-400 bg-white hover:bg-red-50 hover:text-red-500 border-2 border-zinc-100 hover:border-red-200 rounded-xl transition shadow-sm"
                    title="Finalizar Turno"
                >
                    <Check className="w-5 h-5"/>
                </button>
            )}
        </div>
    </div>
  );
}