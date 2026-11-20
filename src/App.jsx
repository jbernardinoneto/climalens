import { HashRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import { 
  Home, Dados, Limpeza, Categorizacao, 
  Processamento, Resultados, Configuracoes 
} from './pages/Pages';

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