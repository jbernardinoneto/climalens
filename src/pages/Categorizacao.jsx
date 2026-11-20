import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { Tags, ArrowLeft, Save, FileSpreadsheet, Plus, Trash2, ArrowRight, Settings2 } from 'lucide-react';

const DEMOGRAFICAS_PADRAO = [
  "Carimbo de data/hora", "Idade", "Sexo", 
  "Unidade de lotação", "Tempo de serviço no Tribunal", "Situação Funcional"
];

const DIMENSOES_PADRAO = [
  "Estrutura", "Responsabilidade", "Recompensa", 
  "Desafio", "Relacionamento", "Cooperação", 
  "Padrões", "Conflito", "Identidade"
];

export default function Categorizacao() {
  const { t } = useTranslation();
  const datasets = useLiveQuery(() => db.datasets.toArray());
  
  // Controle de Navegação: 'lista' | 'configuracao' | 'mapeamento'
  const [fase, setFase] = useState('lista'); 
  const [datasetAtivo, setDatasetAtivo] = useState(null);
  
  // Estado da Configuração
  const [demograficas, setDemograficas] = useState([]);
  const [dimensoes, setDimensoes] = useState([]);
  const [novaDemo, setNovaDemo] = useState('');
  const [novaDim, setNovaDim] = useState('');
  
  // Estado do Mapeamento
  const [mapeamento, setMapeamento] = useState({}); // { [nomeColuna]: { tipo: 'demo'|'dim', valor: 'Idade' } }
  const [salvando, setSalvando] = useState(false);

  // Inicializa o dataset, carregando configurações anteriores ou padrões
  const abrirDataset = (dataset) => {
    setDatasetAtivo(dataset);
    
    if (dataset.estadoCategorizacao) {
      setDemograficas(dataset.estadoCategorizacao.demograficas || DEMOGRAFICAS_PADRAO);
      setDimensoes(dataset.estadoCategorizacao.dimensoes || DIMENSOES_PADRAO);
      setMapeamento(dataset.estadoCategorizacao.mapeamento || {});
    } else {
      setDemograficas(DEMOGRAFICAS_PADRAO);
      setDimensoes(DIMENSOES_PADRAO);
      setMapeamento({});
    }
    
    setFase('configuracao');
  };

  // Funções de Edição das Variáveis
  const adicionarItem = (tipo) => {
    if (tipo === 'demo' && novaDemo.trim()) {
      if (!demograficas.includes(novaDemo.trim())) setDemograficas([...demograficas, novaDemo.trim()]);
      setNovaDemo('');
    } else if (tipo === 'dim' && novaDim.trim()) {
      if (!dimensoes.includes(novaDim.trim())) setDimensoes([...dimensoes, novaDim.trim()]);
      setNovaDim('');
    }
  };

  const removerItem = (tipo, valor) => {
    if (tipo === 'demo') setDemograficas(demograficas.filter(d => d !== valor));
    else setDimensoes(dimensoes.filter(d => d !== valor));
    
    // Remove do mapeamento se estiver em uso
    const novoMap = { ...mapeamento };
    Object.keys(novoMap).forEach(col => {
      if (novoMap[col]?.valor === valor) delete novoMap[col];
    });
    setMapeamento(novoMap);
  };

  // Prepara os dados filtrados (Ignora linhas e colunas desmarcadas na Limpeza)
  const getColunasAtivas = () => {
    if (!datasetAtivo) return [];
    const todasColunas = Object.keys(datasetAtivo.dados[0] || {});
    const estadoLimp = datasetAtivo.estadoLimpeza?.colunasAtivas || {};
    return todasColunas.filter(col => estadoLimp[col] !== false);
  };

  const getLinhasAtivas = () => {
    if (!datasetAtivo) return [];
    const estadoLimp = datasetAtivo.estadoLimpeza?.linhasAtivas || {};
    return datasetAtivo.dados.filter((_, index) => estadoLimp[index] !== false);
  };

  const handleSelectChange = (coluna, selectedValue) => {
    if (!selectedValue) {
      const novoMap = { ...mapeamento };
      delete novoMap[coluna];
      setMapeamento(novoMap);
      return;
    }

    const [tipo, ...rest] = selectedValue.split('_');
    const valor = rest.join('_'); // Recria o texto caso tenha underline no nome
    setMapeamento(prev => ({ ...prev, [coluna]: { tipo, valor } }));
  };

  const salvarCategorizacao = async () => {
    setSalvando(true);
    try {
      await db.datasets.update(datasetAtivo.id, {
        estadoCategorizacao: {
          demograficas,
          dimensoes,
          mapeamento
        }
      });
      alert("Categorização salva com sucesso!");
      setFase('lista');
      setDatasetAtivo(null);
    } catch (error) {
      console.error("Erro ao salvar:", error);
      alert("Erro ao salvar a categorização.");
    } finally {
      setSalvando(false);
    }
  };

  // Lógica de validação do botão salvar
  const colunasAtivas = getColunasAtivas();
  const todasMapeadas = colunasAtivas.length > 0 && colunasAtivas.every(col => mapeamento[col]);

  // VISÃO 1: Lista de Repositórios
  if (fase === 'lista') {
    return (
      <div className="space-y-8">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Tags className="text-blue-600" /> {t('menu.categorize', 'Categorização')}
        </h1>
        <p className="text-gray-600">
          Defina as dimensões do clima e associe cada coluna do seu repositório a uma variável demográfica ou quantitativa.
        </p>

        {!datasets ? (
          <p className="text-gray-500">Carregando...</p>
        ) : datasets.length === 0 ? (
          <div className="text-center py-10 bg-white border border-gray-200 rounded-xl border-dashed">
            <FileSpreadsheet className="mx-auto h-12 w-12 text-gray-400 mb-3" />
            <p className="text-gray-500">Nenhum repositório encontrado.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {datasets.map((dataset) => (
              <div 
                key={dataset.id} 
                onClick={() => abrirDataset(dataset)}
                className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-blue-300 transition-all cursor-pointer group flex flex-col justify-between"
              >
                <div>
                  <h3 className="font-bold text-gray-800 text-lg truncate group-hover:text-blue-600">
                    {dataset.nome}
                  </h3>
                  <div className="mt-2 text-sm text-gray-500">
                    {dataset.estadoCategorizacao ? (
                      <span className="inline-flex items-center px-2 py-1 rounded-md bg-green-50 text-green-700 border border-green-200">
                        Categorizado
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-1 rounded-md bg-amber-50 text-amber-700 border border-amber-200">
                        Pendente
                      </span>
                    )}
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-gray-100 flex items-center text-blue-600 text-sm font-medium">
                  Configurar variáveis <ArrowRight size={16} className="ml-1" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // VISÃO 2: Configuração das Variáveis
  if (fase === 'configuracao') {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between border-b border-gray-200 pb-4">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => { setFase('lista'); setDatasetAtivo(null); }}
              className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors flex items-center gap-2"
            >
              <ArrowLeft size={20} /> Voltar
            </button>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <Settings2 className="text-blue-600" /> Configurar Variáveis: {datasetAtivo.nome}
            </h1>
          </div>
          
          <button 
            onClick={() => setFase('mapeamento')}
            className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            Avançar para Mapeamento <ArrowRight size={20} />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Card Demográficas */}
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <h2 className="text-lg font-bold text-gray-800 mb-4">Variáveis Demográficas (Qualitativas)</h2>
            <div className="flex gap-2 mb-4">
              <input 
                type="text" 
                value={novaDemo}
                onChange={(e) => setNovaDemo(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && adicionarItem('demo')}
                placeholder="Nova demográfica..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <button 
                onClick={() => adicionarItem('demo')}
                className="p-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <Plus size={20} />
              </button>
            </div>
            <ul className="space-y-2 max-h-[50vh] overflow-y-auto pr-2">
              {demograficas.map(demo => (
                <li key={demo} className="flex justify-between items-center bg-gray-50 px-3 py-2 rounded border border-gray-100">
                  <span className="text-gray-700 text-sm">{demo}</span>
                  <button onClick={() => removerItem('demo', demo)} className="text-red-400 hover:text-red-600">
                    <Trash2 size={16} />
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Card Dimensões */}
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <h2 className="text-lg font-bold text-gray-800 mb-4">Dimensões do Clima (Quantitativas)</h2>
            <div className="flex gap-2 mb-4">
              <input 
                type="text" 
                value={novaDim}
                onChange={(e) => setNovaDim(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && adicionarItem('dim')}
                placeholder="Nova dimensão..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <button 
                onClick={() => adicionarItem('dim')}
                className="p-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <Plus size={20} />
              </button>
            </div>
            <ul className="space-y-2 max-h-[50vh] overflow-y-auto pr-2">
              {dimensoes.map(dim => (
                <li key={dim} className="flex justify-between items-center bg-blue-50 px-3 py-2 rounded border border-blue-100">
                  <span className="text-blue-800 text-sm font-medium">{dim}</span>
                  <button onClick={() => removerItem('dim', dim)} className="text-red-400 hover:text-red-600">
                    <Trash2 size={16} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    );
  }

  // VISÃO 3: Tabela de Mapeamento
  const linhasFiltradas = getLinhasAtivas();

  return (
    <div className="space-y-6 flex flex-col h-[80vh]">
      <div className="flex items-center justify-between border-b border-gray-200 pb-4">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setFase('configuracao')}
            className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors flex items-center gap-2"
          >
            <ArrowLeft size={20} /> Voltar
          </button>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Tags className="text-blue-600" /> Associar Colunas: {datasetAtivo.nome}
          </h1>
        </div>
        
        <div className="flex items-center gap-4">
          {!todasMapeadas && (
            <span className="text-sm text-amber-600 font-medium bg-amber-50 px-3 py-1 rounded-full border border-amber-200">
              Associe todas as colunas para gravar
            </span>
          )}
          <button 
            onClick={salvarCategorizacao}
            disabled={!todasMapeadas || salvando}
            className="px-6 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            <Save size={20} /> {salvando ? 'Gravando...' : 'Gravar Associações'}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-white border border-gray-200 rounded-xl shadow-sm">
        <table className="w-full text-sm text-left whitespace-nowrap">
          <thead className="text-xs text-gray-700 bg-gray-50 sticky top-0 z-10 shadow-sm">
            <tr>
              <th className="px-4 py-3 border-b border-r border-gray-200 bg-gray-100 w-12 text-center">#</th>
              {colunasAtivas.map((col) => {
                // Recupera o valor atual (ex: demo_Idade ou dim_Estrutura)
                const valorAtual = mapeamento[col] ? `${mapeamento[col].tipo}_${mapeamento[col].valor}` : '';
                const isMapeada = !!mapeamento[col];

                return (
                  <th key={col} className={`px-4 py-3 border-b border-gray-200 min-w-[200px] align-top ${isMapeada ? 'bg-blue-50/50' : 'bg-amber-50/50'}`}>
                    <div className="font-bold text-gray-800 mb-2 truncate" title={col}>{col}</div>
                    <select 
                      value={valorAtual}
                      onChange={(e) => handleSelectChange(col, e.target.value)}
                      className={`w-full text-xs p-1.5 border rounded outline-none ${isMapeada ? 'border-blue-300 bg-white text-blue-800' : 'border-amber-300 bg-white text-gray-600'}`}
                    >
                      <option value="">-- Não associada --</option>
                      <optgroup label="Dados Demográficos">
                        {demograficas.map(demo => (
                          <option key={`demo_${demo}`} value={`demo_${demo}`}>{demo}</option>
                        ))}
                      </optgroup>
                      <optgroup label="Dimensões do Clima">
                        {dimensoes.map(dim => (
                          <option key={`dim_${dim}`} value={`dim_${dim}`}>{dim}</option>
                        ))}
                      </optgroup>
                    </select>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {linhasFiltradas.map((linha, index) => (
              <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-2 border-r border-gray-200 text-center text-gray-400 bg-gray-50 sticky left-0">
                  {index + 1}
                </td>
                {colunasAtivas.map((col) => (
                  <td key={col} className="px-4 py-2 text-gray-700">
                    {linha[col]}
                  </td>
                ))}
              </tr>
            ))}
            {linhasFiltradas.length === 0 && (
              <tr>
                <td colSpan={colunasAtivas.length + 1} className="text-center py-8 text-gray-500">
                  Nenhuma linha válida encontrada para exibição. Verifique a etapa de Limpeza.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}