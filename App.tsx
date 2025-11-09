import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Header from './components/Header';
import EmployeeCard from './components/EmployeeCard';
import SpecialTeamPanel from './components/SpecialTeamPanel';
import Modal from './components/Modal';
import Notification from './components/Notification';
import Footer from './components/Footer';
import { SubjectIcon, UserIcon } from './components/icons';
import { Employee, StatusType, ModalType, ManualRegistration } from './types';
import type { NotificationData } from './components/Notification';
import { db, auth, isConfigured } from './firebase';
import { 
    collection, 
    query, 
    orderBy, 
    onSnapshot,
    doc,
    updateDoc,
    addDoc,
    writeBatch,
    serverTimestamp,
    Timestamp,
    where,
    getDocs,
    deleteDoc
} from 'firebase/firestore';
import { signInAnonymously } from 'firebase/auth';
import './styles.css';
import { formatTimestamp } from './services/employeeService';

const DESIGN_WIDTH = 2400; // The fixed width of the design

const App: React.FC = () => {
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeModal, setActiveModal] = useState<ModalType>(ModalType.None);
    const [notifications, setNotifications] = useState<NotificationData[]>([]);
    const [togglingSpecialTeamId, setTogglingSpecialTeamId] = useState<string | null>(null);
    const [isAdmin, setIsAdmin] = useState(false);
    
    // State for manual registration inputs
    const [mainSubject, setMainSubject] = useState('');
    const [mainMatricula, setMainMatricula] = useState('');
    const [specialSubject, setSpecialSubject] = useState('');
    const [specialMatricula, setSpecialMatricula] = useState('');

    const [isDarkMode, setIsDarkMode] = useState(() => {
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme) return savedTheme === 'dark';
        return window.matchMedia('(prefers-color-scheme: dark)').matches;
    });

    // Scaling state and refs
    const [scale, setScale] = useState(1);
    const scalableContainerRef = useRef<HTMLDivElement>(null);
    const heightSizerRef = useRef<HTMLDivElement>(null);

    const updateLayout = useCallback(() => {
        const newScale = window.innerWidth / DESIGN_WIDTH;
        setScale(newScale);

        // Update the height of the sizer element to ensure correct scrolling behavior
        // Use a timeout to wait for the DOM to render and calculate correct scrollHeight
        setTimeout(() => {
            if (scalableContainerRef.current && heightSizerRef.current) {
                const containerHeight = scalableContainerRef.current.scrollHeight;
                heightSizerRef.current.style.height = `${containerHeight * newScale}px`;
            }
        }, 100);
        
    }, []);

    useEffect(() => {
        updateLayout();
        window.addEventListener('resize', updateLayout);
        return () => window.removeEventListener('resize', updateLayout);
    }, [updateLayout]);
    
    // Re-calculate layout when employees list changes, as this affects content height
    useEffect(() => {
        updateLayout();
    }, [employees, updateLayout]);
    
    useEffect(() => {
        if (isDarkMode) {
            document.documentElement.classList.add('dark');
            localStorage.setItem('theme', 'dark');
        } else {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('theme', 'light');
        }
    }, [isDarkMode]);

    const handleToggleDarkMode = () => setIsDarkMode(prev => !prev);

    const showNotification = useCallback((message: string, type: 'success' | 'error' = 'success') => {
        const newNotification = { id: Date.now(), message, type };
        setNotifications(prev => [...prev, newNotification]);
    }, []);

    const dismissNotification = (id: number) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
    };

    useEffect(() => {
        let unsubscribeEmployees = () => {};
        let unsubscribeRegistrations = () => {};

        const signInAndSetupListeners = async () => {
             if (!isConfigured) {
                showNotification("Modo de pré-visualização: Faça o deploy no Vercel para carregar dados ao vivo.", "error");
                setLoading(false);
                return;
            }
            try {
                if (!auth || !db) throw new Error("Firebase not initialized correctly.");
                
                await signInAnonymously(auth);
                console.log("Signed in anonymously");

                // Listener for employees
                const employeesQuery = query(collection(db, 'employees'), orderBy("name", "asc"));
                unsubscribeEmployees = onSnapshot(employeesQuery, (querySnapshot) => {
                    const employeesData: Employee[] = querySnapshot.docs.map(doc => {
                        const data = doc.data();
                        return {
                            id: doc.id,
                            name: data.name,
                            matricula: data.matricula,
                            assDss: data.assDss,
                            bem: data.bem,
                            mal: data.mal,
                            absent: data.absent,
                            time: data.time ? formatTimestamp(data.time as Timestamp) : null,
                            inSpecialTeam: data.inSpecialTeam,
                        };
                    });
                    setEmployees(employeesData);
                    if (loading) setLoading(false);
                }, (error) => {
                    console.error("Error listening to employee updates:", error);
                    showNotification(`Erro ao carregar funcionários: ${error.message}`, "error");
                    setLoading(false);
                });
                
                // Listener for manual registrations to persist fields
                const registrationsQuery = query(collection(db, 'registrosDSS'));
                unsubscribeRegistrations = onSnapshot(registrationsQuery, (querySnapshot) => {
                    const registrations = querySnapshot.docs.map(d => ({ id: d.id, ...d.data() })) as ManualRegistration[];
                    
                    const mainReg = registrations.find(r => r.TURNO === '7H-19H');
                    const specialReg = registrations.find(r => r.TURNO === '6H');

                    setMainSubject(mainReg?.assunto || '');
                    setMainMatricula(mainReg?.matricula || '');
                    
                    setSpecialSubject(specialReg?.assunto || '');
                    setSpecialMatricula(specialReg?.matricula || '');
                });


                showNotification('Dados carregados com sucesso!', 'success');

            } catch (error) {
                console.error("Authentication or listener setup failed:", error);
                const message = error instanceof Error ? error.message : 'Verifique as credenciais e as regras de segurança do Firebase.';
                showNotification(`Falha na conexão: ${message}`, "error");
                setLoading(false);
            }
        };

        signInAndSetupListeners();

        return () => {
            unsubscribeEmployees();
            unsubscribeRegistrations();
        };
    }, [showNotification, loading]);

    const handleStatusChange = async (id: string, type: StatusType) => {
        if (!db) {
            showNotification("A conexão com o banco de dados não está disponível.", "error");
            return;
        }
        const employee = employees.find(e => e.id === id);
        if (!employee) return;

        const isChecking = !(employee as any)[type];

        // Admin check: only admins can uncheck a status.
        if (!isChecking && !isAdmin) {
            showNotification('Apenas administradores podem desmarcar esta opção.', 'error');
            return;
        }

        const updatedData: { [key: string]: any } = {};

        if (type === 'absent') {
            updatedData.absent = isChecking;
            if (isChecking) { // If marking as absent
                updatedData.assDss = false;
                updatedData.bem = false;
                updatedData.mal = false;
            }
        } else { // For assDss, bem, mal
            if (isChecking) {
                updatedData.absent = false; // If checking any of these, employee is not absent
            }

            if (type === 'assDss') {
                updatedData.assDss = isChecking;
            } else if (type === 'bem') {
                updatedData.bem = isChecking;
                if (isChecking) {
                    updatedData.assDss = true; // Checking 'bem' implies DSS is done
                    updatedData.mal = false;
                }
            } else if (type === 'mal') {
                updatedData.mal = isChecking;
                if (isChecking) {
                    updatedData.bem = false;
                }
            }
        }
        
        // Determine the final state after the update to decide on the timestamp
        const finalStates = {
            absent: updatedData.absent !== undefined ? updatedData.absent : employee.absent,
            assDss: updatedData.assDss !== undefined ? updatedData.assDss : employee.assDss,
            bem: updatedData.bem !== undefined ? updatedData.bem : employee.bem,
            mal: updatedData.mal !== undefined ? updatedData.mal : employee.mal,
        };

        if (finalStates.absent) {
            updatedData.time = null;
        } else if (finalStates.bem || finalStates.mal || finalStates.assDss) {
            updatedData.time = serverTimestamp();
        } else {
            updatedData.time = null;
        }
        
        try {
            const docRef = doc(db, 'employees', id);
            await updateDoc(docRef, updatedData);
        } catch (error) {
            console.error("Error updating status:", error);
            const message = error instanceof Error ? error.message : 'Ocorreu um erro desconhecido.';
            showNotification(`Falha ao atualizar status: ${message}`, 'error');
        }
    };
    
    const handleToggleSpecialTeam = async (id: string) => {
        if (!db) {
            showNotification("A conexão com o banco de dados não está disponível.", "error");
            return;
        }
        setTogglingSpecialTeamId(id);
        const employee = employees.find(e => e.id === id);
        if (!employee) {
            setTogglingSpecialTeamId(null);
            return;
        }

        try {
            const docRef = doc(db, 'employees', id);
            await updateDoc(docRef, { inSpecialTeam: !employee.inSpecialTeam });
            showNotification(`${employee.name} ${!employee.inSpecialTeam ? 'adicionado à' : 'removido da'} turma.`, 'success');
        } catch (error) {
            console.error("Failed to toggle special team status:", error);
            const message = error instanceof Error ? error.message : 'Ocorreu um erro desconhecido.';
            showNotification(`Falha ao atualizar status: ${message}`, 'error');
        } finally {
            setTogglingSpecialTeamId(null);
        }
    };

    const handleManualRegister = async (turno: '7H-19H' | '6H') => {
        if (!db) {
            showNotification("A conexão com o banco de dados não está disponível.", "error");
            return;
        }

        const matricula = turno === '7H-19H' ? mainMatricula : specialMatricula;
        const subject = turno === '7H-19H' ? mainSubject : specialSubject;

        if (!matricula) {
            showNotification('Por favor, insira uma matrícula.', 'error');
            return;
        }
        
        const registrationData = {
            matricula,
            assunto: subject || 'Não informado',
            TURNO: turno,
        };

        try {
            // Upsert logic: Check if a registration for this turn already exists
            const q = query(collection(db, 'registrosDSS'), where("TURNO", "==", turno));
            const querySnapshot = await getDocs(q);

            if (!querySnapshot.empty) {
                // Update the existing document
                const docRef = doc(db, 'registrosDSS', querySnapshot.docs[0].id);
                await updateDoc(docRef, registrationData);
            } else {
                // Add a new document
                await addDoc(collection(db, 'registrosDSS'), registrationData);
            }
            showNotification(`Registro para turno ${turno} salvo com sucesso.`, 'success');
        } catch (error) {
            console.error("Error saving manual registration:", error);
            const message = error instanceof Error ? error.message : 'Ocorreu um erro desconhecido.';
            showNotification(`Falha ao salvar registro: ${message}`, 'error');
        }
    };
    
    const handleAdminLogin = async (email: string) => {
        if (!db) {
            showNotification("A conexão com o banco de dados não está disponível.", "error");
            return;
        }
        if (!email) {
            showNotification('Por favor, insira um e-mail.', 'error');
            return;
        }
        try {
            const q = query(collection(db, 'administrators'), where("email", "==", email.toLowerCase()));
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) {
                setIsAdmin(true);
                setActiveModal(ModalType.AdminOptions);
                showNotification('Login de administrador bem-sucedido!', 'success');
            } else {
                showNotification('Credenciais de administrador inválidas.', 'error');
            }
        } catch (error) {
            console.error("Admin login error:", error);
            const message = error instanceof Error ? error.message : 'Ocorreu um erro desconhecido.';
            showNotification(`Erro no login: ${message}`, 'error');
        }
    };
    
    const handleAddUser = async (name: string, matricula: string) => {
        if (!db) {
            showNotification("A conexão com o banco de dados não está disponível.", "error");
            return;
        }
        if (!isAdmin) {
            showNotification('Apenas administradores podem adicionar usuários.', 'error');
            return;
        }
        try {
            if (matricula) {
                const existingUser = employees.find(e => e.matricula === matricula);
                if(existingUser) {
                    throw new Error('Matrícula já existe.');
                }
            }
            await addDoc(collection(db, 'employees'), {
                name,
                matricula,
                assDss: false,
                bem: false,
                mal: false,
                absent: false,
                time: null,
                inSpecialTeam: false
            });
            setActiveModal(ModalType.None);
            showNotification(`Usuário ${name} adicionado com sucesso!`, 'success');
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Ocorreu um erro.';
            showNotification(errorMessage, 'error');
        }
    };

    const handleDeleteUser = async (employeeId: string) => {
        if (!db) {
            showNotification("A conexão com o banco de dados não está disponível.", "error");
            return;
        }
        if (!isAdmin) {
            showNotification('Apenas administradores podem deletar usuários.', 'error');
            return;
        }
        const employeeToDelete = employees.find(e => e.id === employeeId);
        if (!employeeToDelete) {
             showNotification('Usuário não encontrado.', 'error');
            return;
        }

        if (window.confirm(`Tem certeza que deseja deletar permanentemente ${employeeToDelete.name}? Esta ação não pode ser desfeita.`)) {
            try {
                const docRef = doc(db, 'employees', employeeId);
                await deleteDoc(docRef);
                showNotification(`Usuário ${employeeToDelete.name} deletado com sucesso!`, 'success');
            } catch (error) {
                console.error("Error deleting user:", error);
                const message = error instanceof Error ? error.message : 'Ocorreu um erro desconhecido.';
                showNotification(`Falha ao deletar: ${message}`, 'error');
            }
        }
    };

    const handleClearData = async () => {
        if (!db) {
            showNotification("A conexão com o banco de dados não está disponível.", "error");
            return;
        }
        if (!isAdmin) {
            showNotification('Apenas administradores podem limpar os dados.', 'error');
            return;
        }
        try {
            const batch = writeBatch(db);
            const employeesSnapshot = await getDocs(collection(db, 'employees'));
            employeesSnapshot.forEach((doc) => {
                batch.update(doc.ref, {
                    assDss: false,
                    bem: false,
                    mal: false,
                    absent: false,
                    time: null,
                });
            });
            await batch.commit();
            setActiveModal(ModalType.None);
            showNotification('Dados de status diário foram limpos!', 'success');
        } catch(error) {
            console.error("Error clearing data:", error);
            const message = error instanceof Error ? error.message : 'Ocorreu um erro desconhecido.';
            showNotification(`Falha ao limpar dados: ${message}`, 'error');
        }
    };

    const handleReorganize = () => {
        setEmployees(prev => [...prev].sort((a,b) => a.name.localeCompare(b.name)));
        setActiveModal(ModalType.None);
        showNotification('Painel reorganizado alfabeticamente!', 'success');
    };
    
    const stats = useMemo(() => ({
        bem: employees.filter(e => e.bem).length,
        mal: employees.filter(e => e.mal).length,
        absent: employees.filter(e => e.absent).length,
        total: employees.length,
    }), [employees]);
    
    const mainTeam = useMemo(() => employees.filter(e => !e.inSpecialTeam), [employees]);
    const specialTeam = useMemo(() => employees.filter(e => e.inSpecialTeam), [employees]);

    const columnSize = Math.ceil(mainTeam.length / 2);
    const leftColumn = mainTeam.slice(0, columnSize);
    const rightColumn = mainTeam.slice(columnSize);

    return (
        <>
            <div className="viewport">
                <div ref={heightSizerRef}>
                    <div
                        ref={scalableContainerRef}
                        className="scalable-container"
                        style={{ transform: `scale(${scale})` }}
                    >
                        <div className="bg-light-bg-secondary dark:bg-dark-bg text-light-text dark:text-dark-text transition-colors">
                             <main className="p-8">
                                <Header
                                    stats={stats}
                                    loading={loading}
                                    onAdminClick={() => setActiveModal(ModalType.AdminLogin)}
                                    isDarkMode={isDarkMode}
                                    onToggleDarkMode={handleToggleDarkMode}
                                />
                                
                                <div className="flex gap-8">
                                   <div className="w-[1536px] flex flex-col gap-8">
                                        <ManualRegisterSection 
                                            subject={mainSubject}
                                            matricula={mainMatricula}
                                            onSubjectChange={setMainSubject}
                                            onMatriculaChange={setMainMatricula}
                                            onRegister={() => handleManualRegister('7H-19H')} 
                                        />
                                        <div className="grid grid-cols-2 gap-8">
                                            <div className="flex flex-col gap-6">
                                                {leftColumn.map(emp => <EmployeeCard key={emp.id} employee={emp} onStatusChange={handleStatusChange} onToggleSpecialTeam={handleToggleSpecialTeam} isTogglingSpecialTeam={togglingSpecialTeamId === emp.id} isAdmin={isAdmin} onDelete={handleDeleteUser} />)}
                                            </div>
                                            <div className="flex flex-col gap-6">
                                                {rightColumn.map(emp => <EmployeeCard key={emp.id} employee={emp} onStatusChange={handleStatusChange} onToggleSpecialTeam={handleToggleSpecialTeam} isTogglingSpecialTeam={togglingSpecialTeamId === emp.id} isAdmin={isAdmin} onDelete={handleDeleteUser} />)}
                                            </div>
                                        </div>
                                   </div>
                                   <div className="w-[800px]">
                                    <SpecialTeamPanel 
                                        specialTeam={specialTeam} 
                                        onStatusChange={handleStatusChange}
                                        onToggleSpecialTeam={handleToggleSpecialTeam}
                                        togglingSpecialTeamId={togglingSpecialTeamId}
                                        isAdmin={isAdmin}
                                        onDeleteUser={handleDeleteUser}
                                        subject={specialSubject}
                                        matricula={specialMatricula}
                                        onSubjectChange={setSpecialSubject}
                                        onMatriculaChange={setSpecialMatricula}
                                        onRegister={() => handleManualRegister('6H')}
                                    />
                                   </div>
                                </div>
                            </main>
                            <Footer />
                        </div>
                    </div>
                </div>
            </div>
            
            {/* Modals, Notifications, and Zoom are kept outside the scaled container to maintain readability and correct positioning */}
            <AdminLoginModal isOpen={activeModal === ModalType.AdminLogin} onClose={() => setActiveModal(ModalType.None)} onLogin={handleAdminLogin} />
            <AdminOptionsModal 
                isOpen={activeModal === ModalType.AdminOptions} 
                onClose={() => setActiveModal(ModalType.None)} 
                onClear={handleClearData} 
                onReorganize={handleReorganize} 
                onAddUser={() => setActiveModal(ModalType.AddUser)}
                onSendReport={() => setActiveModal(ModalType.Report)}
            />
            <AddUserModal isOpen={activeModal === ModalType.AddUser} onClose={() => setActiveModal(ModalType.None)} onAdd={handleAddUser} />
            <ReportModal 
                isOpen={activeModal === ModalType.Report}
                onClose={() => setActiveModal(ModalType.None)}
                employees={employees}
                showNotification={showNotification}
            />
            <div className="fixed top-5 right-5 left-5 sm:left-auto z-[100] space-y-3 flex flex-col items-center sm:items-end">
                {notifications.map(n => <Notification key={n.id} notification={n} onDismiss={dismissNotification} />)}
            </div>
        </>
    );
};

interface ManualRegisterSectionProps {
    subject: string;
    matricula: string;
    onSubjectChange: (value: string) => void;
    onMatriculaChange: (value: string) => void;
    onRegister: () => void;
}

const ManualRegisterSection: React.FC<ManualRegisterSectionProps> = ({
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
        <div className="bg-light-card dark:bg-dark-card rounded-3xl p-8 shadow-lg flex items-center gap-6">
            <div className="relative flex-1">
                <SubjectIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input 
                    type="text" 
                    value={subject} 
                    onChange={(e) => onSubjectChange(e.target.value)} 
                    placeholder="Assunto do DSS (7H-19H)" 
                    className="w-full pl-12 pr-4 py-4 bg-light-bg dark:bg-dark-bg border-2 border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none transition"
                />
            </div>
            <div className="relative flex-1">
                <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input 
                    type="text" 
                    value={matricula} 
                    onChange={handleMatriculaChange} 
                    placeholder="Sua Matrícula" 
                    className="w-full pl-12 pr-4 py-4 bg-light-bg dark:bg-dark-bg border-2 border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none transition"
                    inputMode="numeric"
                    pattern="[0-9]*"
                />
            </div>
            <button onClick={onRegister} className="w-auto px-9 py-4 font-bold text-white bg-gradient-to-r from-primary to-primary-dark rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300">
                REGISTRAR
            </button>
        </div>
    );
};

const AdminLoginModal: React.FC<{isOpen: boolean, onClose: () => void, onLogin: (email: string) => void}> = ({isOpen, onClose, onLogin}) => {
    const [email, setEmail] = useState('');

    const handleSubmit = () => {
        onLogin(email);
        setEmail('');
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Acesso Administrativo">
            <div className="space-y-4">
                <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                    Insira o e-mail de administrador para continuar.
                </p>
                <div className="relative">
                     <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input 
                        type="email" 
                        value={email} 
                        onChange={e => setEmail(e.target.value)} 
                        placeholder="E-MAIL DO ADMINISTRADOR" 
                        className="w-full pl-12 pr-4 py-3 bg-light-bg dark:bg-dark-bg-secondary border-2 border-gray-200 dark:border-gray-600 rounded-lg focus:ring-primary outline-none"
                    />
                </div>
                <button onClick={handleSubmit} className="w-full py-4 font-bold text-white bg-primary rounded-lg hover:bg-primary-dark transition">ENTRAR</button>
            </div>
        </Modal>
    );
};

const AdminOptionsModal: React.FC<{
    isOpen: boolean, 
    onClose: () => void, 
    onClear: () => void, 
    onReorganize: () => void, 
    onAddUser: () => void, 
    onSendReport: () => void
}> = ({isOpen, onClose, onClear, onReorganize, onAddUser, onSendReport}) => (
    <Modal isOpen={isOpen} onClose={onClose} title="Opções Administrativas">
        <div className="space-y-4">
            <button onClick={onClear} className="w-full py-4 font-bold text-white bg-orange rounded-lg hover:bg-orange-600 transition">LIMPAR STATUS DIÁRIO</button>
            <button onClick={onSendReport} className="w-full py-4 font-bold text-white bg-blue-500 rounded-lg hover:bg-blue-600 transition">GERAR RELATÓRIO</button>
            <button onClick={onReorganize} className="w-full py-4 font-bold text-white bg-danger rounded-lg hover:bg-red-600 transition">REORGANIZAR PAINEL</button>
            <button onClick={onAddUser} className="w-full py-4 font-bold text-white bg-success rounded-lg hover:bg-green-600 transition">NOVO USUÁRIO</button>
        </div>
    </Modal>
);

const AddUserModal: React.FC<{isOpen: boolean, onClose: () => void, onAdd: (name: string, matricula: string) => void}> = ({isOpen, onClose, onAdd}) => {
    const [name, setName] = useState('');
    const [matricula, setMatricula] = useState('');
    
    const handleSubmit = () => {
        if (name) {
            onAdd(name, matricula);
            setName('');
            setMatricula('');
        }
    };

    const handleMatriculaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setMatricula(e.target.value.replace(/[^0-9]/g, ''));
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Adicionar Novo Usuário">
            <div className="space-y-4">
                <div className="relative">
                    <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input type="text" value={name} onChange={e => setName(e.target.value.toUpperCase())} placeholder="NOME DO FUNCIONÁRIO" className="w-full pl-12 pr-4 py-3 bg-light-bg dark:bg-dark-bg-secondary border-2 border-gray-200 dark:border-gray-600 rounded-lg focus:ring-primary outline-none"/>
                </div>
                <div className="relative">
                    <SubjectIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input 
                        type="text" 
                        value={matricula} 
                        onChange={handleMatriculaChange} 
                        placeholder="MATRÍCULA" 
                        className="w-full pl-12 pr-4 py-3 bg-light-bg dark:bg-dark-bg-secondary border-2 border-gray-200 dark:border-gray-600 rounded-lg focus:ring-primary outline-none"
                        inputMode="numeric"
                        pattern="[0-9]*"
                    />
                </div>
                <button onClick={handleSubmit} className="w-full py-4 font-bold text-white bg-success rounded-lg hover:bg-green-600 transition">ADICIONAR</button>
            </div>
        </Modal>
    );
};

const ReportModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    employees: Employee[];
    showNotification: (message: string, type?: 'success' | 'error') => void;
}> = ({ isOpen, onClose, employees, showNotification }) => {
    const [manualRegistrations, setManualRegistrations] = useState<ManualRegistration[]>([]);
    
    useEffect(() => {
        if (isOpen && db) {
            const fetchRegistrations = async () => {
                try {
                    const registrationsQuery = query(collection(db, 'registrosDSS'));
                    const querySnapshot = await getDocs(registrationsQuery);
                    const registrationsData: ManualRegistration[] = querySnapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data()
                    } as ManualRegistration));
                    setManualRegistrations(registrationsData);
                } catch (error) {
                    console.error("Error fetching manual registrations for report:", error);
                    showNotification('Erro ao carregar registros manuais para o relatório.', 'error');
                }
            };
            fetchRegistrations();
        }
    }, [isOpen, showNotification]);

    const reportText = useMemo(() => {
        if (!employees.length && !manualRegistrations.length) return "Nenhum dado para exibir.";

        const today = new Date().toLocaleDateString('pt-BR', { dateStyle: 'full' });
        const total = employees.length;
        const absentCount = employees.filter(e => e.absent).length;
        const present = total - absentCount;

        const getNames = (filter: (e: Employee) => boolean) => 
            employees.filter(filter).map(e => `- ${e.name}`).join('\n') || 'Nenhum';

        const bemNames = getNames(e => e.bem);
        const malNames = getNames(e => e.mal);
        const absentNames = getNames(e => e.absent);
        const specialTeamNames = getNames(e => e.inSpecialTeam);

        const employeeReport = `RELATÓRIO DE STATUS - ${today}
==================================================

RESUMO GERAL
--------------------------------------------------
- Total de Funcionários: ${total}
- Presentes: ${present}
- Ausentes: ${absentCount}

STATUS "ESTOU BEM"
--------------------------------------------------
${bemNames}

STATUS "ESTOU MAL"
--------------------------------------------------
${malNames}

AUSENTES
--------------------------------------------------
${absentNames}

EQUIPE TURNO 6H
--------------------------------------------------
${specialTeamNames}`;

        let manualRegistrationsText = 'Nenhum registro manual adicionado.';
        if (manualRegistrations.length > 0) {
            manualRegistrationsText = manualRegistrations
              .map(reg => {
                const employee = employees.find(e => e.matricula === reg.matricula);
                const employeeName = employee ? employee.name : 'Matrícula não encontrada';
                return `- Matrícula: ${reg.matricula} (${employeeName}) | Assunto: ${reg.assunto} | Turno: ${reg.TURNO}`
              }).join('\n');
        }

        return `${employeeReport}\n\n==================================================\n\nREGISTROS MANUAIS\n--------------------------------------------------\n${manualRegistrationsText}`;
    }, [employees, manualRegistrations]);

    const handleCopyReport = () => {
        navigator.clipboard.writeText(reportText).then(() => {
            showNotification('Relatório copiado para a área de transferência!', 'success');
        }).catch(err => {
            console.error('Failed to copy report: ', err);
            showNotification('Falha ao copiar o relatório.', 'error');
        });
    };

    const handleDownloadReport = () => {
        try {
            const today = new Date().toISOString().slice(0, 10);
            const filename = `relatorio-dss-${today}.txt`;
            const blob = new Blob([reportText], { type: 'text/plain;charset=utf-8' });
            
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = filename;
            
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            URL.revokeObjectURL(link.href);
            showNotification('Download do relatório iniciado!', 'success');
        } catch (err) {
            console.error('Failed to download report: ', err);
            showNotification('Falha ao baixar o relatório.', 'error');
        }
    };

    const handleEmailReport = () => {
        const today = new Date().toLocaleDateString('pt-BR');
        const subject = `Relatório de Status DSS - ${today}`;
        const mailtoLink = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(reportText)}`;
        
        // Mailto links have character limits that vary by client/browser (often around 2000).
        if (mailtoLink.length > 2000) {
            navigator.clipboard.writeText(reportText).then(() => {
                showNotification('Relatório muito longo para e-mail! Copiado para a área de transferência.', 'success');
            }).catch(err => {
                console.error('Failed to copy report: ', err);
                showNotification('Relatório muito longo e falha ao copiar para a área de transferência.', 'error');
            });
        } else {
            window.location.href = mailtoLink;
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Relatório de Status">
            <div className="text-left bg-light-bg dark:bg-dark-bg-secondary p-4 rounded-lg max-h-96 overflow-y-auto">
                <pre className="whitespace-pre-wrap text-sm font-mono text-light-text dark:text-dark-text">{reportText}</pre>
            </div>
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
                <button onClick={handleCopyReport} className="w-full py-4 font-bold text-white bg-primary rounded-lg hover:bg-primary-dark transition">
                    COPIAR
                </button>
                <button onClick={handleDownloadReport} className="w-full py-4 font-bold text-white bg-success rounded-lg hover:bg-green-600 transition">
                    BAIXAR
                </button>
                <button onClick={handleEmailReport} className="w-full py-4 font-bold text-white bg-blue-500 rounded-lg hover:bg-blue-600 transition">
                    E-MAIL
                </button>
            </div>
        </Modal>
    );
};

export default App;