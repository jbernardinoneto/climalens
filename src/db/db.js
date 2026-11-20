import Dexie from 'dexie';

export const db = new Dexie('AtmosLabDatabase');

db.version(1).stores({
  // ++id cria um identificador único auto-incrementado.
  // nome e dataCriacao são indexados para facilitar buscas futuras.
  datasets: '++id, nome, dataCriacao' 
});