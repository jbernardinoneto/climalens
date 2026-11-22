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
        self.postMessage({ type: 'STATUS', mensagem: 'A carregar bibliotecas (DBSCAN)...', progresso: 30 });
        await motorPyodide.loadPackage(["pandas", "numpy", "scipy", "scikit-learn"]);
      }

      self.postMessage({ type: 'STATUS', mensagem: 'Passo 1/4: A preparar as 9 Dimensões...', progresso: 50 });

      motorPyodide.globals.set("dados_js", dados);
      motorPyodide.globals.set("mapeamento_js", mapeamento);

      const scriptPython = `
import pandas as pd
import numpy as np
from sklearn.cluster import DBSCAN
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
        if 'agrupamentos' in info and info['agrupamentos']:
            df[col] = df[col].replace(info['agrupamentos'])
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

# 2. Cálculo da Distância (APENAS CLIMA)
dist_matrix = np.zeros((n_samples, n_samples))
num_data = df[colunas_dim_agrupadas].values

if n_num > 0:
    ranges = np.ptp(num_data, axis=0)
    ranges[ranges == 0] = 1 
    for i in range(n_num):
        dist_matrix += np.abs(num_data[:, i][:, None] - num_data[:, i]) / ranges[i]
dist_matrix /= n_num

# 3. Algoritmo DBSCAN (Densidade) com Auto-Tuning
best_eps = 0.1
best_score = -1
best_labels = np.full(n_samples, -1)
best_k = 0

# Define o tamanho mínimo do grupo como 5% da amostra válida
# O "max(3, ...)" garante que, em amostras muito pequenas, o mínimo nunca seja inferior a 3 pessoas
percentual_minimo = 0.025 
min_pessoas = max(3, int(n_samples * percentual_minimo))

# Testa vários níveis de rigor (eps)
for eps in np.arange(0.05, 0.6, 0.02):
    # Usa a variável min_pessoas calculada dinamicamente
    db = DBSCAN(eps=eps, min_samples=min_pessoas, metric='precomputed')
    labels = db.fit_predict(dist_matrix)
    
    unique_labels = set(labels)
    unique_labels.discard(-1) 
    
    if len(unique_labels) > 1:
        valid_idx = labels != -1
        if sum(valid_idx) > 0:
            score = silhouette_score(dist_matrix[valid_idx][:, valid_idx], labels[valid_idx], metric='precomputed')
            if score > best_score:
                best_score = score
                best_labels = labels
                best_k = len(unique_labels)

# Fallback para capturar pelo menos 1 grupo forte se os dados forem muito dispersos
if best_k == 0:
    for eps in np.arange(0.05, 0.6, 0.05):
        # Aqui também usamos a variável dinâmica
        db = DBSCAN(eps=eps, min_samples=min_pessoas, metric='precomputed')
        labels = db.fit_predict(dist_matrix)
        unique_labels = set(labels)
        unique_labels.discard(-1)
        if len(unique_labels) > 0:
            best_labels = labels
            best_k = len(unique_labels)
            best_score = 0
            break

# 4. Rotulagem dos Dados
def map_cluster_name(c_id):
    if c_id == -1: return 'Sem Padrão'
    return f'Microclima {int(c_id) + 1}'

df['Microclima'] = [map_cluster_name(x) for x in best_labels]
df_validos = df[df['Microclima'] != 'Sem Padrão'] # Isola apenas as "tribos" reais para testes

# 5. Validação Global: PERMANOVA (Apenas nos grupos válidos)
f_obs, permanova_p = 0, 1.0
if best_k > 1:
    dist_validos = dist_matrix[best_labels != -1][:, best_labels != -1]
    labels_validos = best_labels[best_labels != -1]
    n_validos = len(labels_validos)
    
    def calc_pseudo_f(dist, labels, k):
        sst = np.sum(dist ** 2) / n_validos
        ssw = 0
        for i in range(k):
            idx = np.where(labels == i)[0]
            if len(idx) > 0:
                ssw += np.sum(dist[np.ix_(idx, idx)] ** 2) / len(idx)
        ssa = sst - ssw
        if ssw == 0: return 0
        return (ssa / (k - 1)) / (ssw / (n_validos - k))

    f_obs = calc_pseudo_f(dist_validos, labels_validos, best_k)
    perm_count, n_perms = 0, 99
    for _ in range(n_perms):
        perm_labels = np.random.permutation(labels_validos)
        if calc_pseudo_f(dist_validos, perm_labels, best_k) >= f_obs:
            perm_count += 1
    permanova_p = (perm_count + 1) / (n_perms + 1)

# 6. Kruskal-Wallis (Apenas nos grupos válidos)
kw_resultados = {}
for col in colunas_dim_agrupadas:
    if best_k > 1:
        grupos = [df_validos[df_validos['Microclima'] == f'Microclima {i+1}'][col].values for i in range(best_k)]
        try:
            stat, p_val = kruskal(*grupos)
            kw_resultados[col] = {'estatistica': round(stat, 3), 'p_valor': round(p_val, 4), 'significativo': bool(p_val < 0.05)}
        except:
            kw_resultados[col] = {'estatistica': None, 'p_valor': None, 'significativo': False}
    else:
        kw_resultados[col] = {'estatistica': None, 'p_valor': None, 'significativo': False}

# 7. Personas (Cartões apenas para Microclimas válidos)
perfis_microclimas = {}
for mc in range(1, best_k + 1):
    nome_mc = f"Microclima {mc}"
    df_mc = df_validos[df_validos['Microclima'] == nome_mc]
    tamanho = len(df_mc)
    
    media_geral = df_mc[colunas_dim_agrupadas].mean().mean()
    classificacao = "Avaliação Positiva" if media_geral >= 4.0 else ("Avaliação Crítica" if media_geral <= 3.2 else "Avaliação Moderada")
        
    medias_dim = df_mc[colunas_dim_agrupadas].mean()
    dor_nome, dor_valor = medias_dim.idxmin(), medias_dim.min()
    
    perfil = {}
    for col in colunas_demo:
        tabela = pd.crosstab(df_validos['Microclima'], df_validos[col])
        try:
            chi2, p_val, dof, expected = chi2_contingency(tabela)
            is_sig = bool(p_val < 0.05)
            cat_dominante = df_mc[col].value_counts().idxmax()
            perc = (df_mc[col].value_counts().max() / tamanho) * 100
            
            perfil[col] = {
                "categoria": str(cat_dominante),
                "percentual": round(perc, 1),
                "significativo": is_sig
            }
        except: pass

    perfis_microclimas[nome_mc] = {
        "tamanho": int(tamanho),
        "percentual": round((tamanho / total_populacao) * 100, 1),
        "media_geral": round(media_geral, 2),
        "classificacao": classificacao,
        "maior_dor": f"{dor_nome} ({round(dor_valor, 1)})",
        "perfil": perfil
    }

# 8. Retorno
contagem_geral = df['Microclima'].value_counts().to_dict()
df_json = df.replace({np.nan: None})

resultado = {
    "status": "sucesso",
    "total_populacao": int(total_populacao),
    "k_ideal": int(best_k),
    "silhouette_score": round(best_score, 3) if best_score > -1 else 0,
    "tamanho_microclimas": contagem_geral,
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

      self.postMessage({ type: 'STATUS', mensagem: 'Passo 3/4: A gerar Cartões de Persona (DBSCAN)...', progresso: 75 });
      const resultadoJSON = await motorPyodide.runPythonAsync(scriptPython);
      self.postMessage({ type: 'STATUS', mensagem: 'Passo 4/4: A finalizar cálculos...', progresso: 95 });
      self.postMessage({ type: 'SUCESSO', payload: JSON.parse(resultadoJSON) });

    } catch (erro) {
      self.postMessage({ type: 'ERRO', payload: String(erro) });
    }
  }
};