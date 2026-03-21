import { HashRouter as Router, Routes, Route, Link } from 'react-router-dom';
import AdminPanel from '../src/pages/AdminPanel';
import DisplayScreen from '../src/pages/DisplayScreen';

function App(): JSX.Element {
  return (
    <Router>
      <Routes>
        {/* Ruta para la TV */}
        <Route path="/display" element={<DisplayScreen />} />
        
        {/* Ruta para el Admin (Cajero) */}
        <Route path="/admin" element={<AdminPanel />} />

        {/* Home temporal para elegir a dónde ir */}
        <Route path="/" element={<HomeMenu />} />
      </Routes>
    </Router>
  );
}

// Un menú simple para que entres a probar
function HomeMenu() {
  return (
    <div className="h-screen w-screen bg-slate-900 flex flex-col items-center justify-center gap-8 text-white">
      <h1 className="text-5xl font-bold tracking-tighter">RestTurnos <span className="text-blue-500">Pro</span></h1>
      <div className="flex gap-4">
        <Link to="/admin" className="px-8 py-4 bg-blue-600 rounded-xl font-bold hover:bg-blue-500 transition shadow-lg shadow-blue-500/30">
          Entrar como Admin
        </Link>
        <Link to="/display" className="px-8 py-4 bg-emerald-600 rounded-xl font-bold hover:bg-emerald-500 transition shadow-lg shadow-emerald-500/30">
          Abrir Pantalla TV
        </Link>
      </div>
    </div>
  )
}

export default App;