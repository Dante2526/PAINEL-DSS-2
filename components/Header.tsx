
import React from 'react';
import DarkModeToggle from './DarkModeToggle';
import { AdminIcon } from './icons';

interface HeaderProps {
    stats: {
        bem: number;
        mal: number;
        absent: number;
        total: number;
    };
    loading: boolean;
    onAdminClick: () => void;
    isDarkMode: boolean;
    onToggleDarkMode: () => void;
}

const StatCard: React.FC<{ label: string; value: number; colorClass: string }> = ({ label, value, colorClass }) => (
    <div className="text-center p-4 bg-light-bg dark:bg-dark-bg-secondary rounded-xl min-w-[100px] transition-colors">
        <div className={`text-4xl font-bold mb-1 transition-colors ${colorClass}`}>{value}</div>
        <div className="text-xs text-light-text-secondary dark:text-dark-text-secondary uppercase font-semibold">{label}</div>
    </div>
);

const Header: React.FC<HeaderProps> = ({ stats, loading, onAdminClick, isDarkMode, onToggleDarkMode }) => {
    return (
        <header className="bg-light-card dark:bg-dark-card rounded-3xl p-10 mb-8 shadow-lg flex justify-between items-center gap-6 w-full transition-colors">
            <div className="flex items-center gap-4">
                {loading ? (
                    <div className="w-8 h-8 border-4 border-primary-light border-t-primary rounded-full animate-spin"></div>
                ) : (
                    <div className="w-8 h-8 text-primary">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                      </svg>
                    </div>
                )}
                <div>
                    <div className="flex items-center gap-4">
                        <h1 className="text-3xl font-bold text-light-text dark:text-dark-text">🛡️ Painel de Acompanhamento DSS</h1>
                    </div>
                    <p className="text-light-text-secondary dark:text-dark-text-secondary">Diálogo Diário de Segurança - Monitoramento em tempo real</p>
                </div>
            </div>
            <div className="flex flex-col items-end gap-5">
                <div className="flex items-center gap-5">
                   <DarkModeToggle isDarkMode={isDarkMode} onToggle={onToggleDarkMode} />
                    <button 
                      onClick={onAdminClick}
                      className="h-auto relative flex items-center gap-3 px-8 py-4 text-base font-bold text-white bg-gradient-to-r from-purple-500 to-indigo-600 rounded-full shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-purple-300"
                      aria-label="Acesso Administrativo"
                    >
                        <AdminIcon className="w-7 h-7" />
                        <span>ACESSO ADM</span>
                    </button>
                </div>
                 <div className="flex gap-6 justify-end">
                    <StatCard label="Estou Bem" value={stats.bem} colorClass="text-success" />
                    <StatCard label="Estou Mal" value={stats.mal} colorClass="text-danger" />
                    <StatCard label="Ausente" value={stats.absent} colorClass="text-warning" />
                    <StatCard label="Total" value={stats.total} colorClass="text-neutral" />
                </div>
            </div>
        </header>
    );
};

export default Header;