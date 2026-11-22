import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { useNavigate } from 'react-router-dom';
import {
  Cpu, ArrowLeft, Play, FileSpreadsheet,
  Loader2, CheckCircle2, BarChart2, Download, RotateCcw
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

  // Função para exportar os dados para CSV (compatível com Excel PT-BR)
  const exportarResultados = () => {
    let dadosBrutos = datasetAtivo?.estadoProcessamento?.resultadosGerais 
                   || datasetAtivo?.resultados 
                   || datasetAtivo?.estadoProcessamento;

    if (!dadosBrutos) {
      alert("Nenhum resultado processado para exportar.");
      return;
    }

    // 1. Descasca o JSON (se for texto)
    let dadosLimpos = dadosBrutos;
    while (typeof dadosLimpos === 'string') {
      try { dadosLimpos = JSON.parse(dadosLimpos); } catch (e) { break; }
    }

    const demografias = dadosLimpos.demografia || {};

    // 2. Extrai os dados estatísticos (PERMANOVA e Post-Hoc)
    const linhasPermanova = [];
    const linhasPostHoc = [];

    Object.entries(demografias).forEach(([nomeVariavel, dadosVar]) => {
      // PERMANOVA
      if (dadosVar.permanova) {
        linhasPermanova.push({
          'Variável Demográfica': nomeVariavel,
          'Impacto (R²)': dadosVar.permanova.R2 ?? dadosVar.permanova.r2 ?? 0,
          'P-Valor': dadosVar.permanova.p_value ?? dadosVar.permanova.p ?? 0,
          'Significativo?': dadosVar.permanova.significativo ? 'Sim' : 'Não'
        });
      }

      // POST-HOC
      if (dadosVar.post_hoc) {
        Object.entries(dadosVar.post_hoc).forEach(([nomeDimensao, stats]) => {
          let mediasFormatadas = "";
          if (stats.medias) {
             mediasFormatadas = Object.entries(stats.medias)
               // Já formata a média com vírgula no próprio texto
               .map(([grupo, nota]) => `${grupo}: ${Number(nota).toFixed(2).replace('.', ',')}`)
               .join("  |  ");
          }

          linhasPostHoc.push({
            'Variável Analisada': nomeVariavel,
            'Dimensão do Clima Afetada': nomeDimensao,
            'Significativo?': stats.significativo ? 'Sim' : 'Não',
            'Notas Médias dos Grupos': mediasFormatadas || "N/A"
          });
        });
      }
    });

    // 3. A SUA LÓGICA DE FORMATAÇÃO CSV (Ajustada para ser reutilizável)
    const formatarLinhaCSV = (linha, colunas) => {
      return colunas.map(col => {
        let valor = linha[col];
        if (valor === null || valor === undefined) valor = '';
        if (typeof valor === 'string') {
          return `"${valor.replace(/"/g, '""')}"`; // Escapa aspas
        }
        if (typeof valor === 'number' && !Number.isInteger(valor)) {
          // Garante 4 casas decimais para o p-valor e R², trocando ponto por vírgula
          return valor.toFixed(4).replace('.', ','); 
        }
        return valor;
      }).join(';');
    };

    // 4. Monta o conteúdo final do CSV
    let csvContent = "";

    // Adiciona Bloco PERMANOVA
    if (linhasPermanova.length > 0) {
      const colunasPerm = Object.keys(linhasPermanova[0]);
      csvContent += "--- VISAO GERAL (PERMANOVA) ---\n";
      csvContent += colunasPerm.join(';') + '\n';
      csvContent += linhasPermanova.map(linha => formatarLinhaCSV(linha, colunasPerm)).join('\n');
      csvContent += '\n\n';
    }

    // Adiciona Bloco POST-HOC
    if (linhasPostHoc.length > 0) {
      const colunasPost = Object.keys(linhasPostHoc[0]);
      csvContent += "--- DIMENSOES AFETADAS (POST-HOC) ---\n";
      csvContent += colunasPost.join(';') + '\n';
      csvContent += linhasPostHoc.map(linha => formatarLinhaCSV(linha, colunasPost)).join('\n');
      csvContent += '\n\n';
    }

    // Adiciona Bloco DADOS BRUTOS COM CLUSTERS (Se existirem)
    const dadosComClusters = dadosLimpos.dados_com_clusters;
    if (dadosComClusters && dadosComClusters.length > 0) {
      const colunasClusters = Object.keys(dadosComClusters[0]);
      csvContent += "--- DADOS DOS RESPONDENTES (BRUTOS) ---\n";
      csvContent += colunasClusters.join(';') + '\n';
      csvContent += dadosComClusters.map(linha => formatarLinhaCSV(linha, colunasClusters)).join('\n');
    }

    // 5. Gera e baixa o arquivo
    // NOTA: O \uFEFF é o BOM (Byte Order Mark). Ele obriga o Excel a ler os acentos corretos em PT-BR!
    const BOM = "\uFEFF"; 
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    link.href = url;
    link.download = `ClimaLens_Resultados_${datasetAtivo.nome.replace(/\s+/g, '_')}.csv`;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

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
        console.log("Resultado do Python:", payload);

        // Grava no IndexedDB
        await db.datasets.update(datasetAtivo.id, {
          estadoProcessamento: {
            dataConclusao: new Date().toISOString(),
            status: 'sucesso',
            resultadosGerais: payload
          }
        });

        // Atualiza a referência em memória para o botão de exportar funcionar de imediato
        setDatasetAtivo(prev => ({
          ...prev,
          estadoProcessamento: {
            status: 'sucesso',
            resultadosGerais: payload
          }
        }));

        setFase('concluido');
        worker.terminate();
      }
      else if (type === 'ERRO') {
        alert("Erro no motor Python: " + payload);
        setFase('preparacao');
        worker.terminate();
      }
    };

    const colunasAtivas = Object.keys(datasetAtivo.estadoCategorizacao.mapeamento);
    const linhasAtivas = datasetAtivo.dados.filter((_, index) => datasetAtivo.estadoLimpeza?.linhasAtivas[index] !== false);

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
            <p className="text-gray-600 mb-6">
              O motor estatístico finalizou os cálculos com sucesso. Os microclimas organizacionais foram identificados.
            </p>

            {/* BARRA DE BOTÕES ALINHADA */}
            <div className="flex flex-wrap justify-center items-center gap-3 pt-4 border-t border-gray-100">
              <button
                onClick={exportarResultados}
                className="flex items-center gap-2 px-5 py-2.5 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors"
              >
                <Download size={18} /> Exportar
              </button>

              <button
                onClick={iniciarAnalise}
                className="flex items-center gap-2 px-5 py-2.5 bg-amber-50 text-amber-700 border border-amber-200 font-medium rounded-lg hover:bg-amber-100 transition-colors"
              >
                <RotateCcw size={18} /> Reprocessar
              </button>

              <button
                onClick={() => navigate('/resultados')}
                className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors shadow-md ml-2"
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