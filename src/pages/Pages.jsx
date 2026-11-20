import { useTranslation } from 'react-i18next';

// Componente genérico para poupar código nas páginas em branco
const BlankPage = ({ titleKey }) => {
  const { t } = useTranslation();
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-4">{t(titleKey)}</h1>
      <p className="text-gray-500">O conteúdo desta página será construído nos próximos passos.</p>
    </div>
  );
};

export const Home = () => <BlankPage titleKey="menu.home" />;
export const Dados = () => <BlankPage titleKey="menu.data" />;
export const Limpeza = () => <BlankPage titleKey="menu.clean" />;
export const Categorizacao = () => <BlankPage titleKey="menu.categorize" />;
export const Processamento = () => <BlankPage titleKey="menu.process" />;
export const Resultados = () => <BlankPage titleKey="menu.results" />;
export const Configuracoes = () => <BlankPage titleKey="menu.settings" />;