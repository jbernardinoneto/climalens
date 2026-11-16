// src/db/db.js
import Dexie from 'dexie';

export const db = new Dexie('ClimaLensDatabase');

// O 'id' com '++' significa que será auto-incrementado.
db.version(1).stores({
  projetos: '++id, nome, dataCriacao, ultimaModificacao',
  dadosBrutos: '++id, projetoId, dados', // O JSON do Excel/CSV
  dimensoes: '++id, projetoId, mapeamento', // A parametrização das perguntas
  resultados: '++id, projetoId, matrizGower, clusters, pValues' // O resultado do Python
});