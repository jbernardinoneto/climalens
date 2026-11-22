import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { 
  BarChart2, ArrowLeft, FileSpreadsheet, 
  Users, Target, Activity, CheckCircle, AlertTriangle, 
  TrendingDown, Info, ShieldCheck, Download,
  BarChart
} from 'lucide-react';
import { 
  ResponsiveContainer, Tooltip as RechartsTooltip,
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Legend 
} from 'recharts';

const CORES_CATEGORIAS = ['#00b4d8', '#9d4edd', '#f72585', '#ff7b00', '#48cae4', '#7209b7', '#03045e'];
const COR_PRIMARIA = '#0a2540';

export default function Resultados() {
  const { t } = useTranslation();
  const location = useLocation();
  const datasets = useLiveQuery(() => db.datasets.toArray());
  const [datasetAtivo, setDatasetAtivo] = useState(null);
  const [variavelSelecionada, setVariavelSelecionada] = useState(null);
  // Limpa o painel aberto e volta para a lista sempre que o utilizador clicar no menu lateral
  useEffect(() => {
    setDatasetAtivo(null);
    setVariavelSelecionada(null);
  }, [location.key]);
  const repositoriosProcessados = datasets?.filter(d => d.estadoProcessamento?.resultadosGerais) || [];

  if (!datasetAtivo) {
    return (
      <div className="space-y-8">
        <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: COR_PRIMARIA }}>
          <BarChart2 className="text-blue-600" /> Resultados
        </h1>
        <p className="text-gray-600">Selecione um repositório para descobrir quais variáveis demográficas moldam o clima da sua organização.</p>
        {!datasets ? (
          <p className="text-gray-500">A carregar...</p>
        ) : repositoriosProcessados.length === 0 ? (
          <div className="text-center py-10 bg-white border border-gray-200 rounded-xl border-dashed">
            <FileSpreadsheet className="mx-auto h-12 w-12 text-gray-400 mb-3" />
            <p className="text-gray-500">Nenhum repositório com análise supervisionada concluída.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {repositoriosProcessados.map((dataset) => {
              const res = dataset.estadoProcessamento.resultadosGerais.demografia || {};
              const qtdSig = Object.values(res).filter(v => v.significativo).length;
              return (
                <div key={dataset.id} onClick={() => { setDatasetAtivo(dataset); setVariavelSelecionada(null); }} className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between">
                  <div>
                    <h3 className="font-bold text-lg truncate group-hover:text-opacity-80" style={{ color: COR_PRIMARIA }}>{dataset.nome}</h3>
                    <p className="text-sm text-gray-500 mt-2">
                      <span className="font-semibold text-gray-700">{qtdSig}</span> variáveis com impacto comprovado
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-gray-100 flex items-center text-sm font-medium" style={{ color: COR_PRIMARIA }}>
                    Abrir Dashboard <BarChart2 size={16} className="ml-1" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  const resultados = datasetAtivo.estadoProcessamento.resultadosGerais;
  const demografia = resultados.demografia;
  const dimensoes = resultados.dimensoes_avaliadas;
  const mediaGeral = resultados.media_geral;
  
  // Filtra e ordena as variáveis que deram significativo na PERMANOVA (maior R2 primeiro)
  const variaveisSignificativas = Object.entries(demografia)
    .filter(([_, dados]) => dados.significativo)
    .sort((a, b) => b[1].r2 - a[1].r2);

  const variaveisInsignificantes = Object.entries(demografia)
    .filter(([_, dados]) => !dados.significativo);

  // Auto-seleciona a variável mais forte ao abrir
  if (!variavelSelecionada && variaveisSignificativas.length > 0) {
    setVariavelSelecionada(variaveisSignificativas[0][0]);
  }

  // Dados da variável selecionada para o Gráfico e Post-Hoc
  const dadosAtivos = variavelSelecionada ? demografia[variavelSelecionada] : null;

  // Montagem dos dados para o Radar Chart
  // Montagem dos dados para o Radar Chart (Com Escala Geométrica Visual)
  let dadosRadar = [];
  if (dadosAtivos) {
    dadosRadar = dimensoes.map(dim => {
      // Guardamos o valor real para exibir no balão de texto (Tooltip)
      const linha = { 
        dimensao: dim, 
        'Média Geral_real': mediaGeral[dim] 
      };
      
      // Elevamos ao cubo para esticar as diferenças no desenho
      linha['Média Geral'] = Math.pow(mediaGeral[dim], 3);
      
      dadosAtivos.categorias.forEach(cat => {
        const notaReal = dadosAtivos.medias[cat][dim];
        linha[`${cat}_real`] = notaReal;
        linha[cat] = Math.pow(notaReal, 3); // Valor esticado
      });
      return linha;
    });
  }

  // Ticks do eixo esticados (1³, 2³, 3³, 4³, 5³, 6³)
  const ticksEscalaGeometrica = [1, 8, 27, 64, 125, 216];

  // Balão de Informação (Tooltip) Customizado para reverter o cálculo ao vivo
 // Balão de Informação (Tooltip) Customizado para mostrar notas em Percentual
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg min-w-[150px]">
          <p className="font-bold text-gray-800 mb-2 border-b pb-1">{label}</p>
          <div className="space-y-1.5">
            {payload.map((entry, index) => {
              // 1. Resgata o valor numérico original (ex: 4.5)
              const valorReal = entry.payload[`${entry.dataKey}_real`];
              const valorBase = valorReal !== undefined ? valorReal : Math.cbrt(entry.value);
              
              // 2. Converte para percentagem com base na escala máxima de 6
              const percentual = ((valorBase / 6) * 100).toFixed(2);
              
              return (
                <div key={index} className="flex items-center justify-between gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }}></span>
                    <span className="text-gray-600 font-medium">{entry.name}:</span>
                  </div>
                  <span className="font-bold" style={{ color: entry.color }}>
                    {percentual}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6 pb-12">
      {/* CABEÇALHO */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-4">
        <div className="flex items-center gap-4">
          <button onClick={() => setDatasetAtivo(null)} className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-2xl font-bold" style={{ color: COR_PRIMARIA }}>{datasetAtivo.nome}</h1>
        </div>
      </div>

      {/* KPI GLOBAL */}
      <div className="bg-white p-5 rounded-xl border shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-lg"><Users size={24} /></div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Força de Trabalho Analisada</p>
            <p className="text-xl font-bold text-gray-800">{resultados.total_populacao} participantes</p>
          </div>
        </div>
      </div>

      {variaveisSignificativas.length === 0 ? (
        <div className="bg-white p-8 rounded-xl border border-gray-200 text-center shadow-sm">
          <ShieldCheck size={48} className="mx-auto text-emerald-500 mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Clima Homogêneo</h2>
          <p className="text-gray-600 max-w-lg mx-auto">
            Nenhuma das variáveis demográficas testadas provou ter impacto estatístico (PERMANOVA p &gt; 0.05) na percepção do clima. Isso significa que a sua organização sente o clima de forma sistêmica, independente de idade, sexo ou lotação.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* MENU LATERAL: LISTA DE VARIÁVEIS */}
          <div className="lg:col-span-1 space-y-4">
            <h2 className="font-bold text-gray-700 uppercase tracking-wider text-sm mb-4">IMPACTO COMPROVADO (PERMANOVA p &lt; 0.05)</h2>
            {variaveisSignificativas.map(([nome, dados]) => (
              <div 
                key={nome} 
                onClick={() => setVariavelSelecionada(nome)}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  variavelSelecionada === nome 
                    ? 'bg-blue-50 border-blue-300 shadow-md ring-1 ring-blue-300' 
                    : 'bg-white border-gray-200 hover:border-blue-200 hover:bg-gray-50'
                }`}
              >
                <div className="flex justify-between items-center mb-1">
                  <h3 className={`font-bold ${variavelSelecionada === nome ? 'text-blue-700' : 'text-gray-800'}`}>{nome}</h3>
                  <span className="text-xs font-bold px-2 py-1 rounded bg-blue-100 text-blue-800">
                    {(dados.r2 * 100).toFixed(1)}% R²
                  </span>
                </div>
                <p className="text-xs text-gray-500">
                  {dados.dispersao_diferente ? '⚠️ Alerta de Dispersão (PERMDISP)' : '✅ Diferença Estrutural (PERMDISP)'}
                </p>
              </div>
            ))}

            {variaveisInsignificantes.length > 0 && (
              <div className="mt-8">
                <h2 className="font-bold text-gray-400 uppercase tracking-wider text-xs mb-3">Sem Impacto Comprovado (PERMANOVA p &gt; 0.05)</h2>
                <div className="space-y-2">
                  {variaveisInsignificantes.map(([nome, dados]) => (
                    <div key={nome} className="p-3 bg-gray-50 rounded-lg border border-gray-100 text-gray-400 text-sm flex justify-between">
                      <span>{nome}</span>
                      <span>{(dados.r2 * 100).toFixed(1)}% R²</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ÁREA PRINCIPAL: DETALHES DA VARIÁVEL */}
          {dadosAtivos && (
            <div className="lg:col-span-2 space-y-6">
              
              {/* STATUS PERMDISP E R2 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-white p-4 rounded-xl border shadow-sm">
                  <h4 className="text-sm font-medium text-gray-500">Poder de Explicação (R²)</h4>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-[#00b4d8]">{(dadosAtivos.r2 * 100).toFixed(1)}%</span>
                    <span className="text-sm text-gray-400">da variação do clima</span>
                  </div>
                </div>
                
                <div className={`p-4 rounded-xl border shadow-sm ${dadosAtivos.dispersao_diferente ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'}`}>
                  <h4 className={`text-sm font-medium ${dadosAtivos.dispersao_diferente ? 'text-amber-700' : 'text-emerald-700'}`}>
                    Validação PERMDISP
                  </h4>
                  <div className="mt-1 flex items-center gap-2">
                    {dadosAtivos.dispersao_diferente ? (
                      <><AlertTriangle size={20} className="text-amber-500"/> <span className="font-semibold text-amber-800">Efeito Misto (Local + Dispersão)</span></>
                    ) : (
                      <><CheckCircle size={20} className="text-emerald-500"/> <span className="font-semibold text-emerald-800">Efeito Real (Deslocamento)</span></>
                    )}
                  </div>
                </div>
              </div>

              {/* POST HOC: QUAIS DIMENSÕES EXPLICAM ISSO? */}
              <div className="bg-white p-5 rounded-xl border shadow-sm">
                <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                  <Target size={18} className="text-purple-600"/> Análise Post-Hoc das Dimensões de Clima (Kruskal-Wallis + FDR)
                </h3>
                <p className="text-sm text-gray-500 mb-4">Dimensões com diferenças significativas (FDR &lt; 0.05) entre os grupos demográficos da variável <span className="font-bold">{variavelSelecionada}.</span></p>
                
                <div className="flex flex-wrap gap-2">
                  {Object.entries(dadosAtivos.post_hoc)
                    .filter(([_, result]) => result.significativo)
                    .map(([dimensao, _]) => (
                      <span key={dimensao} className="px-3 py-1.5 bg-purple-100 text-purple-800 font-medium rounded-lg text-sm">
                        {dimensao}
                      </span>
                  ))}
                  {Object.values(dadosAtivos.post_hoc).every(v => !v.significativo) && (
  <div className="col-span-full bg-slate-50 p-4 rounded-lg border border-slate-200 mt-2">
    <p className="text-sm text-slate-800 font-bold mb-1">Efeito Sistêmico (Padrão Multivariado)</p>
    <p className="text-sm text-slate-600 leading-relaxed">
      A diferença de clima deste grupo é real e matematicamente comprovada, mas <strong>não se concentra em dimensões isoladas</strong>. Ela é formada pela soma de pequenas variações ao longo de todo o questionário. Isso indica que a percepção do grupo reflete um desgaste sistêmico, e não uma dor específica em uma ou mais dimensões específicas.
    </p>
  </div>
)}
                </div>
              </div>

              {/* RADAR CHART DOS GRUPOS */}
              <div className="bg-white p-6 rounded-xl border shadow-sm">
                <h2 className="text-lg font-bold text-gray-800 mb-2">Comparativo: {variavelSelecionada}</h2>
                <div className="h-[400px] w-full mt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="70%" data={dadosRadar}>
                      <PolarGrid stroke="#e5e7eb" />
                      <PolarAngleAxis dataKey="dimensao" tick={{ fill: '#4b5563', fontSize: 12 }} />
                      {/* Eixo Geométrico (1 a 6 elevados ao cubo) com os números ocultos */}                      
                      <PolarRadiusAxis domain={[1, 216]} ticks={[1, 8, 27, 64, 125, 216]} tick={false}/>                   
                      <RechartsTooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0, 0, 0, 0.05)' }} />
                      <Legend wrapperStyle={{ paddingTop: '20px' }} />
                      
                      {/* Baseline */}
                      <Radar name="Média Geral" dataKey="Média Geral" stroke="#94a3b8" fill="none" strokeDasharray="4 4" strokeWidth={2} />

                      {/* Categorias da Variável Demográfica */}
                      {dadosAtivos.categorias.map((cat, idx) => (
                        <Radar 
                          key={cat} 
                          name={cat} 
                          dataKey={cat} 
                          stroke={CORES_CATEGORIAS[idx % CORES_CATEGORIAS.length]} 
                          fill={CORES_CATEGORIAS[idx % CORES_CATEGORIAS.length]} 
                          fillOpacity={0.2} 
                        />
                      ))}
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>

            </div>
          )}
        </div>
      )}
    </div>
  );
}