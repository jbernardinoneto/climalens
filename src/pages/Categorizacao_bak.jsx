import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { ListFilter, ArrowLeft, Save, Settings2, X, AlertCircle } from 'lucide-react';

const DIMENSOES_CLIMA = [
  "Estrutura", "Responsabilidade", "Desafio", "Recompensa", 
  "Relacionamento", "Cooperação", "Conflito", "Identidade", "Padrões"
];

export default function Categorizacao() {
  const datasets = useLiveQuery(() => db.datasets.toArray());
  const [datasetAtivo, setDatasetAtivo] = useState(null);
  const [mapeamento, setMapeamento] = useState({});
  const [colunas, setColunas] = useState([]);
  
  // Estados para o Modal de Agrupamento
  const [modalAberto, setModalAberto] = useState(false);
  const [colunaEmEdicao, setColunaEmEdicao] = useState(null);
  const [valoresUnicos, setValoresUnicos] = useState([]);

  useEffect(() => {
    if (datasetAtivo && datasetAtivo.dados.length > 0) {
      setColunas(Object.keys(datasetAtivo.dados[0]));
      setMapeamento(datasetAtivo.mapeamento || {});
    }
  }, [datasetAtivo]);

  const handleMapeamento = (coluna, tipo, valor = null) => {
    setMapeamento(prev => ({
      ...prev,
      [coluna]: { 
        tipo, 
        valor, 
        // Preserva os agrupamentos se já existirem
        agrupamentos: prev[coluna]?.agrupamentos || {} 
      }
    }));
  };

  const salvarMapeamento = async () => {
    if (datasetAtivo) {
      await db.datasets.update(datasetAtivo.id, { mapeamento });
      alert("Mapeamento salvo com sucesso!");
    }
  };

  // --- LÓGICA DO MODAL DE AGRUPAMENTO ---
  const abrirModalAgrupamento = (coluna) => {
    // Extrai todos os valores únicos desta coluna na planilha
    const unicos = [...new Set(datasetAtivo.dados.map(item => item[coluna]).filter(Boolean))];
    setValoresUnicos(unicos.sort());
    setColunaEmEdicao(coluna);
    setModalAberto(true);
  };

  const atualizarAgrupamento = (valorOriginal, novoValor) => {
    setMapeamento(prev => {
      const mapeamentoAtual = { ...prev };
      if (!mapeamentoAtual[colunaEmEdicao]) return prev;

      const agrupamentosAtuais = { ...(mapeamentoAtual[colunaEmEdicao].agrupamentos || {}) };
      
      if (novoValor.trim() === "") {
        delete agrupamentosAtuais[valorOriginal]; // Remove a regra se ficar vazio
      } else {
        agrupamentosAtuais[valorOriginal] = novoValor.trim(); // Adiciona a regra de substituição
      }

      mapeamentoAtual[colunaEmEdicao].agrupamentos = agrupamentosAtuais;
      return mapeamentoAtual;
    });
  };

  if (!datasetAtivo) {
    return (
      <div className="space-y-8">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <ListFilter className="text-[#0a2540]" /> Categorização de Variáveis
        </h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {datasets?.map((dataset) => (
            <div key={dataset.id} onClick={() => setDatasetAtivo(dataset)} className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-cyan-500 transition-all cursor-pointer">
              <h3 className="font-bold text-[#0a2540] text-lg truncate">{dataset.nome}</h3>
              <p className="text-sm text-gray-500 mt-2">Mapear colunas e perguntas</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12 relative">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-4">
        <div className="flex items-center gap-4">
          <button onClick={() => setDatasetAtivo(null)} className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-2xl font-bold text-[#0a2540]">Categorizar: {datasetAtivo.nome}</h1>
        </div>
        <button onClick={salvarMapeamento} className="flex items-center gap-2 px-6 py-2 bg-[#0a2540] text-white font-medium rounded-lg hover:bg-opacity-90 transition-colors shadow-sm">
          <Save size={18} /> Salvar Mapeamento
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="p-4 font-semibold text-gray-700">Coluna Original (Planilha)</th>
              <th className="p-4 font-semibold text-gray-700">Classificação</th>
              <th className="p-4 font-semibold text-gray-700 w-48">Ações Avançadas</th>
            </tr>
          </thead>
          <tbody>
            {colunas.map((coluna) => {
              const mapInfo = mapeamento[coluna] || { tipo: 'ignorar' };
              const isDemo = mapInfo.tipo === 'demo';
              
              return (
                <tr key={coluna} className="border-b border-gray-100 hover:bg-slate-50 transition-colors">
                  <td className="p-4 text-gray-800 font-medium truncate max-w-md" title={coluna}>{coluna}</td>
                  <td className="p-4">
                    <select
                      value={mapInfo.tipo === 'dim' ? `dim-${mapInfo.valor}` : mapInfo.tipo}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val.startsWith('dim-')) handleMapeamento(coluna, 'dim', val.replace('dim-', ''));
                        else handleMapeamento(coluna, val);
                      }}
                      className={`w-full p-2 border rounded-lg outline-none transition-colors ${
                        isDemo ? 'bg-purple-50 border-purple-200 text-purple-700' :
                        mapInfo.tipo === 'dim' ? 'bg-cyan-50 border-cyan-200 text-cyan-700' :
                        'bg-gray-50 border-gray-200 text-gray-500'
                      }`}
                    >
                      <option value="ignorar">Ignorar (Não usar)</option>
                      <option value="demo">👤 Variável Demográfica (Idade, Lotação, etc)</option>
                      <optgroup label="Dimensões do Clima (Litwin & Stringer)">
                        {DIMENSOES_CLIMA.map(dim => (
                          <option key={dim} value={`dim-${dim}`}>📊 {dim}</option>
                        ))}
                      </optgroup>
                    </select>
                  </td>
                  <td className="p-4 text-center">
                    {isDemo && (
                      <button 
                        onClick={() => abrirModalAgrupamento(coluna)}
                        className="flex items-center justify-center gap-2 px-3 py-1.5 w-full bg-purple-100 hover:bg-purple-200 text-purple-700 rounded-lg text-sm font-medium transition-colors"
                      >
                        <Settings2 size={16} /> 
                        {Object.keys(mapInfo.agrupamentos || {}).length > 0 ? 'Editar Regras' : 'Agrupar'}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* MODAL DE AGRUPAMENTO DE DADOS */}
      {modalAberto && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
            
            <div className="p-5 border-b border-gray-200 flex justify-between items-center bg-gray-50">
              <div>
                <h3 className="text-lg font-bold text-[#0a2540]">Agrupar Respostas</h3>
                <p className="text-sm text-gray-500">Variável: <span className="font-semibold text-purple-600">{colunaEmEdicao}</span></p>
              </div>
              <button onClick={() => setModalAberto(false)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-lg transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="p-5 overflow-y-auto flex-1">
              <div className="flex items-start gap-3 p-3 bg-blue-50 text-blue-800 rounded-lg mb-6 text-sm">
                <AlertCircle size={20} className="shrink-0 mt-0.5" />
                <p>Escreva o novo nome ao lado da resposta original para unificá-las. Exemplo: Para transformar "Anexo I" em "Sede", escreva <b>Sede</b> na caixa ao lado de Anexo I. Se deixar em branco, o nome original é mantido.</p>
              </div>

              <div className="space-y-3">
                {valoresUnicos.map((valorOriginal) => {
                  const valorAtual = mapeamento[colunaEmEdicao]?.agrupamentos?.[valorOriginal] || '';
                  return (
                    <div key={valorOriginal} className="flex items-center gap-4 bg-gray-50 p-3 rounded-lg border border-gray-100">
                      <div className="flex-1 truncate font-medium text-gray-700" title={valorOriginal}>
                        {valorOriginal}
                      </div>
                      <div className="text-gray-400 shrink-0">➜</div>
                      <div className="flex-1">
                        <input
                          type="text"
                          placeholder="Manter original"
                          value={valorAtual}
                          onChange={(e) => atualizarAgrupamento(valorOriginal, e.target.value)}
                          className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-sm"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end">
              <button onClick={() => setModalAberto(false)} className="px-6 py-2 bg-[#0a2540] text-white font-medium rounded-lg hover:bg-opacity-90">
                Concluir
              </button>
            </div>
            
          </div>
        </div>
      )}
    </div>
  );
}