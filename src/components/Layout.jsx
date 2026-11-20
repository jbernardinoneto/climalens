import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { 
  Home, Database, Eraser, 
  Tags, Cpu, BarChart2, Settings, 
  PanelLeftClose, PanelLeft 
} from 'lucide-react';

export default function Layout() {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(true);

  // Separamos as configurações do menu principal
  const menuItems = [
    { path: '/', name: t('menu.home'), icon: Home },
    { path: '/dados', name: t('menu.data'), icon: Database },
    { path: '/limpeza', name: t('menu.clean'), icon: Eraser },
    { path: '/categorizacao', name: t('menu.categorize'), icon: Tags },
    { path: '/processamento', name: t('menu.process'), icon: Cpu },
    { path: '/resultados', name: t('menu.results'), icon: BarChart2 },
  ];

  return (
    <div className="flex h-screen w-full bg-slate-50 font-sans text-slate-900 overflow-hidden">
      {/* Sidebar Retrátil */}
      <aside 
        className={`${isExpanded ? 'w-64' : 'w-20'} 
        bg-white border-r border-slate-200 transition-all duration-300 ease-in-out flex flex-col z-20`}
      >
        {/* Header da Sidebar */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-100">
          <div className={`flex items-center overflow-hidden transition-all duration-300 ${isExpanded ? 'w-full opacity-100' : 'w-0 opacity-0'}`}>
            
            <span className="font-semibold text-lg tracking-tight">ClimaLens</span>
          </div>
          
          <button 
            onClick={() => setIsExpanded(!isExpanded)}
            className={`p-2 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors ${
              isExpanded ? '' : 'mx-auto w-full flex justify-center'
            }`}
          >
            {isExpanded ? <PanelLeftClose size={20} /> : <PanelLeft size={20} />}
          </button>
        </div>

        {/* Navegação Principal */}
        <nav className="flex-1 px-3 py-6 space-y-1.5 overflow-y-auto">
          {menuItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `group relative flex items-center px-3 py-2.5 rounded-lg transition-all duration-200 ${
                  isActive 
                    ? 'bg-indigo-50/80 text-indigo-600 font-medium' 
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                } ${!isExpanded && 'justify-center'}`
              }
            >
              <item.icon size={20} className="shrink-0" />
              
              {/* Texto com transição suave */}
              <span className={`ml-3 whitespace-nowrap transition-all duration-300 ${
                isExpanded ? 'opacity-100 translate-x-0 block' : 'opacity-0 -translate-x-4 hidden'
              }`}>
                {item.name}
              </span>

              {/* Tooltip Customizado (substitui o 'title' nativo do HTML) */}
              {!isExpanded && (
                <div className="absolute left-full ml-4 px-2.5 py-1.5 bg-slate-800 text-white text-sm font-medium rounded-md shadow-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 whitespace-nowrap">
                  {item.name}
                  <div className="absolute top-1/2 -left-1 -translate-y-1/2 w-2 h-2 bg-slate-800 rotate-45"></div>
                </div>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Fixar Configurações no rodapé */}
        <div className="p-3 border-t border-slate-100">
          <NavLink
            to="/configuracoes"
            className={({ isActive }) =>
              `group relative flex items-center px-3 py-2.5 rounded-lg transition-all duration-200 ${
                isActive 
                  ? 'bg-indigo-50/80 text-indigo-600 font-medium' 
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              } ${!isExpanded && 'justify-center'}`
            }
          >
            <Settings size={20} className="shrink-0" />
            <span className={`ml-3 whitespace-nowrap transition-all duration-300 ${
              isExpanded ? 'opacity-100 translate-x-0 block' : 'opacity-0 -translate-x-4 hidden'
            }`}>
              {t('menu.settings')}
            </span>
            
            {!isExpanded && (
              <div className="absolute left-full ml-4 px-2.5 py-1.5 bg-slate-800 text-white text-sm font-medium rounded-md shadow-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 whitespace-nowrap">
                {t('menu.settings')}
                <div className="absolute top-1/2 -left-1 -translate-y-1/2 w-2 h-2 bg-slate-800 rotate-45"></div>
              </div>
            )}
          </NavLink>
        </div>
      </aside>

      {/* Área de Conteúdo Principal */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-6 md:p-8 h-full">
          <div className="max-w-7xl mx-auto bg-white rounded-2xl shadow-sm border border-slate-200 p-8 min-h-[calc(100vh-4rem)]">
            <Outlet /> 
          </div>
        </div>
      </main>
    </div>
  );
}