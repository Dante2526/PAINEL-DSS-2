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
        className={`p-4 flex flex-col items-center gap-2 rounded-xl cursor-pointer transition-all duration-300 ease-in-out transform hover:scale-105 border-2 ${checked ? `${checkedClass} border-${borderColor} dark:bg-${darkBg}` : 'bg-light-bg dark:bg-dark-bg border-transparent'}`}
        onClick={onClick}
    >
        <div className={`text-4xl transition-all duration-300 ${checked ? 'grayscale-0 opacity-100' : 'grayscale opacity-50'}`}>{icon}</div>
        <div className={`text-sm font-bold text-center ${checked ? `text-${textColor} dark:text-white` : 'text-light-text-secondary dark:text-dark-text-secondary'}`}>{label}</div>
        <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center transition-colors ${checked ? `bg-${borderColor} border-${borderColor}` : 'bg-white dark:bg-dark-bg-secondary border-gray-300 dark:border-gray-500'}`}>
            {checked && <span className="text-white font-bold">✓</span>}
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
            <div className={`p-6 flex items-center text-white ${getHeaderClass()}`}>
                <div className="w-14 h-14 bg-white/25 rounded-full flex items-center justify-center text-2xl mr-5">👤</div>
                <div className="flex-grow">
                    <div className="text-xl font-bold">{employee.name}</div>
                    <div className="text-sm opacity-90">Matrícula: {employee.matricula}</div>
                </div>
                <div className="flex gap-2.5">
                    <button
                        onClick={handleToggleSpecialTeamClick}
                        disabled={isTogglingSpecialTeam}
                        className={`turno-button ${employee.inSpecialTeam ? 'active' : ''} ${isTogglingSpecialTeam ? 'loading' : ''}`}
                    >
                        <div className="default-state">
                            <ShiftIcon className="w-5 h-5" />
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
                        <AbsentIcon className="w-5 h-5" />
                        <span>AUSENTE</span>
                    </button>
                    {isAdmin && (
                        <button
                            onClick={() => onDelete(employee.id)}
                            className="delete-button"
                            aria-label={`Deletar ${employee.name}`}
                        >
                            <TrashIcon className="w-5 h-5" />
                            <span>DELETAR</span>
                        </button>
                    )}
                </div>
            </div>

            <div className="p-6 grid grid-cols-3 gap-4">
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

            <div className="px-6 pb-6 text-center">
                <div className={`py-3 px-5 inline-block rounded-lg font-bold text-sm min-w-[220px] ${employee.time ? 'bg-gradient-to-r from-orange to-amber-500 text-white' : 'bg-light-bg dark:bg-dark-bg text-light-text-secondary dark:text-dark-text-secondary'}`}>
                    {formatTimestamp(employee.time)}
                </div>
                <div className="mt-2 text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">
                    Data / Hora da Assinatura
                </div>
            </div>
        </div>
    );
};

export default EmployeeCard;