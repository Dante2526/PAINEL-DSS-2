
import React, { useEffect, useState } from 'react';
import Modal from './Modal';
import { Employee } from '../types';
import { collection, getDocs, query } from '@firebase/firestore';
import { db } from '../firebase';

interface ReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    employees: Employee[];
    showNotification: (msg: string, type: 'success' | 'error') => void;
    scale?: number;
}

interface RegistryData {
    matricula: string;
    assunto: string;
    TURNO: string;
}

const ReportModal: React.FC<ReportModalProps> = ({ isOpen, onClose, employees, showNotification, scale }) => {
    const [manualRegistries, setManualRegistries] = useState<RegistryData[]>([]);

    useEffect(() => {
        if (isOpen) {
            const fetchRegistries = async () => {
                if (!db) return;
                try {
                    const q = query(collection(db, 'registrosDSS'));
                    const snap = await getDocs(q);
                    const data = snap.docs.map(d => d.data() as RegistryData);
                    setManualRegistries(data);
                } catch (e) {
                    console.error("Error fetching registries", e);
                }
            };
            fetchRegistries();
        }
    }, [isOpen]);

    const generateTextReport = () => {
        const date = new Date().toLocaleDateString('pt-BR');
        let report = `RELATÓRIO DSS - ${date}\n\n`;

        const appendTurno = (turno: string) => {
            report += `=== TURNO ${turno} ===\n`;
            const team = employees.filter(e => (e.turno || '7H') === turno).sort((a,b) => a.name.localeCompare(b.name));
            
            const bem = team.filter(e => e.bem);
            const mal = team.filter(e => e.mal);
            const pendentes = team.filter(e => !e.bem && !e.mal && !e.absent);

            report += `[ESTOU BEM - ${bem.length}]\n`;
            bem.forEach(e => report += `- ${e.name} (${e.matricula})\n`);
            
            report += `\n[ESTOU MAL - ${mal.length}]\n`;
            mal.forEach(e => report += `- ${e.name} (${e.matricula})\n`);

            report += `\n[PENDENTES/AUSENTES - ${pendentes.length}]\n`;
            pendentes.forEach(e => report += `- ${e.name} (${e.matricula})\n`);
            
            // Registros manuais
            const reg = manualRegistries.find(r => r.TURNO === (turno === '7H' ? '7H-19H' : '6H'));
            if(reg) {
                report += `\n[ASSUNTO DSS]: ${reg.assunto} (Responsável: ${reg.matricula})\n`;
            }
            report += '\n-----------------------------------\n\n';
        };

        appendTurno('7H');
        appendTurno('6H');
        return report;
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(generateTextReport());
        showNotification('Relatório copiado para a área de transferência!', 'success');
    };

    const handleDownload = () => {
        const element = document.createElement("a");
        const file = new Blob([generateTextReport()], {type: 'text/plain'});
        element.href = URL.createObjectURL(file);
        element.download = `relatorio-dss-${new Date().toISOString().split('T')[0]}.txt`;
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
    };

    const RenderList = ({ title, items, colorClass, icon, isMal = false }: { title: string, items: Employee[], colorClass: string, icon: string, isMal?: boolean }) => (
        <div className="mb-4">
            <div className={`px-2 py-1 ${colorClass} text-white text-[10px] md:text-xs font-bold rounded flex justify-between items-center`}>
                <span>{title} ({items.length})</span>
            </div>
            <div className="mt-1 pl-1">
                {items.length === 0 ? (
                    <span className="text-[10px] text-gray-400 italic">Ninguém</span>
                ) : (
                    <ul className="space-y-0.5">
                        {items.sort((a,b) => a.name.localeCompare(b.name)).map(e => (
                            <li key={e.id} className={`text-[10px] md:text-xs text-left truncate ${isMal ? 'font-bold text-red-500' : 'text-gray-600 dark:text-gray-300'}`}>
                                <span className="mr-1">{icon}</span>
                                {e.name} <span className="opacity-70">({e.matricula})</span>
                                {e.absent && <span className="ml-1 text-[9px] text-orange-500">(Ausente)</span>}
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );

    const TurnoColumn = ({ turno, color }: { turno: string, color: string }) => {
        const team = employees.filter(e => (e.turno || '7H') === turno);
        const bem = team.filter(e => e.bem);
        const mal = team.filter(e => e.mal);
        const pendentes = team.filter(e => !e.bem && !e.mal); // Includes absent in displayed list but marked

        return (
            <div className="flex-1 flex flex-col min-w-0">
                <h3 className={`text-xs md:text-sm font-bold uppercase mb-2 pb-1 border-b-2 ${color} text-left`}>
                    TURNO {turno}
                </h3>
                
                <RenderList 
                    title="ASS.DSS + ESTOU BEM" 
                    items={bem} 
                    colorClass="bg-success" 
                    icon="✓" 
                />
                
                <RenderList 
                    title="ESTOU MAL" 
                    items={mal} 
                    colorClass="bg-danger" 
                    icon="⚠"
                    isMal={true} 
                />

                <RenderList 
                    title="PENDENTES / AUSENTES" 
                    items={pendentes} 
                    colorClass="bg-gray-500" 
                    icon="•" 
                />
            </div>
        );
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Relatório Geral" scale={scale} maxWidth="max-w-4xl">
            <div className="flex flex-col h-full max-h-[80vh]">
                <div className="flex-grow overflow-y-auto overflow-x-hidden pr-2">
                    {/* GRID FORCED TO 2 COLS */}
                    <div className="grid grid-cols-2 gap-4 text-left">
                        <TurnoColumn turno="7H" color="border-primary text-primary" />
                        <TurnoColumn turno="6H" color="border-orange text-orange" />
                    </div>

                    <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700 text-left">
                        <h4 className="text-xs font-bold uppercase mb-2 text-gray-500">ASSUNTOS DA DSS</h4>
                        <div className="space-y-1">
                            {manualRegistries.map((reg, idx) => (
                                <div key={idx} className="text-[10px] md:text-xs text-gray-600 dark:text-gray-300 truncate">
                                    <span className="font-bold">{reg.matricula}</span> - {reg.assunto} 
                                    <span className="ml-2 px-1 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-[9px]">{reg.TURNO === '7H-19H' ? '7H' : '6H'}</span>
                                </div>
                            ))}
                            {manualRegistries.length === 0 && <span className="text-[10px] italic text-gray-400">Nenhum registro manual.</span>}
                        </div>
                    </div>
                </div>

                <div className="pt-4 mt-2 flex gap-3 justify-center border-t border-gray-100 dark:border-gray-800">
                    <button onClick={handleCopy} className="px-4 py-2 bg-primary text-white text-xs md:text-sm font-bold rounded-lg hover:bg-primary-dark transition">
                        COPIAR TEXTO
                    </button>
                    <button onClick={handleDownload} className="px-4 py-2 bg-gray-600 text-white text-xs md:text-sm font-bold rounded-lg hover:bg-gray-700 transition">
                        BAIXAR .TXT
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default ReportModal;
