import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { Database, FileUp, Trash2, FileSpreadsheet } from 'lucide-react';

export default function Dados() {
  const { t } = useTranslation();
  const [nomeRepositorio, setNomeRepositorio] = useState('');
  const [arquivo, setArquivo] = useState(null);
  const [carregando, setCarregando] = useState(false);

  // useLiveQuery atualiza a lista automaticamente sempre que o banco muda
  const datasets = useLiveQuery(() => db.datasets.toArray());

  const processarExcel = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          // Lê o arquivo binário
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          
          // Pega a primeira aba da planilha
          const primeiraAba = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[primeiraAba];
          
          // Converte automaticamente para um Array de Objetos JSON
          const jsonDados = XLSX.utils.sheet_to_json(worksheet);
          resolve(jsonDados);
        } catch (error) {
          reject(error);
        }
      };
      
      reader.onerror = (error) => reject(error);
      reader.readAsArrayBuffer(file);
    });
  };

  const processarCSV = (file) => {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => resolve(results.data),
        error: (error) => reject(error)
      });
    });
  };

  const handleSalvarDados = async () => {
    if (!arquivo || !nomeRepositorio.trim()) return;
    setCarregando(true);

    try {
      let jsonDados = [];
      const extensao = arquivo.name.split('.').pop().toLowerCase();

      if (extensao === 'csv') {
        jsonDados = await processarCSV(arquivo);
      } else if (extensao === 'xlsx') {
        jsonDados = await processarExcel(arquivo);
      } else {
        alert("Formato não suportado. Use CSV ou XLSX.");
        setCarregando(false);
        return;
      }

      // Salva no IndexedDB
      await db.datasets.add({
        nome: nomeRepositorio.trim(),
        dados: jsonDados,
        dataCriacao: new Date().toISOString()
      });

      // Limpa os campos após salvar
      setNomeRepositorio('');
      setArquivo(null);
      document.getElementById('file-upload').value = '';
    } catch (error) {
      console.error("Erro ao processar arquivo:", error);
      alert("Ocorreu um erro ao ler o arquivo.");
    } finally {
      setCarregando(false);
    }
  };

  const deletarDataset = async (id) => {
    if (window.confirm("Deseja realmente apagar este repositório?")) {
      await db.datasets.delete(id);
    }
  };

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
        <Database className="text-blue-600" /> {t('menu.data', 'Dados')}
      </h1>

      {/* Sessão de Upload */}
      <div className="bg-gray-50 p-6 rounded-xl border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-700 mb-4">Carregar Novos Dados</h2>
        <div className="flex flex-col md:flex-row gap-4 items-end">
          <div className="flex-1 w-full">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nome do Repositório
            </label>
            <input
              type="text"
              value={nomeRepositorio}
              onChange={(e) => setNomeRepositorio(e.target.value)}
              placeholder="Ex: Pesquisa TRE-TO 2026"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
            />
          </div>
          
          <div className="flex-1 w-full">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Arquivo (CSV ou XLSX)
            </label>
            <input
              id="file-upload"
              type="file"
              accept=".csv, .xlsx"
              onChange={(e) => setArquivo(e.target.files[0])}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white file:mr-4 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
          </div>

          <button
            onClick={handleSalvarDados}
            disabled={!nomeRepositorio.trim() || !arquivo || carregando}
            className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            <FileUp size={20} />
            {carregando ? 'Processando...' : 'Salvar'}
          </button>
        </div>
      </div>

      {/* Lista de Repositórios Salvos */}
      <div>
        <h2 className="text-lg font-semibold text-gray-700 mb-4">Repositórios Locais</h2>
        
        {!datasets ? (
          <p className="text-gray-500">Carregando...</p>
        ) : datasets.length === 0 ? (
          <div className="text-center py-10 bg-white border border-gray-200 rounded-xl border-dashed">
            <FileSpreadsheet className="mx-auto h-12 w-12 text-gray-400 mb-3" />
            <p className="text-gray-500">Nenhum dado armazenado. Carregue seu primeiro arquivo acima.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {datasets.map((dataset) => (
              <div key={dataset.id} className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
                <div>
                  <h3 className="font-bold text-gray-800 text-lg truncate" title={dataset.nome}>
                    {dataset.nome}
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    {dataset.dados.length} registros
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    Criado em: {new Date(dataset.dataCriacao).toLocaleDateString()}
                  </p>
                </div>
                <div className="mt-4 flex justify-end">
                  <button 
                    onClick={() => deletarDataset(dataset.id)}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    title="Apagar repositório"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}