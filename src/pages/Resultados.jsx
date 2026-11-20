import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { 
  BarChart2, ArrowLeft, FileSpreadsheet, 
  Users, Target, Activity, CheckCircle, AlertTriangle 
} from 'lucide-react';
import { 
  Treemap, ResponsiveContainer, Tooltip as RechartsTooltip,
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Legend 
} from 'recharts';

// Paleta de cores elegantes e consistentes para os clusters
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
                  <h3 className="font-bold text-gray-800 text-lg truncate group-hover:text-blue-600">
                    {dataset.nome}
                  </h3>
                  <p className="text-sm text-gray-500 mt-2">
                    <span className="font-semibold text-gray-700">
                      {dataset.estadoProcessamento.resultadosGerais.k_ideal}
                    </span> microclimas encontrados
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
  const k_ideal = resultados.k_ideal;
  
  // 1. Dados para o Treemap
  const dadosTreemap = Object.entries(resultados.tamanho_microclimas).map(([nome, tamanho], index) => ({
    name: nome,
    size: tamanho,
    fill: CORES_CLUSTERS[index % CORES_CLUSTERS.length]
  }));

  // 2. Dados para o Gráfico Radar (Cálculo das médias por dimensão e por microclima)
  const dimensoes = Object.keys(resultados.kruskal_wallis);
  const dadosRadar = dimensoes.map(dim => {
    const linhaRadar = { dimensoes: dim }; // Eixo do gráfico
    
    // Calcula a média desta dimensão para cada microclima (1 até K)
    for (let i = 1; i <= k_ideal; i++) {
      const pessoasCluster = resultados.dados_com_clusters.filter(p => p.Microclima === i);
      const soma = pessoasCluster.reduce((acc, curr) => acc + (parseFloat(curr[dim]) || 0), 0);
      const media = pessoasCluster.length > 0 ? (soma / pessoasCluster.length) : 0;
      linhaRadar[`Microclima ${i}`] = parseFloat(media.toFixed(2));
    }
    return linhaRadar;
  });

  // Customização do Treemap
  const TreemapContent = ({ root, depth, x, y, width, height, index, name, size, fill }) => {
    return (
      <g>
        <rect
          x={x} y={y} width={width} height={height}
          style={{ fill, stroke: '#fff', strokeWidth: 2, strokeOpacity: 1 }}
        />
        {width > 80 && height > 40 && (
          <>
            <text x={x + width / 2} y={y + height / 2 - 8} textAnchor="middle" fill="#fff" fontSize={14} fontWeight="bold">
              {name}
            </text>
            <text x={x + width / 2} y={y + height / 2 + 12} textAnchor="middle" fill="#fff" fontSize={12} opacity={0.9}>
              {size} pes. ({((size / totalRespondentes) * 100).toFixed(1)}%)
            </text>
          </>
        )}
      </g>
    );
  };

  return (
    <div className="space-y-6 pb-12">
      {/* CABEÇALHO */}
      <div className="flex items-center gap-4 border-b border-gray-200 pb-4">
        <button 
          onClick={() => setDatasetAtivo(null)}
          className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-2xl font-bold text-gray-800">
          Dashboard: {datasetAtivo.nome}
        </h1>
      </div>

      {/* KPIs EXECUTIVOS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-start gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-lg"><Users size={24} /></div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Amostra Válida</p>
            <p className="text-2xl font-bold text-gray-800">{totalRespondentes}</p>
          </div>
        </div>
        
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-start gap-4">
          <div className="p-3 bg-purple-50 text-purple-600 rounded-lg"><Target size={24} /></div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Microclimas (K)</p>
            <p className="text-2xl font-bold text-gray-800">{k_ideal}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-start gap-4">
          <div className={`p-3 rounded-lg ${resultados.permanova.significativo ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
            {resultados.permanova.significativo ? <CheckCircle size={24} /> : <AlertTriangle size={24} />}
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Validação (PERMANOVA)</p>
            <p className={`text-lg font-bold mt-1 ${resultados.permanova.significativo ? 'text-emerald-600' : 'text-red-600'}`}>
              {resultados.permanova.significativo ? 'Significativo' : 'Inválido (p>0.05)'}
            </p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-start gap-4">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-lg"><Activity size={24} /></div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Força (Silhouette)</p>
            <p className="text-2xl font-bold text-gray-800">{resultados.silhouette_score.toFixed(2)}</p>
          </div>
        </div>
      </div>

      {/* GRÁFICOS: TREEMAP E RADAR */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Treemap */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <h2 className="text-lg font-bold text-gray-800 mb-2">Proporção dos Microclimas</h2>
          <p className="text-sm text-gray-500 mb-6">Tamanho de cada agrupamento na organização.</p>
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <Treemap data={dadosTreemap} dataKey="size" aspectRatio={4 / 3} stroke="#fff" content={<TreemapContent />}>
                <RechartsTooltip formatter={(value) => [`${value} pessoas`, 'Tamanho']} />
              </Treemap>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Radar Chart */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <h2 className="text-lg font-bold text-gray-800 mb-2">Perfil Multidimensional (Teia)</h2>
          <p className="text-sm text-gray-500 mb-6">Média de pontuação em cada dimensão do clima.</p>
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="70%" data={dadosRadar}>
                <PolarGrid stroke="#e5e7eb" />
                <PolarAngleAxis dataKey="dimensoes" tick={{ fill: '#4b5563', fontSize: 12 }} />
                <PolarRadiusAxis angle={30} domain={[0, 'auto']} tick={{ fill: '#9ca3af', fontSize: 10 }} />
                <RechartsTooltip />
                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                
                {/* Renderiza uma "teia" para cada Microclima dinamicamente */}
                {Array.from({ length: k_ideal }).map((_, idx) => (
                  <Radar 
                    key={`Microclima ${idx + 1}`}
                    name={`Microclima ${idx + 1}`} 
                    dataKey={`Microclima ${idx + 1}`} 
                    stroke={CORES_CLUSTERS[idx % CORES_CLUSTERS.length]} 
                    fill={CORES_CLUSTERS[idx % CORES_CLUSTERS.length]} 
                    fillOpacity={0.3} 
                  />
                ))}
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* ANÁLISE DE VARIÂNCIA (Kruskal-Wallis) */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <h2 className="text-lg font-bold text-gray-800 mb-2">O Motor da Divisão (Validação por Dimensão)</h2>
        <p className="text-sm text-gray-500 mb-6">
          Resultados do teste de Kruskal-Wallis. Dimensões assinaladas como <span className="font-semibold text-emerald-600">Significativas (p &lt; 0.05)</span> provam estatisticamente que a pontuação entre os microclimas é diferente, ou seja, são as reais causadoras da quebra do clima.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.entries(resultados.kruskal_wallis).map(([dimensao, stats]) => (
            <div 
              key={dimensao} 
              className={`p-4 rounded-lg border flex flex-col justify-between ${
                stats.significativo 
                  ? 'bg-emerald-50/50 border-emerald-200' 
                  : 'bg-gray-50 border-gray-200'
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <h4 className="font-bold text-gray-800 truncate" title={dimensao}>{dimensao}</h4>
                {stats.significativo ? (
                  <span className="text-[10px] uppercase tracking-wider font-bold bg-emerald-100 text-emerald-700 px-2 py-1 rounded">Significativo</span>
                ) : (
                  <span className="text-[10px] uppercase tracking-wider font-bold bg-gray-200 text-gray-600 px-2 py-1 rounded">Desprezível</span>
                )}
              </div>
              <div className="text-sm">
                <p className="text-gray-500">Est. (H): <span className="text-gray-800 font-medium">{stats.estatistica}</span></p>
                <p className="text-gray-500">p-valor: <span className={`font-medium ${stats.significativo ? 'text-emerald-600' : 'text-gray-800'}`}>
                  {stats.p_valor}
                </span></p>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}