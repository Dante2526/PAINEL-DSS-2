
import React from 'react';
import { Employee, StatusType } from '../types';
import { ShiftIcon, AbsentIcon, TrashIcon } from './icons';
import { formatTimestamp } from '../services/employeeService';

interface EmployeeCardProps {
    employee: Employee;
    onStatusChange: (id: string, type: StatusType) => void;
    onToggleSpecialTeam: (id: string) => void;
    isTogglingSpecialTeam: boolean;
    isAdmin: boolean;
    onDelete: (id: string) => void;
}

interface CheckboxItemProps {
    label: string;
    icon: string;
    type: StatusType;
    checked: boolean;
    checkedClass: string;
    textColor: string;
    borderColor: string;
    darkBg: string;
    onClick: () => void;
}

const CheckboxItem: React.FC<CheckboxItemProps> = ({ label, icon, type, checked, checkedClass, textColor, borderColor, darkBg, onClick }) => (
    <div
        className={`p-5 flex flex-col items-center gap-3 rounded-xl cursor-pointer transition-all duration-300 ease-in-out transform hover:scale-105 border-2 ${checked ? `${checkedClass} border-${borderColor} dark:bg-${darkBg}` : 'bg-light-bg dark:bg-dark-bg border-transparent'}`}
        onClick={onClick}
    >
        <div className={`text-5xl transition-all duration-300 ${checked ? 'grayscale-0 opacity-100' : 'grayscale opacity-50'}`}>{icon}</div>
        <div className={`text-base font-bold text-center ${checked ? `text-${textColor} dark:text-white` : 'text-light-text-secondary dark:text-dark-text-secondary'}`}>{label}</div>
        <div className={`w-9 h-9 rounded-full border-2 flex items-center justify-center transition-colors ${checked ? `bg-${borderColor} border-${borderColor}` : 'bg-white dark:bg-dark-bg-secondary border-gray-300 dark:border-gray-500'}`}>
            {checked && <span className="text-white font-bold text-lg">✓</span>}
        </div>
    </div>
);


const EmployeeCard: React.FC<EmployeeCardProps> = ({ employee, onStatusChange, onToggleSpecialTeam, isTogglingSpecialTeam, isAdmin, onDelete }) => {
    
    const createRipple = (e: React.MouseEvent<HTMLButtonElement>) => {
        const button = e.currentTarget;
        
        const ripple = document.createElement("span");
        const diameter = Math.max(button.clientWidth, button.clientHeight);
        const radius = diameter / 2;
        const rect = button.getBoundingClientRect();

        ripple.style.width = ripple.style.height = `${diameter}px`;
        ripple.style.left = `${e.clientX - rect.left - radius}px`;
        ripple.style.top = `${e.clientY - rect.top - radius}px`;
        ripple.classList.add("ripple");

        const existingRipple = button.querySelector('.ripple');
        if(existingRipple) {
            existingRipple.remove();
        }
        
        button.appendChild(ripple);

        ripple.addEventListener('animationend', () => {
            ripple.remove();
        });
    };

    const handleToggleSpecialTeamClick = (e: React.MouseEvent<HTMLButtonElement>) => {
        if (isTogglingSpecialTeam) return;
        createRipple(e);
        onToggleSpecialTeam(employee.id);
    };

    const handleAbsentButtonClick = (e: React.MouseEvent<HTMLButtonElement>) => {
        createRipple(e);
        onStatusChange(employee.id, 'absent');
    };
    
    const getHeaderClass = () => {
        if (employee.bem) return 'bg-gradient-to-r from-success to-green-600';
        if (employee.mal) return 'bg-gradient-to-r from-danger to-red-600';
        if (employee.absent) return 'bg-gradient-to-r from-warning to-amber-600';
        if (employee.assDss) return 'bg-gradient-to-r from-neutral to-gray-500';
        return 'bg-gradient-to-r from-primary to-primary-dark';
    };

    return (
        <div className="w-full bg-light-card dark:bg-dark-card rounded-2xl shadow-md hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden">
            {/* Header com padding reduzido (p-3) para ganhar espaço */}
            <div className={`p-3 flex items-center text-white ${getHeaderClass()}`}>
                {/* Avatar reduzido (w-12 h-12) e margem reduzida (mr-3) */}
                <div className="w-12 h-12 bg-white/25 rounded-full flex items-center justify-center text-2xl mr-3 flex-shrink-0">👤</div>
                
                <div className="flex-grow min-w-0">
                    {/* Tamanho da fonte do nome ajustado para text-xl */}
                    <div className="text-xl font-bold truncate pr-2" title={employee.name}>{employee.name}</div>
                    <div className="text-sm opacity-90 truncate">Matrícula: {employee.matricula}</div>
                </div>
                
                {/* Gap entre botões reduzido para gap-1 */}
                <div className="flex gap-1 flex-shrink-0 items-center">
                    <button
                        onClick={handleToggleSpecialTeamClick}
                        disabled={isTogglingSpecialTeam}
                        className={`turno-button ${employee.turno === '6H' ? 'active' : ''} ${isTogglingSpecialTeam ? 'loading' : ''}`}
                    >
                        <div className="default-state">
                            <ShiftIcon className="w-4 h-4" /> {/* Ícone menor */}
                            <span>TURNO 6H</span>
                        </div>
                        <div className="loading-state">
                            <div className="spinner"></div>
                            <span>SALVANDO</span>
                        </div>
                    </button>
                    <button
                        onClick={handleAbsentButtonClick}
                        className={`absent-button ${employee.absent ? 'marked' : ''}`}
                    >
                        <AbsentIcon className="w-4 h-4" /> {/* Ícone menor */}
                        <span>AUSENTE</span>
                    </button>
                    {isAdmin && (
                        <button
                            onClick={() => onDelete(employee.id)}
                            className="delete-button"
                            aria-label={`Deletar ${employee.name}`}
                        >
                            <TrashIcon className="w-4 h-4" /> {/* Ícone menor */}
                            <span>DELETAR</span>
                        </button>
                    )}
                </div>
            </div>

            <div className="p-7 grid grid-cols-3 gap-5">
                <CheckboxItem
                    label="ASS. DSS"
                    icon="📄"
                    type="assDss"
                    checked={employee.assDss}
                    onClick={() => onStatusChange(employee.id, 'assDss')}
                    checkedClass="bg-gray-100"
                    textColor="neutral"
                    borderColor="neutral"
                    darkBg="gray-600"
                />
                <CheckboxItem
                    label="ESTOU BEM"
                    icon="🙂"
                    type="bem"
                    checked={employee.bem}
                    onClick={() => onStatusChange(employee.id, 'bem')}
                    checkedClass="bg-green-50"
                    textColor="success"
                    borderColor="success"
                    darkBg="green-800"
                />
                <CheckboxItem
                    label="ESTOU MAL"
                    icon="😟"
                    type="mal"
                    checked={employee.mal}
                    onClick={() => onStatusChange(employee.id, 'mal')}
                    checkedClass="bg-red-50"
                    textColor="danger"
                    borderColor="danger"
                    darkBg="red-800"
                />
            </div>

            <div className="px-7 pb-7 text-center">
                <div className={`py-4 px-6 inline-block rounded-lg font-bold text-base min-w-[240px] ${employee.time ? 'bg-gradient-to-r from-orange to-amber-500 text-white' : 'bg-light-bg dark:bg-dark-bg text-light-text-secondary dark:text-dark-text-secondary'}`}>
                    {formatTimestamp(employee.time)}
                </div>
                <div className="mt-3 text-sm font-semibold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">
                    Data / Hora da Assinatura
                </div>
            </div>
        </div>
    );
};

export default EmployeeCard;
