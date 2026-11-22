import { loadPyodide } from "https://cdn.jsdelivr.net/pyodide/v0.25.0/full/pyodide.mjs";

let motorPyodide = null; 

self.onmessage = async (event) => {
  const { tipo, payload } = event.data;

  if (tipo === 'INICIAR_ANALISE') {
    try {
      const { dados, mapeamento } = payload;

      if (!motorPyodide) {
        self.postMessage({ type: 'STATUS', mensagem: 'Iniciando ambiente analítico...', progresso: 10 });
        motorPyodide = await loadPyodide();
        self.postMessage({ type: 'STATUS', mensagem: 'Carregando bibliotecas matemáticas do Python...', progresso: 30 });
        await motorPyodide.loadPackage(["pandas", "numpy", "scipy"]);
      }

      self.postMessage({ type: 'STATUS', mensagem: 'Passo 1/3: Processando matrizes de distância...', progresso: 50 });

      motorPyodide.globals.set("dados_js", dados);
      motorPyodide.globals.set("mapeamento_js", mapeamento);

      const scriptPython = `
import pandas as pd
import numpy as np
from scipy.stats import kruskal
import json
import random

# Obriga a matemática a ser 100% idêntica em todos os processamentos
np.random.seed(42)
random.seed(42)

# Classe para blindar falhas de conversão Numpy -> JSON
class NumpyEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, np.integer): return int(obj)
        if isinstance(obj, np.floating): return float(obj)
        if isinstance(obj, np.ndarray): return obj.tolist()
        return super(NumpyEncoder, self).default(obj)

# 1. Preparação de Dados
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

df = df.dropna(subset=colunas_dim_agrupadas)
df = df.reset_index(drop=True)
n_samples = len(df)
n_num = len(colunas_dim_agrupadas)

# 2. Matriz de Distância (Base para PERMANOVA)
dist_matrix = np.zeros((n_samples, n_samples))
num_data = df[colunas_dim_agrupadas].values

if n_num > 0:
    ranges = np.ptp(num_data, axis=0)
    ranges[ranges == 0] = 1 
    for i in range(n_num):
        dist_matrix += np.abs(num_data[:, i][:, None] - num_data[:, i]) / ranges[i]
dist_matrix /= n_num

def fdr_correction(p_values):
    n = len(p_values)
    if n == 0: return []
    sorted_indices = np.argsort(p_values)
    sorted_p = np.array(p_values)[sorted_indices]
    fdr_p = np.minimum.accumulate((sorted_p * n / np.arange(1, n + 1))[::-1])[::-1]
    fdr_p = np.minimum(fdr_p, 1.0)
    orig_order_fdr = np.zeros(n)
    orig_order_fdr[sorted_indices] = fdr_p
    return orig_order_fdr.tolist()

# 3. Análise Supervisionada (PERMANOVA, PERMDISP e Post-Hoc)
resultados_demo = {}

for col in colunas_demo:
    valid_mask = df[col].notna().values # Força a ser Array Numpy para evitar erros de index
    if sum(valid_mask) < 5: continue
    
    labels = df.loc[valid_mask, col].values
    unique_labels = np.unique(labels)
    if len(unique_labels) < 2: continue
    
    # Recorte seguro da matriz 2D
    D = dist_matrix[valid_mask][:, valid_mask]
    n_val = len(labels)
    k = len(unique_labels)
    
    sst = np.sum(D**2) / n_val
    ssw = 0
    for g in unique_labels:
        idx = np.where(labels == g)[0]
        if len(idx) > 0:
            ssw += np.sum(D[idx][:, idx]**2) / len(idx)
    ssa = sst - ssw
    r2 = ssa / sst if sst > 0 else 0
    
    f_obs = 0 if (ssw == 0 or k == 1 or n_val == k) else (ssa / (k - 1)) / (ssw / (n_val - k))
    
    n_perms = 99
    count_perm = 0
    for _ in range(n_perms):
        perm_labels = np.random.permutation(labels)
        ssw_perm = 0
        for g in unique_labels:
            idx = np.where(perm_labels == g)[0]
            if len(idx) > 0:
                ssw_perm += np.sum(D[idx][:, idx]**2) / len(idx)
        ssa_perm = sst - ssw_perm
        f_perm = 0 if ssw_perm == 0 else (ssa_perm / (k - 1)) / (ssw_perm / (n_val - k))
        if f_perm >= f_obs: count_perm += 1
    p_permanova = (count_perm + 1) / (n_perms + 1)
    
    z_distances = np.zeros(n_val)
    for g in unique_labels:
        idx = np.where(labels == g)[0]
        n_g = len(idx)
        if n_g > 1:
            D_g = D[idx][:, idx]
            sum_d2_ij = np.sum(D_g**2, axis=1) / n_g
            sum_d2_jk = np.sum(D_g**2) / (n_g**2)
            z2 = sum_d2_ij - sum_d2_jk
            z2[z2 < 0] = 0
            z_distances[idx] = np.sqrt(z2)
            
    z_groups = [z_distances[labels == g] for g in unique_labels]
    try:
        _, p_permdisp = kruskal(*z_groups)
    except:
        p_permdisp = 1.0
        
    post_hoc = {}
    if p_permanova < 0.05:
        p_raw = []
        dims = []
        for dim in colunas_dim_agrupadas:
            dim_groups = [df.loc[valid_mask & (df[col] == g), dim].values for g in unique_labels]
            try:
                _, p_val = kruskal(*dim_groups)
                p_raw.append(p_val)
                dims.append(dim)
            except:
                p_raw.append(1.0)
                dims.append(dim)
        
        p_fdr = fdr_correction(p_raw)
        for dim, pr, pfdr in zip(dims, p_raw, p_fdr):
            post_hoc[dim] = {
                "p_raw": float(pr),
                "p_fdr": float(pfdr),
                "significativo": bool(pfdr < 0.05)
            }
            
    medias_cat = {}
    for g in unique_labels:
        medias_cat[str(g)] = df.loc[valid_mask & (df[col] == g), colunas_dim_agrupadas].mean().round(2).to_dict()
        
    resultados_demo[col] = {
        "r2": float(round(r2, 4)),
        "p_permanova": float(round(p_permanova, 4)),
        "significativo": bool(p_permanova < 0.05),
        "p_permdisp": float(round(p_permdisp, 4)),
        "dispersao_diferente": bool(p_permdisp < 0.05),
        "post_hoc": post_hoc,
        "categorias": list(map(str, unique_labels)),
        "medias": medias_cat
    }

# 4. Retorno (Usando o encoder blindado)
resultado = {
    "status": "sucesso",
    "total_populacao": int(total_populacao),
    "demografia": resultados_demo,
    "dimensoes_avaliadas": colunas_dim_agrupadas,
    "media_geral": df[colunas_dim_agrupadas].mean().round(2).to_dict()
}

json.dumps(resultado, cls=NumpyEncoder)
      `;

      self.postMessage({ type: 'STATUS', mensagem: 'Passo 2/3: Executando PERMANOVA e testes de dispersão...', progresso: 75 });
      const resultadoJSON = await motorPyodide.runPythonAsync(scriptPython);
      self.postMessage({ type: 'STATUS', mensagem: 'Passo 3/3: Finalizando relatório...', progresso: 95 });
      self.postMessage({ type: 'SUCESSO', payload: JSON.parse(resultadoJSON) });

    } catch (erro) {
      self.postMessage({ type: 'ERRO', payload: String(erro) });
    }
  }
};