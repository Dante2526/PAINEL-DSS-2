import React from 'react';
import { ManualRegistration, Employee } from '../types';
import { TrashIcon, UserIcon, SubjectIcon } from './icons';

interface ManualRegistrationsListProps {
  title: string;
  registrations: ManualRegistration[];
  employees: Employee[];
  isAdmin: boolean;
  onDelete: (id: string) => void;
}

const ManualRegistrationsList: React.FC<ManualRegistrationsListProps> = ({ title, registrations, employees, isAdmin, onDelete }) => {
  return (
    <div className="bg-light-card dark:bg-dark-card rounded-3xl p-8 shadow-lg">
      <h3 className="text-xl font-bold text-center text-light-text dark:text-dark-text pb-4 mb-6 border-b-2 border-gray-200 dark:border-gray-700">
        {title}
      </h3>
      <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
        {registrations.map((reg) => {
          const employee = employees.find(e => e.matricula === reg.matricula);
          const employeeName = employee ? employee.name : 'Matrícula não encontrada';

          return (
            <div key={reg.id} className="bg-light-bg dark:bg-dark-bg-secondary p-4 rounded-xl flex items-center justify-between gap-4 transition-colors">
              <div className="flex flex-col flex-grow">
                <div className="flex items-center gap-2 mb-1">
                    <UserIcon className="w-4 h-4 text-gray-400" />
                    <span className="font-bold text-light-text dark:text-dark-text">{employeeName}</span>
                    <span className="text-sm text-light-text-secondary dark:text-dark-text-secondary">(Mat: {reg.matricula})</span>
                </div>
                 <div className="flex items-center gap-2 text-sm text-light-text-secondary dark:text-dark-text-secondary">
                    <SubjectIcon className="w-4 h-4 text-gray-400" />
                    <span>{reg.assunto}</span>
                </div>
              </div>
              {isAdmin && (
                <button
                  onClick={() => onDelete(reg.id)}
                  className="p-2 rounded-full text-gray-400 hover:bg-red-100 hover:text-red-500 dark:hover:bg-red-900/50 dark:hover:text-red-400 transition-colors"
                  aria-label={`Deletar registro de ${employeeName}`}
                >
                  <TrashIcon className="w-5 h-5" />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ManualRegistrationsList;
