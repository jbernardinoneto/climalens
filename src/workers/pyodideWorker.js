// src/workers/pyodideWorker.js
import { loadPyodide } from "https://cdn.jsdelivr.net/pyodide/v0.25.0/full/pyodide.mjs";

let motorPyodide = null; 

self.onmessage = async (event) => {
  const { tipo, payload } = event.data;

  if (tipo === 'INICIAR_ANALISE') {
    try {
      const { dados, mapeamento } = payload;

      if (!motorPyodide) {
        self.postMessage({ type: 'STATUS', mensagem: 'A iniciar ambiente analítico...', progresso: 10 });
        motorPyodide = await loadPyodide();
        
        self.postMessage({ type: 'STATUS', mensagem: 'A carregar Pandas, Numpy e Scikit-Learn...', progresso: 30 });
        await motorPyodide.loadPackage(["pandas", "numpy", "scipy", "scikit-learn"]);
      }

      self.postMessage({ type: 'STATUS', mensagem: 'Passo 1/4: A preparar as 9 Dimensões...', progresso: 50 });

      motorPyodide.globals.set("dados_js", dados);
      motorPyodide.globals.set("mapeamento_js", mapeamento);

      const scriptPython = `
import pandas as pd
import numpy as np
from sklearn.metrics import silhouette_score
from scipy.stats import kruskal, chi2_contingency
import json

# 1. Preparação e Agregação de Dados
dados_raw = dados_js.to_py()
map_dict = mapeamento_js.to_py()
df = pd.DataFrame(dados_raw)

total_populacao = len(df)

colunas_demo = []
dim_map = {} 

for col, info in map_dict.items():
    if info['tipo'] == 'demo':
        colunas_demo.append(col)
    elif info['tipo'] == 'dim':
        dim_nome = info['valor'] 
        if dim_nome not in dim_map:
            dim_map[dim_nome] = []
        dim_map[dim_nome].append(col)

todas_colunas_questoes = [col for cols in dim_map.values() for col in cols]

for col in todas_colunas_questoes:
    df[col] = pd.to_numeric(df[col], errors='coerce')

colunas_dim_agrupadas = []
for dim_nome, cols in dim_map.items():
    df[dim_nome] = df[cols].mean(axis=1).round(2)
    colunas_dim_agrupadas.append(dim_nome)

for dim in colunas_dim_agrupadas:
    media_dimensao_geral = df[dim].mean()
    df[dim] = df[dim].fillna(media_dimensao_geral)

df = df.dropna(subset=colunas_demo).reset_index(drop=True)

n_samples = len(df)
n_num = len(colunas_dim_agrupadas)

# 2. Cálculo da Distância (APENAS NAS DIMENSÕES DE CLIMA)
dist_matrix = np.zeros((n_samples, n_samples))
num_data = df[colunas_dim_agrupadas].values

if n_num > 0:
    ranges = np.ptp(num_data, axis=0)
    ranges[ranges == 0] = 1 
    for i in range(n_num):
        dist_matrix += np.abs(num_data[:, i][:, None] - num_data[:, i]) / ranges[i]

dist_matrix /= n_num

# 3. Algoritmo K-Medoids
def k_medoids(dist, k, max_iter=50):
    np.random.seed(42)
    medoids = np.random.choice(n_samples, k, replace=False)
    clusters = np.zeros(n_samples)
    for _ in range(max_iter):
        old_medoids = np.copy(medoids)
        clusters = np.argmin(dist[:, medoids], axis=1)
        for i in range(k):
            pontos_cluster = np.where(clusters == i)[0]
            if len(pontos_cluster) > 0:
                custos = np.sum(dist[np.ix_(pontos_cluster, pontos_cluster)], axis=1)
                medoids[i] = pontos_cluster[np.argmin(custos)]
        if np.array_equal(old_medoids, medoids):
            break
    return clusters

# 4. Descoberta do K ideal
best_k = 2
best_score = -1
best_labels = None
max_k = min(10, n_samples - 1) if n_samples > 10 else n_samples - 1

for k in range(2, max_k + 1):
    labels = k_medoids(dist_matrix, k)
    if len(np.unique(labels)) > 1:
        score = silhouette_score(dist_matrix, labels, metric='precomputed')
        if score > best_score:
            best_score = score
            best_k = k
            best_labels = labels

df['Microclima'] = best_labels.astype(int) + 1

# 5. Validação Global: PERMANOVA
def calc_pseudo_f(dist, labels, k):
    sst = np.sum(dist ** 2) / n_samples
    ssw = 0
    for i in range(k):
        idx = np.where(labels == i)[0]
        if len(idx) > 0:
            ssw += np.sum(dist[np.ix_(idx, idx)] ** 2) / len(idx)
    ssa = sst - ssw
    if ssw == 0: return 0
    return (ssa / (k - 1)) / (ssw / (n_samples - k))

f_obs = calc_pseudo_f(dist_matrix, best_labels, best_k)
perm_count = 0
n_perms = 99
for _ in range(n_perms):
    perm_labels = np.random.permutation(best_labels)
    if calc_pseudo_f(dist_matrix, perm_labels, best_k) >= f_obs:
        perm_count += 1
permanova_p = (perm_count + 1) / (n_perms + 1)

# 6. Validação Específica Clima (Kruskal-Wallis)
kw_resultados = {}
for col in colunas_dim_agrupadas:
    grupos = [df[df['Microclima'] == (i+1)][col].values for i in range(best_k)]
    try:
        stat, p_val = kruskal(*grupos)
        kw_resultados[col] = {'estatistica': round(stat, 3), 'p_valor': round(p_val, 4), 'significativo': bool(p_val < 0.05)}
    except:
        kw_resultados[col] = {'estatistica': None, 'p_valor': None, 'significativo': False}

# 7. NOVO: Criação das Personas (Cartões de Perfil por Microclima)
perfis_microclimas = {}

for mc in range(1, best_k + 1):
    df_mc = df[df['Microclima'] == mc]
    tamanho = len(df_mc)
    
    # Termómetro do Clima (Média das dimensões deste grupo)
    media_geral = df_mc[colunas_dim_agrupadas].mean().mean()
    if media_geral >= 4.0:
        classificacao = "Avaliação Positiva"
    elif media_geral <= 3.2:
        classificacao = "Avaliação Crítica"
    else:
        classificacao = "Avaliação Moderada"
        
    # Maior dor (Dimensão com nota mais baixa neste grupo)
    medias_dim = df_mc[colunas_dim_agrupadas].mean()
    dor_nome = medias_dim.idxmin()
    dor_valor = medias_dim.min()
    
    # Perfil Demográfico Dominante
    perfil = {}
    for col in colunas_demo:
        tabela = pd.crosstab(df['Microclima'], df[col])
        try:
            chi2, p_val, dof, expected = chi2_contingency(tabela)
            is_sig = bool(p_val < 0.05)
            
            # Categoria mais frequente dentro do microclima
            cat_dominante = df_mc[col].value_counts().idxmax()
            perc = (df_mc[col].value_counts().max() / tamanho) * 100
            
            perfil[col] = {
                "categoria": str(cat_dominante),
                "percentual": round(perc, 1),
                "significativo": is_sig # Se for true, significa que esta característica difere estatisticamente dos outros grupos
            }
        except:
            pass

    perfis_microclimas[f"Microclima {mc}"] = {
        "tamanho": int(tamanho),
        "percentual": round((tamanho / n_samples) * 100, 1),
        "media_geral": round(media_geral, 2),
        "classificacao": classificacao,
        "maior_dor": f"{dor_nome} ({round(dor_valor, 1)})",
        "perfil": perfil
    }

# 8. Retorno
contagem_clusters = df['Microclima'].value_counts().to_dict()
df_json = df.replace({np.nan: None})

resultado = {
    "status": "sucesso",
    "total_populacao": int(total_populacao),
    "k_ideal": int(best_k),
    "silhouette_score": round(best_score, 3),
    "tamanho_microclimas": {f"Microclima {k}": int(v) for k, v in contagem_clusters.items()},
    "permanova": {
        "pseudo_f": round(f_obs, 3),
        "p_valor": round(permanova_p, 4),
        "significativo": bool(permanova_p < 0.05)
    },
    "kruskal_wallis": kw_resultados,
    "perfis_microclimas": perfis_microclimas,
    "dados_com_clusters": df_json.to_dict(orient='records')
}

json.dumps(resultado)
      `;

      self.postMessage({ type: 'STATUS', mensagem: 'Passo 3/4: A gerar Cartões de Persona...', progresso: 75 });
      const resultadoJSON = await motorPyodide.runPythonAsync(scriptPython);
      
      self.postMessage({ type: 'STATUS', mensagem: 'Passo 4/4: A finalizar cálculos...', progresso: 95 });
      self.postMessage({ type: 'SUCESSO', payload: JSON.parse(resultadoJSON) });

    } catch (erro) {
      self.postMessage({ type: 'ERRO', payload: String(erro) });
    }
  }
};