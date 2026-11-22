import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
  pt: {
    translation: {
      menu: {
        home: "Início",
        data: "Dados",
        clean: "Limpeza de Dados",
        categorize: "Variáveis",
        process: "Processamento",
        results: "Resultados",
        settings: "Configurações"
      }
    }
  },
  en: {
    translation: {
      menu: {
        home: "Home",
        data: "Data",
        clean: "Data Cleaning",
        categorize: "Categorization",
        process: "Processing",
        results: "Results",
        settings: "Settings"
      }
    }
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: "pt", // Idioma padrão
    fallbackLng: "en",
    interpolation: { escapeValue: false }
  });

export default i18n;