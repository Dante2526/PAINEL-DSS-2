import React from 'react';
import { Employee, StatusType } from '../types';
import EmployeeCard from './EmployeeCard';
import { SubjectIcon, UserIcon } from './icons';

interface SpecialTeamPanelProps {
    specialTeam: Employee[];
    onStatusChange: (id: string, type: StatusType) => void;
    onToggleSpecialTeam: (id: string) => void;
    togglingSpecialTeamId: string | null;
    isAdmin: boolean;
    onDeleteUser: (id: string) => void;
    // New props for controlled inputs
    subject: string;
    matricula: string;
    onSubjectChange: (value: string) => void;
    onMatriculaChange: (value: string) => void;
    onRegister: () => void;
}

const SpecialTeamPanel: React.FC<SpecialTeamPanelProps> = ({ 
    specialTeam, 
    onStatusChange, 
    onToggleSpecialTeam, 
    togglingSpecialTeamId, 
    isAdmin, 
    onDeleteUser,
    subject,
    matricula,
    onSubjectChange,
    onMatriculaChange,
    onRegister
}) => {
    const handleMatriculaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onMatriculaChange(e.target.value.replace(/[^0-9]/g, ''));
    };

    return (
        <div className="w-[790px] flex-shrink-0 bg-light-card dark:bg-dark-card rounded-3xl p-8 shadow-lg h-fit">
            <h2 className="text-2xl font-bold text-center text-light-text dark:text-dark-text pb-4 mb-6 border-b-2 border-gray-200 dark:border-gray-700">TURNO 6H</h2>
            
            <div className="space-y-4 mb-6 pb-6 border-b-2 border-gray-200 dark:border-gray-700">
                <div className="relative">
                    <SubjectIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input 
                        type="text" 
                        value={subject}
                        onChange={(e) => onSubjectChange(e.target.value.toUpperCase())}
                        placeholder="Assunto do DSS" 
                        className="w-full pl-12 pr-4 py-4 bg-light-bg dark:bg-dark-bg text-light-text dark:text-dark-text border-2 border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none transition"
                    />
                </div>
                 <div className="relative">
                    <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input 
                        type="text" 
                        value={matricula}
                        onChange={handleMatriculaChange}
                        placeholder="Matrícula" 
                        className="w-full pl-12 pr-4 py-4 bg-light-bg dark:bg-dark-bg text-light-text dark:text-dark-text border-2 border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none transition"
                        inputMode="numeric"
                        pattern="[0-9]*"
                    />
                </div>
            </div>

            <button
                onClick={onRegister}
                className="w-full py-4 text-center font-bold text-white bg-gradient-to-r from-primary to-primary-dark rounded-xl shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 mb-8"
            >
                REGISTRAR
            </button>
            
            <div className="space-y-6">
                {specialTeam.map(employee => (
                    <EmployeeCard 
                        key={employee.id} 
                        employee={employee}
                        onStatusChange={onStatusChange}
                        onToggleSpecialTeam={onToggleSpecialTeam}
                        isTogglingSpecialTeam={togglingSpecialTeamId === employee.id}
                        isAdmin={isAdmin}
                        onDelete={onDeleteUser}
                    />
                ))}
            </div>
        </div>
    );
};

export default SpecialTeamPanel;