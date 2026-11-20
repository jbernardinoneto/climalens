import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { Eraser, ArrowLeft, Save, FileSpreadsheet, CheckSquare } from 'lucide-react';

export default function Limpeza() {
  const { t } = useTranslation();
  const datasets = useLiveQuery(() => db.datasets.toArray());
  
  // Controle de tela e estado do repositório selecionado
  const [datasetAtivo, setDatasetAtivo] = useState(null);
  const [colunasAtivas, setColunasAtivas] = useState({});
  const [linhasAtivas, setLinhasAtivas] = useState({});
  const [salvando, setSalvando] = useState(false);

  // Carrega as configurações de limpeza ou cria o padrão (tudo ativado)
  const abrirDataset = (dataset) => {
    const colunas = Object.keys(dataset.dados[0] || {});
    let estadoCols = {};
    let estadoLins = {};

    if (dataset.estadoLimpeza) {
      estadoCols = dataset.estadoLimpeza.colunasAtivas;
      estadoLins = dataset.estadoLimpeza.linhasAtivas;
    } else {
      // Se for a primeira vez, marca tudo como ativo
      colunas.forEach(col => estadoCols[col] = true);
      dataset.dados.forEach((_, index) => estadoLins[index] = true);
    }

    setColunasAtivas(estadoCols);
    setLinhasAtivas(estadoLins);
    setDatasetAtivo(dataset);
  };

  const alternarColuna = (coluna) => {
    setColunasAtivas(prev => ({ ...prev, [coluna]: !prev[coluna] }));
  };

  const alternarLinha = (index) => {
    setLinhasAtivas(prev => ({ ...prev, [index]: !prev[index] }));
  };

  const salvarLimpeza = async () => {
    setSalvando(true);
    try {
      await db.datasets.update(datasetAtivo.id, {
        estadoLimpeza: { colunasAtivas, linhasAtivas }
      });
      alert("Configurações de limpeza salvas com sucesso!");
    } catch (error) {
      console.error("Erro ao salvar:", error);
      alert("Erro ao salvar configurações.");
    } finally {
      setSalvando(false);
    }
  };

  // Visão 1: Tabela de Edição
  if (datasetAtivo) {
    const colunas = Object.keys(datasetAtivo.dados[0] || {});

    return (
      <div className="space-y-6 flex flex-col h-[80vh]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setDatasetAtivo(null)}
              className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors flex items-center gap-2"
            >
              <ArrowLeft size={20} /> Voltar
            </button>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <Eraser className="text-blue-600" /> Curadoria: {datasetAtivo.nome}
            </h1>
          </div>
          
          <button 
            onClick={salvarLimpeza}
            disabled={salvando}
            className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <Save size={20} /> {salvando ? 'Salvando...' : 'Gravar Alterações'}
          </button>
        </div>

        {/* Tabela com Scroll */}
        <div className="flex-1 overflow-auto bg-white border border-gray-200 rounded-xl shadow-sm">
          <table className="w-full text-sm text-left whitespace-nowrap">
            <thead className="text-xs text-gray-700 bg-gray-50 sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="px-4 py-3 border-b border-r border-gray-200 bg-gray-100 w-16 text-center">
                  <CheckSquare size={16} className="inline text-gray-500" />
                </th>
                {colunas.map((col) => (
                  <th key={col} className="px-4 py-3 border-b border-gray-200 bg-gray-50">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={colunasAtivas[col] !== false}
                        onChange={() => alternarColuna(col)}
                        className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer"
                      />
                      <span className={colunasAtivas[col] === false ? 'line-through text-gray-400' : ''}>
                        {col}
                      </span>
                    </label>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {datasetAtivo.dados.map((linha, index) => {
                const linhaAtiva = linhasAtivas[index] !== false;
                
                return (
                  <tr 
                    key={index} 
                    className={`border-b border-gray-100 hover:bg-blue-50 transition-colors ${!linhaAtiva ? 'bg-gray-50 opacity-60' : 'bg-white'}`}
                  >
                    <td className="px-4 py-2 border-r border-gray-200 text-center bg-gray-50 sticky left-0">
                      <input 
                        type="checkbox" 
                        checked={linhaAtiva}
                        onChange={() => alternarLinha(index)}
                        className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer"
                      />
                    </td>
                    {colunas.map((col) => (
                      <td 
                        key={col} 
                        className={`px-4 py-2 ${colunasAtivas[col] === false ? 'text-gray-300 bg-gray-50' : 'text-gray-700'}`}
                      >
                        {linha[col]}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // Visão 2: Lista de Repositórios
  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
        <Eraser className="text-blue-600" /> {t('menu.clean', 'Limpeza de Dados')}
      </h1>

      <p className="text-gray-600">
        Selecione um repositório abaixo para habilitar ou desabilitar variáveis (colunas) e registros (linhas). 
        Dados desabilitados não serão excluídos, mas serão ignorados no processamento estatístico.
      </p>

      {!datasets ? (
        <p className="text-gray-500">Carregando...</p>
      ) : datasets.length === 0 ? (
        <div className="text-center py-10 bg-white border border-gray-200 rounded-xl border-dashed">
          <FileSpreadsheet className="mx-auto h-12 w-12 text-gray-400 mb-3" />
          <p className="text-gray-500">Nenhum repositório encontrado. Carregue os dados na aba "Dados".</p>
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
                <h3 className="font-bold text-gray-800 text-lg truncate group-hover:text-blue-600 transition-colors">
                  {dataset.nome}
                </h3>
                <p className="text-sm text-gray-500 mt-2">
                  <span className="font-semibold text-gray-700">{dataset.dados.length}</span> linhas totais
                </p>
                <p className="text-sm text-gray-500">
                  <span className="font-semibold text-gray-700">{Object.keys(dataset.dados[0] || {}).length}</span> colunas totais
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-gray-100 flex items-center text-blue-600 text-sm font-medium">
                Abrir tabela <ArrowLeft size={16} className="ml-1 rotate-180" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}