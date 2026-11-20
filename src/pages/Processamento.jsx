import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { useNavigate } from 'react-router-dom';
import { 
  Cpu, ArrowLeft, Play, FileSpreadsheet, 
  Loader2, CheckCircle2, BarChart2 
} from 'lucide-react';

export default function Processamento() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const datasets = useLiveQuery(() => db.datasets.toArray());
  
  // Fases: 'lista' -> 'preparacao' -> 'processando' -> 'concluido'
  const [fase, setFase] = useState('lista');
  const [datasetAtivo, setDatasetAtivo] = useState(null);
  
  // Estados do processamento
  const [mensagemProgresso, setMensagemProgresso] = useState('');
  const [progresso, setProgresso] = useState(0);

  // Filtra apenas repositórios que já passaram pela Categorização
  const repositoriosProntos = datasets?.filter(d => d.estadoCategorizacao) || [];

  const abrirDataset = (dataset) => {
    setDatasetAtivo(dataset);
    setFase(dataset.estadoProcessamento ? 'concluido' : 'preparacao');
  };

  const iniciarAnalise = () => {
    setFase('processando');
    setProgresso(0);
    setMensagemProgresso('Iniciando...');

    // Cria o Worker chamando o arquivo pyodideWorker.js
    const worker = new Worker(new URL('../workers/pyodideWorker.js', import.meta.url), { type: 'module' });

    // Fica escutando as respostas do Worker (Python)
    worker.onmessage = async (event) => {
      const { type, mensagem, progresso, payload } = event.data;

      if (type === 'STATUS') {
        setMensagemProgresso(mensagem);
        setProgresso(progresso);
      } 
      else if (type === 'SUCESSO') {
        setProgresso(100);
        console.log("Resultado do Python:", payload); // Para vermos no console (F12)
        
        // Grava no IndexedDB
        await db.datasets.update(datasetAtivo.id, {
          estadoProcessamento: {
            dataConclusao: new Date().toISOString(),
            status: 'sucesso',
            resultadosGerais: payload // Salvando o retorno real do Python
          }
        });
        
        setFase('concluido');
        worker.terminate(); // Demite o funcionário quando acaba o serviço
      } 
      else if (type === 'ERRO') {
        alert("Erro no motor Python: " + payload);
        setFase('preparacao');
        worker.terminate();
      }
    };

    // Manda os dados limpos e o mapeamento para o Worker começar a trabalhar
    const colunasAtivas = Object.keys(datasetAtivo.estadoCategorizacao.mapeamento);
    const linhasAtivas = datasetAtivo.dados.filter((_, index) => datasetAtivo.estadoLimpeza?.linhasAtivas[index] !== false);
    
    // Limpa os dados: envia apenas as colunas que foram categorizadas e as linhas válidas
    const dadosLimpos = linhasAtivas.map(linha => {
      let novaLinha = {};
      colunasAtivas.forEach(col => novaLinha[col] = linha[col]);
      return novaLinha;
    });

    worker.postMessage({
      tipo: 'INICIAR_ANALISE',
      payload: {
        dados: dadosLimpos,
        mapeamento: datasetAtivo.estadoCategorizacao.mapeamento
      }
    });
  };

  // VISÃO 1: Lista de Repositórios Aptos
  if (fase === 'lista') {
    return (
      <div className="space-y-8">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Cpu className="text-blue-600" /> {t('menu.process', 'Processamento Estatístico')}
        </h1>
        <p className="text-gray-600">
          Selecione um repositório categorizado para iniciar o motor analítico. Os cálculos são realizados localmente no seu dispositivo.
        </p>

        {!datasets ? (
          <p className="text-gray-500">Carregando...</p>
        ) : repositoriosProntos.length === 0 ? (
          <div className="text-center py-10 bg-white border border-gray-200 rounded-xl border-dashed">
            <FileSpreadsheet className="mx-auto h-12 w-12 text-gray-400 mb-3" />
            <p className="text-gray-500">Nenhum repositório pronto para processamento.</p>
            <p className="text-sm text-gray-400 mt-1">Conclua a etapa de Categorização primeiro.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {repositoriosProntos.map((dataset) => (
              <div 
                key={dataset.id} 
                onClick={() => abrirDataset(dataset)}
                className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-blue-300 transition-all cursor-pointer group flex flex-col justify-between"
              >
                <div>
                  <h3 className="font-bold text-gray-800 text-lg truncate group-hover:text-blue-600">
                    {dataset.nome}
                  </h3>
                  <div className="mt-2 text-sm">
                    {dataset.estadoProcessamento ? (
                      <span className="inline-flex items-center px-2 py-1 rounded-md bg-green-50 text-green-700 border border-green-200">
                        Processado
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-1 rounded-md bg-blue-50 text-blue-700 border border-blue-200">
                        Pronto para Análise
                      </span>
                    )}
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-gray-100 flex items-center text-blue-600 text-sm font-medium">
                  {dataset.estadoProcessamento ? 'Ver status' : 'Iniciar motor estatístico'} <Play size={16} className="ml-1" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // VISÃO 2, 3 e 4: Preparação, Processando e Concluído
  return (
    <div className="space-y-6 max-w-3xl mx-auto mt-8">
      <div className="flex items-center gap-4 mb-8">
        {fase !== 'processando' && (
          <button 
            onClick={() => setFase('lista')}
            className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
            title="Voltar"
          >
            <ArrowLeft size={20} />
          </button>
        )}
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          {fase === 'processando' ? <Loader2 className="text-blue-600 animate-spin" /> : <Cpu className="text-blue-600" />} 
          {datasetAtivo.nome}
        </h1>
      </div>

      <div className="bg-white p-8 rounded-xl border border-gray-200 shadow-sm text-center">
        
        {fase === 'preparacao' && (
          <div className="space-y-6">
            <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Cpu size={40} />
            </div>
            <h2 className="text-xl font-bold text-gray-800">Pronto para iniciar</h2>
            <p className="text-gray-600 max-w-md mx-auto">
              O modelo executará a Distância de Gower para dados mistos, agrupará os perfis via K-Medoids e validará os microclimas com PERMANOVA e Kruskal-Wallis.
            </p>
            <button 
              onClick={iniciarAnalise}
              className="px-8 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center gap-2 text-lg shadow-md hover:shadow-lg"
            >
              <Play size={24} /> Rodar Análise
            </button>
          </div>
        )}

        {fase === 'processando' && (
          <div className="space-y-8 py-8">
            <h2 className="text-xl font-bold text-gray-800">Processando Dados...</h2>
            
            <div className="w-full bg-gray-100 rounded-full h-4 overflow-hidden">
              <div 
                className="bg-blue-600 h-4 transition-all duration-500 ease-out" 
                style={{ width: `${progresso}%` }}
              ></div>
            </div>
            
            <p className="text-blue-600 font-medium animate-pulse">
              {mensagemProgresso}
            </p>
            
            <p className="text-sm text-gray-400">
              Isso pode levar alguns instantes dependendo do poder de processamento do seu computador. Não feche esta aba.
            </p>
          </div>
        )}

        {fase === 'concluido' && (
          <div className="space-y-6 py-4">
            <div className="w-20 h-20 bg-green-50 text-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 size={48} />
            </div>
            <h2 className="text-2xl font-bold text-gray-800">Análise Concluída!</h2>
            <p className="text-gray-600">
              O motor estatístico finalizou os cálculos com sucesso. Os microclimas organizacionais foram identificados.
            </p>
            
            <div className="pt-6 flex justify-center gap-4">
              <button 
                onClick={iniciarAnalise}
                className="px-6 py-2 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors inline-flex items-center gap-2"
              >
                <Cpu size={20} /> Reprocessar
              </button>
              <button 
                onClick={() => navigate('/resultados')}
                className="px-6 py-2 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 transition-colors inline-flex items-center gap-2 shadow-md"
              >
                <BarChart2 size={20} /> Ver Resultados
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}