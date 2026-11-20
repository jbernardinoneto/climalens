import { HashRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import { Home, Configuracoes } from './pages/Pages';
import Dados from './pages/Dados';
import Limpeza from './pages/Limpeza';
import Categorizacao from './pages/Categorizacao';
import Processamento from './pages/Processamento';
import Resultados from './pages/Resultados';

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="dados" element={<Dados />} />
          <Route path="limpeza" element={<Limpeza />} />
          <Route path="categorizacao" element={<Categorizacao />} />
          <Route path="processamento" element={<Processamento />} />
          <Route path="resultados" element={<Resultados />} />
          <Route path="configuracoes" element={<Configuracoes />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}

export default App;