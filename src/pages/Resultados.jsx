import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { 
  BarChart2, ArrowLeft, FileSpreadsheet, 
  Users, Target, Activity, CheckCircle, AlertTriangle, 
  TrendingDown, Star, Download
} from 'lucide-react';
import { 
  Treemap, ResponsiveContainer, Tooltip as RechartsTooltip,
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Legend 
} from 'recharts';

const CORES_CLUSTERS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f43f5e'];

export default function Resultados() {
  const { t } = useTranslation();
  const datasets = useLiveQuery(() => db.datasets.toArray());
  const [datasetAtivo, setDatasetAtivo] = useState(null);

  const repositoriosProcessados = datasets?.filter(d => d.estadoProcessamento?.resultadosGerais) || [];

  if (!datasetAtivo) {
    return (
      <div className="space-y-8">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <BarChart2 className="text-blue-600" /> {t('menu.results', 'Resultados e Insights')}
        </h1>
        <p className="text-gray-600">
          Selecione um repositório processado para visualizar o painel gerencial dos microclimas identificados.
        </p>

        {!datasets ? (
          <p className="text-gray-500">A carregar...</p>
        ) : repositoriosProcessados.length === 0 ? (
          <div className="text-center py-10 bg-white border border-gray-200 rounded-xl border-dashed">
            <FileSpreadsheet className="mx-auto h-12 w-12 text-gray-400 mb-3" />
            <p className="text-gray-500">Nenhum repositório com análise concluída.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {repositoriosProcessados.map((dataset) => (
              <div 
                key={dataset.id} 
                onClick={() => setDatasetAtivo(dataset)}
                className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-blue-300 transition-all cursor-pointer group flex flex-col justify-between"
              >
                <div>
                  <h3 className="font-bold text-gray-800 text-lg truncate group-hover:text-blue-600">{dataset.nome}</h3>
                  <p className="text-sm text-gray-500 mt-2">
                    <span className="font-semibold text-gray-700">{dataset.estadoProcessamento.resultadosGerais.k_ideal}</span> microclimas encontrados
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-gray-100 flex items-center text-blue-600 text-sm font-medium">
                  Abrir Dashboard <BarChart2 size={16} className="ml-1" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // --- PREPARAÇÃO DOS DADOS ---
  const resultados = datasetAtivo.estadoProcessamento.resultadosGerais;
  const totalRespondentes = resultados.dados_com_clusters.length;
  // Fallback caso ainda não tenha reprocessado no Python
  const totalPopulacao = resultados.total_populacao || totalRespondentes; 
  const naoAgrupados = totalPopulacao - totalRespondentes;
  const k_ideal = resultados.k_ideal;
  
  // Função para exportar os dados para CSV (compatível com Excel PT-BR)
  const exportarDados = () => {
    const dados = resultados.dados_com_clusters;
    if (!dados || dados.length === 0) return;

    const colunas = Object.keys(dados[0]);
    
    const csvContent = [
      colunas.join(';'),
      ...dados.map(linha => colunas.map(col => {
        let valor = linha[col];
        if (valor === null || valor === undefined) valor = '';
        if (typeof valor === 'string') {
          return `"${valor.replace(/"/g, '""')}"`;
        }
        if (typeof valor === 'number' && !Number.isInteger(valor)) {
            return valor.toString().replace('.', ',');
        }
        return valor;
      }).join(';'))
    ].join('\n');

    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `AtmosLab_Resultados_${datasetAtivo.nome}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 1. Dados para o Treemap
  const dadosTreemap = Object.entries(resultados.tamanho_microclimas).map(([nome, tamanho], index) => ({
    name: nome, size: tamanho, fill: CORES_CLUSTERS[index % CORES_CLUSTERS.length]
  }));

  // Adiciona o bloco de respostas incompletas ao Treemap (se houver)
  if (naoAgrupados > 0) {
    dadosTreemap.push({
      name: 'Respostas Incompletas',
      size: naoAgrupados,
      fill: '#cbd5e1' 
    });
  }

  // 2. Dados para o Gráfico Radar (Teia)
  const dimensoes = Object.keys(resultados.kruskal_wallis);
  const dadosRadar = dimensoes.map(dim => {
    const linhaRadar = { dimensoes: dim }; 
    for (let i = 1; i <= k_ideal; i++) {
      const pessoasCluster = resultados.dados_com_clusters.filter(p => p.Microclima === i);
      const soma = pessoasCluster.reduce((acc, curr) => acc + (parseFloat(curr[dim]) || 0), 0);
      const media = pessoasCluster.length > 0 ? (soma / pessoasCluster.length) : 0;
      linhaRadar[`Microclima ${i}`] = parseFloat(media.toFixed(2));
    }
    return linhaRadar;
  });

  // Customização do Treemap
  const TreemapContent = ({ x, y, width, height, name, size, fill }) => (
    <g>
      <rect x={x} y={y} width={width} height={height} style={{ fill, stroke: '#fff', strokeWidth: 2 }} />
      {width > 80 && height > 40 && (
        <>
          <text x={x + width / 2} y={y + height / 2 - 8} textAnchor="middle" fill={name === 'Respostas Incompletas' ? '#475569' : '#fff'} fontSize={14} fontWeight="bold">{name}</text>
          <text x={x + width / 2} y={y + height / 2 + 12} textAnchor="middle" fill={name === 'Respostas Incompletas' ? '#475569' : '#fff'} fontSize={12} opacity={0.9}>
            {size} pes. ({((size / totalPopulacao) * 100).toFixed(1)}%)
          </text>
        </>
      )}
    </g>
  );

  return (
    <div className="space-y-6 pb-12">
      {/* CABEÇALHO COM BOTÃO DE EXPORTAÇÃO */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-4">
        <div className="flex items-center gap-4">
          <button onClick={() => setDatasetAtivo(null)} className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors" title="Voltar">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-2xl font-bold text-gray-800">Dashboard: {datasetAtivo.nome}</h1>
        </div>
        
        <button 
          onClick={exportarDados}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors shadow-sm"
        >
          <Download size={18} /> Exportar Planilha
        </button>
      </div>

      {/* KPIs EXECUTIVOS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border shadow-sm flex items-start gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-lg"><Users size={24} /></div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Total vs Válidos</p>
            <p className="text-2xl font-bold text-gray-800">{totalPopulacao} / <span className="text-emerald-600">{totalRespondentes}</span></p>
          </div>
        </div>
        
        <div className="bg-white p-5 rounded-xl border shadow-sm flex items-start gap-4">
          <div className="p-3 bg-purple-50 text-purple-600 rounded-lg"><Target size={24} /></div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Microclimas (K)</p>
            <p className="text-2xl font-bold text-gray-800">{k_ideal}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border shadow-sm flex items-start gap-4">
          <div className={`p-3 rounded-lg ${resultados.permanova.significativo ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
            {resultados.permanova.significativo ? <CheckCircle size={24} /> : <AlertTriangle size={24} />}
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">PERMANOVA (Clima)</p>
            <p className={`text-lg font-bold mt-1 ${resultados.permanova.significativo ? 'text-emerald-600' : 'text-red-600'}`}>
              {resultados.permanova.significativo ? 'Significativo' : 'Inválido'}
            </p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border shadow-sm flex items-start gap-4">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-lg"><Activity size={24} /></div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Força (Silhouette)</p>
            <p className="text-2xl font-bold text-gray-800">{resultados.silhouette_score.toFixed(2)}</p>
          </div>
        </div>
      </div>

      {/* CARTÕES DE PERSONA */}
      {resultados.perfis_microclimas && (
        <div className="bg-white p-6 rounded-xl border shadow-sm">
          <h2 className="text-xl font-bold text-gray-800 mb-2 flex items-center gap-2">
            <Star className="text-amber-500" size={24} fill="currentColor" /> Diagnóstico de Grupos (Personas)
          </h2>
          <p className="text-sm text-gray-500 mb-6">
            Quem são as "tribos" da organização, como sentem o clima e quais são as suas características dominantes. 
            Atributos assinalados a <span className="font-bold text-blue-600">azul</span> são estatisticamente determinantes para a formação do grupo.
          </p>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {Object.entries(resultados.perfis_microclimas).map(([nome, dados], i) => (
              <div key={nome} className="border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col">
                <div className={`p-4 border-b ${
                  dados.classificacao === 'Avaliação Positiva' ? 'bg-emerald-50 border-emerald-100' :
                  dados.classificacao === 'Avaliação Crítica' ? 'bg-red-50 border-red-100' : 'bg-amber-50 border-amber-100'
                }`}>
                  <div className="flex justify-between items-start mb-1">
                    <h3 className="font-bold text-lg text-gray-800" style={{ color: CORES_CLUSTERS[i % CORES_CLUSTERS.length] }}>{nome}</h3>
                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                      dados.classificacao === 'Avaliação Positiva' ? 'bg-emerald-200 text-emerald-800' :
                      dados.classificacao === 'Avaliação Crítica' ? 'bg-red-200 text-red-800' : 'bg-amber-200 text-amber-800'
                    }`}>
                      {dados.classificacao} (Média {dados.media_geral})
                    </span>
                  </div>
                </div>

                <div className="p-5 bg-white flex-1 flex flex-col gap-4">
                  <div className="flex items-center gap-3 text-gray-700 bg-gray-50 p-3 rounded-lg border border-gray-100">
                    <Users size={18} className="text-gray-400" />
                    <span className="text-sm font-medium">Tamanho: <span className="font-bold text-gray-900">{dados.tamanho} pessoas ({dados.percentual}%)</span></span>
                  </div>
                  
                  <div className="flex items-center gap-3 text-gray-700 bg-red-50/50 p-3 rounded-lg border border-red-100">
                    <TrendingDown size={18} className="text-red-400" />
                    <span className="text-sm font-medium">Maior Dor: <span className="font-bold text-red-700">{dados.maior_dor}</span></span>
                  </div>

                  <div>
                    <h4 className="text-xs uppercase tracking-wider font-bold text-gray-400 mb-3 mt-2 border-b pb-1">Perfil Dominante</h4>
                    <ul className="space-y-2">
                      {Object.entries(dados.perfil).map(([variavel, detalhes]) => (
                        <li key={variavel} className="text-sm flex justify-between items-center">
                          <span className="text-gray-500">{variavel}</span>
                          <span className={`font-semibold text-right max-w-[60%] leading-tight ${detalhes.significativo ? 'text-blue-600' : 'text-gray-800'}`}>
                            {detalhes.categoria} <span className="text-xs font-normal opacity-70">({detalhes.percentual}%)</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* GRÁFICOS: TREEMAP E RADAR */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Treemap com a nova visão da População Total */}
        <div className="bg-white p-6 rounded-xl border shadow-sm">
          <h2 className="text-lg font-bold text-gray-800 mb-2">Proporção dos Microclimas</h2>
          <div className="h-[350px] w-full mt-6">
            <ResponsiveContainer width="100%" height="100%">
              <Treemap data={dadosTreemap} dataKey="size" aspectRatio={4 / 3} stroke="#fff" content={<TreemapContent />}>
                <RechartsTooltip formatter={(value) => [`${value} pessoas`, 'Tamanho']} />
              </Treemap>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Radar Chart */}
        <div className="bg-white p-6 rounded-xl border shadow-sm">
          <h2 className="text-lg font-bold text-gray-800 mb-2">Perfil Multidimensional (Teia)</h2>
          <div className="h-[350px] w-full mt-6">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="70%" data={dadosRadar}>
                <PolarGrid stroke="#e5e7eb" />
                <PolarAngleAxis dataKey="dimensoes" tick={{ fill: '#4b5563', fontSize: 12 }} />
                <PolarRadiusAxis angle={30} domain={[0, 'auto']} tick={{ fill: '#9ca3af', fontSize: 10 }} />
                <RechartsTooltip />
                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                {Array.from({ length: k_ideal }).map((_, idx) => (
                  <Radar key={`Microclima ${idx + 1}`} name={`Microclima ${idx + 1}`} dataKey={`Microclima ${idx + 1}`} stroke={CORES_CLUSTERS[idx % CORES_CLUSTERS.length]} fill={CORES_CLUSTERS[idx % CORES_CLUSTERS.length]} fillOpacity={0.3} />
                ))}
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

    </div>
  );
}
