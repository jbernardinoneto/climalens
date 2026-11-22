import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { ListFilter, ArrowLeft, Save, Settings2, X, AlertCircle, Plus, Trash2, Tags } from 'lucide-react';

const DIMENSOES_PADRAO = [
    "Estrutura", "Responsabilidade", "Reconhecimento", 
    "Padrões", "Apoio", "Comprometimento" 
];

export default function Categorizacao() {
  const datasets = useLiveQuery(() => db.datasets.toArray());
  const [datasetAtivo, setDatasetAtivo] = useState(null);
  const [mapeamento, setMapeamento] = useState({});
  const [colunas, setColunas] = useState([]);
  
  // Estados do Modal de Agrupamento
  const [modalAberto, setModalAberto] = useState(false);
  const [colunaEmEdicao, setColunaEmEdicao] = useState(null);
  const [valoresUnicos, setValoresUnicos] = useState([]);

  // Estados do Modal de Dimensões
  const [modalDimensoesAberto, setModalDimensoesAberto] = useState(false);
  const [novaDimensao, setNovaDimensao] = useState("");
  
  // Carrega as dimensões do LocalStorage (Global) ou usa o Padrão
  const [dimensoes, setDimensoes] = useState(() => {
    const salvas = localStorage.getItem('climalens_dimensoes_v2');
    return salvas ? JSON.parse(salvas) : DIMENSOES_PADRAO;
  });

  // Salva dimensões no LocalStorage sempre que mudarem (para novos datasets)  
  useEffect(() => {
    if (datasetAtivo && datasetAtivo.dados.length > 0) {
      const todasColunas = Object.keys(datasetAtivo.dados[0]);
      const estadoColunas = datasetAtivo.estadoLimpeza?.colunasAtivas || {};
      const colunasValidas = todasColunas.filter(coluna => estadoColunas[coluna] !== false);
      setColunas(colunasValidas);
      
      // 1. Carrega o mapeamento
      const mapaSalvo = datasetAtivo.mapeamento || datasetAtivo.estadoCategorizacao?.mapeamento || {};
      setMapeamento(mapaSalvo);

      // 2. RECUPERAÇÃO AUTOMÁTICA (SELF-HEALING)
      // Captura dimensões previamente salvas na lista oficial
      const dimensoesSalvas = datasetAtivo.estadoCategorizacao?.dimensoes || [];
      
      // Varre o mapeamento para extrair dimensões que estão associadas, mas que possam estar fora da lista
      const dimensoesEmUso = Object.values(mapaSalvo)
        .filter(m => m.tipo === 'dim' && m.valor)
        .map(m => m.valor);

      // Une as dimensões padrão, as salvas e as em uso, removendo qualquer duplicidade
      const dimensoesUnificadas = [...new Set([...DIMENSOES_PADRAO, ...dimensoesSalvas, ...dimensoesEmUso])];
      
      setDimensoes(dimensoesUnificadas);
    }
  }, [datasetAtivo]);

  const handleMapeamento = (coluna, tipo, valor = null) => {
    setMapeamento(prev => ({
      ...prev,
      [coluna]: { tipo, valor, agrupamentos: prev[coluna]?.agrupamentos || {} }
    }));
  };

  // Salva o Mapeamento E AS DIMENSÕES no banco de dados
  const salvarMapeamento = async () => {
    if (datasetAtivo) {
      await db.datasets.update(datasetAtivo.id, { 
        mapeamento, 
        estadoCategorizacao: { 
          mapeamento, 
          dimensoes // <-- CORREÇÃO: As dimensões agora são salvas junto com o mapa!
        } 
      });
      alert("Mapeamento e dimensões salvos com sucesso!");
    }
  };

  // --- Funções de Agrupamento de Respostas ---
  const abrirModalAgrupamento = (coluna) => {
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
      
      if (novoValor.trim() === "") delete agrupamentosAtuais[valorOriginal]; 
      else agrupamentosAtuais[valorOriginal] = novoValor.trim(); 

      mapeamentoAtual[colunaEmEdicao].agrupamentos = agrupamentosAtuais;
      return mapeamentoAtual;
    });
  };

  // --- Funções de Gestão de Dimensões ---
  const adicionarDimensao = () => {
    const nome = novaDimensao.trim();
    if (nome && !dimensoes.includes(nome)) {
      setDimensoes([...dimensoes, nome]);
      setNovaDimensao("");
    }
  };

  const removerDimensao = (dimParaRemover) => {
    if (window.confirm(`Tem certeza que deseja apagar a dimensão "${dimParaRemover}"? As colunas associadas a ela perderão o mapeamento.`)) {
      setDimensoes(dimensoes.filter(d => d !== dimParaRemover));
      
      // Limpa o mapeamento das colunas que usavam esta dimensão
      setMapeamento(prev => {
        const novoMap = { ...prev };
        Object.keys(novoMap).forEach(col => {
          if (novoMap[col].tipo === 'dim' && novoMap[col].valor === dimParaRemover) {
            novoMap[col] = { tipo: '', valor: null, agrupamentos: novoMap[col].agrupamentos };
          }
        });
        return novoMap;
      });
    }
  };

  if (!datasetAtivo) {
    return (
      <div className="space-y-8">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Tags className="text-blue-600" /> Definição de Variáveis
        </h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {datasets?.map((dataset) => (
            <div key={dataset.id} onClick={() => setDatasetAtivo(dataset)} className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-[#00b4d8] transition-all cursor-pointer">
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
        
        <div className="flex items-center gap-3">
          <button onClick={() => setModalDimensoesAberto(true)} className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors shadow-sm">
            <Tags size={18} /> Dimensões
          </button>
          <button onClick={salvarMapeamento} className="flex items-center gap-2 px-6 py-2 bg-[#0a2540] text-white font-medium rounded-lg hover:bg-opacity-90 transition-colors shadow-sm">
            <Save size={18} /> Salvar Mapeamento
          </button>
        </div>
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
              const mapInfo = mapeamento[coluna] || { tipo: '' };
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
                        mapInfo.tipo === 'dim' ? 'bg-[#00b4d8]/10 border-[#00b4d8]/30 text-[#0a2540]' :
                        'bg-gray-50 border-gray-200 text-gray-500'
                      }`}
                    >
                      <option value="" disabled>Selecione uma classificação...</option>
                      <option value="demo">Variável Demográfica</option>
                      <optgroup label="Dimensões do Clima">
                        {dimensoes.map(dim => (
                          <option key={dim} value={`dim-${dim}`}>{dim}</option>
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

      {/* MODAL DE GERENCIAMENTO DE DIMENSÕES */}
      {modalDimensoesAberto && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden">
            <div className="p-5 border-b border-gray-200 flex justify-between items-center bg-gray-50">
              <h3 className="text-lg font-bold text-[#0a2540] flex items-center gap-2">
                <Tags size={20} className="text-[#00b4d8]" /> Gerenciar Dimensões
              </h3>
              <button onClick={() => setModalDimensoesAberto(false)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-lg transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="p-5 overflow-y-auto flex-1 bg-white">
              <div className="flex gap-2 mb-6">
                <input
                  type="text"
                  placeholder="Nova dimensão (ex: Inovação)"
                  value={novaDimensao}
                  onChange={(e) => setNovaDimensao(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && adicionarDimensao()}
                  className="flex-1 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00b4d8] outline-none text-sm"
                />
                <button 
                  onClick={adicionarDimensao}
                  disabled={!novaDimensao.trim()}
                  className="px-4 py-2 bg-[#00b4d8] text-white font-medium rounded-lg hover:bg-opacity-90 disabled:opacity-50 transition-colors flex items-center gap-1"
                >
                  <Plus size={18} /> Adicionar
                </button>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Dimensões Disponíveis</p>
                {dimensoes.map((dim) => (
                  <div key={dim} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
                    <span className="font-medium text-gray-700">{dim}</span>
                    <button 
                      onClick={() => removerDimensao(dim)}
                      className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                      title="Apagar dimensão"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE AGRUPAMENTO */}
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
                <p>Escreva o novo nome ao lado da resposta original. Respostas com mesmo nome são unificadas.</p>
              </div>
              <div className="space-y-3">
                {valoresUnicos.map((valorOriginal) => {
                  const valorAtual = mapeamento[colunaEmEdicao]?.agrupamentos?.[valorOriginal] || '';
                  return (
                    <div key={valorOriginal} className="flex items-center gap-4 bg-gray-50 p-3 rounded-lg border border-gray-100">
                      <div className="flex-1 truncate font-medium text-gray-700" title={valorOriginal}>{valorOriginal}</div>
                      <div className="text-gray-400 shrink-0">➜</div>
                      <div className="flex-1">
                        <input type="text" placeholder="Manter original" value={valorAtual} onChange={(e) => atualizarAgrupamento(valorOriginal, e.target.value)} className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-sm" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end">
              <button onClick={() => setModalAberto(false)} className="px-6 py-2 bg-[#0a2540] text-white font-medium rounded-lg hover:bg-opacity-90">Concluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}