
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Header from './components/Header';
import EmployeeCard from './components/EmployeeCard';
import SpecialTeamPanel from './components/SpecialTeamPanel';
import Modal from './components/Modal';
import Notification from './components/Notification';
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
import Footer from './components/Footer';
import { formatTimestamp } from './services/employeeService';

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
        <div className="bg-light-bg-secondary dark:bg-dark-bg min-h-screen text-light-text dark:text-dark-text transition-colors">
            <main className="w-[1920px] mx-auto p-8">
                <Header
                    stats={stats}
                    loading={loading}
                    onAdminClick={() => setActiveModal(ModalType.AdminLogin)}
                    isDarkMode={isDarkMode}
                    onToggleDarkMode={handleToggleDarkMode}
                />

                <div className="flex flex-row gap-8">
                    <div className="flex-1 grid grid-cols-2 gap-6">
                        <div className="flex flex-col gap-6">
                            {leftColumn.map(employee => (
                                <EmployeeCard 
                                    key={employee.id} 
                                    employee={employee}
                                    onStatusChange={handleStatusChange}
                                    onToggleSpecialTeam={handleToggleSpecialTeam}
                                    isTogglingSpecialTeam={togglingSpecialTeamId === employee.id}
                                    isAdmin={isAdmin}
                                    onDelete={handleDeleteUser}
                                />
                            ))}
                        </div>
                        <div className="flex flex-col gap-6">
                            {rightColumn.map(employee => (
                                <EmployeeCard 
                                    key={employee.id} 
                                    employee={employee}
                                    onStatusChange={handleStatusChange}
                                    onToggleSpecialTeam={handleToggleSpecialTeam}
                                    isTogglingSpecialTeam={togglingSpecialTeamId === employee.id}
                                    isAdmin={isAdmin}
                                    onDelete={handleDeleteUser}
                                />
                            ))}
                        </div>
                    </div>
                    <div className="w-[450px] flex-shrink-0">
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

                <Modal 
                    isOpen={activeModal === ModalType.AdminLogin}
                    onClose={() => setActiveModal(ModalType.None)}
                    title="Acesso Administrativo"
                >
                    <form onSubmit={(e) => {
                        e.preventDefault();
                        const email = (e.target as any).elements.email.value;
                        handleAdminLogin(email);
                    }}>
                        <input name="email" type="email" placeholder="Digite seu e-mail" className="w-full mb-4 p-3 bg-light-bg dark:bg-dark-bg border-2 border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none transition" />
                        <button type="submit" className="w-full py-3 text-center font-bold text-white bg-gradient-to-r from-primary to-primary-dark rounded-xl shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300">
                            ENTRAR
                        </button>
                    </form>
                </Modal>
                
                <Modal
                    isOpen={activeModal === ModalType.AdminOptions}
                    onClose={() => setActiveModal(ModalType.None)}
                    title="Opções do Administrador"
                >
                    <div className="flex flex-col gap-4">
                        <button onClick={() => setActiveModal(ModalType.AddUser)} className="w-full py-3 text-center font-bold text-white bg-gradient-to-r from-success to-green-600 rounded-xl shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300">ADICIONAR USUÁRIO</button>
                        <button onClick={() => { if(window.confirm('Tem certeza que deseja limpar os dados de status diário?')) handleClearData() }} className="w-full py-3 text-center font-bold text-white bg-gradient-to-r from-danger to-red-600 rounded-xl shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300">LIMPAR DADOS DIÁRIOS</button>
                        <button onClick={handleReorganize} className="w-full py-3 text-center font-bold text-white bg-gradient-to-r from-orange to-amber-500 rounded-xl shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300">REORGANIZAR PAINEL</button>
                        <button onClick={() => setIsAdmin(false)} className="w-full py-3 mt-4 text-center font-bold text-light-text-secondary dark:text-dark-text-secondary bg-light-bg dark:bg-dark-bg rounded-xl shadow-inner transition-colors">SAIR DO MODO ADM</button>
                    </div>
                </Modal>

                <Modal
                    isOpen={activeModal === ModalType.AddUser}
                    onClose={() => setActiveModal(ModalType.AdminOptions)}
                    title="Adicionar Novo Usuário"
                >
                    <form onSubmit={(e) => {
                         e.preventDefault();
                         const name = (e.target as any).elements.name.value;
                         const matricula = (e.target as any).elements.matricula.value;
                         handleAddUser(name, matricula);
                    }}>
                        <div className="relative mb-4">
                            <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                            <input name="name" type="text" placeholder="Nome Completo" required className="w-full pl-12 pr-4 py-3 bg-light-bg dark:bg-dark-bg border-2 border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none transition" />
                        </div>
                        <div className="relative mb-4">
                            <SubjectIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                            <input name="matricula" type="text" inputMode="numeric" pattern="[0-9]*" placeholder="Matrícula" required className="w-full pl-12 pr-4 py-3 bg-light-bg dark:bg-dark-bg border-2 border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none transition" />
                        </div>
                        <button type="submit" className="w-full py-3 text-center font-bold text-white bg-gradient-to-r from-primary to-primary-dark rounded-xl shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300">
                            CADASTRAR
                        </button>
                    </form>
                </Modal>

                <Footer />
            </main>
             <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3">
                {notifications.map(n => (
                    <Notification key={n.id} notification={n} onDismiss={dismissNotification} />
                ))}
            </div>
        </div>
    );
};

export default App;