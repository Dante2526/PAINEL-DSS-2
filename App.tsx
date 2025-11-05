
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Header from './components/Header';
import EmployeeCard from './components/EmployeeCard';
import SpecialTeamPanel from './components/SpecialTeamPanel';
import Modal from './components/Modal';
import Notification from './components/Notification';
import Footer from './components/Footer';
import { SubjectIcon, UserIcon, TrashIcon } from './components/icons';
import { Employee, StatusType, ModalType } from './types';
import type { NotificationData } from './components/Notification';
import { db, auth } from './services/firebase';
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

interface ManualRegistration {
  matricula: string;
  subject: string;
  origin: 'main' | 'special';
  timestamp: Date;
}

const App: React.FC = () => {
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeModal, setActiveModal] = useState<ModalType>(ModalType.None);
    const [notifications, setNotifications] = useState<NotificationData[]>([]);
    const [togglingSpecialTeamId, setTogglingSpecialTeamId] = useState<string | null>(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [manualRegistrations, setManualRegistrations] = useState<ManualRegistration[]>([]);
    const viewportRef = useRef<HTMLDivElement>(null);
    const scalableContainerRef = useRef<HTMLDivElement>(null);
    const scaleStateRef = useRef({ currentScale: 1, minScale: 0.1 });
    
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
        let unsubscribe = () => {};

        const signInAndSetupListener = async () => {
            try {
                await signInAnonymously(auth);
                console.log("Signed in anonymously");

                const q = query(collection(db, 'employees'), orderBy("name", "asc"));
                unsubscribe = onSnapshot(q, (querySnapshot) => {
                    const employeesData: Employee[] = [];
                    querySnapshot.forEach((doc) => {
                        const data = doc.data();
                        employeesData.push({
                            id: doc.id,
                            name: data.name,
                            matricula: data.matricula,
                            assDss: data.assDss,
                            bem: data.bem,
                            mal: data.mal,
                            absent: data.absent,
                            time: data.time ? formatTimestamp(data.time as Timestamp) : null,
                            inSpecialTeam: data.inSpecialTeam,
                        });
                    });
                    setEmployees(employeesData);
                    
                    if (loading) {
                        setLoading(false);
                        showNotification('Dados carregados com sucesso!', 'success');
                    }
                }, (error) => {
                    console.error("Error listening to employee updates:", error);
                    showNotification("Não foi possível conectar ao banco de dados. Verifique sua conexão e as regras de segurança.", "error");
                    setLoading(false);
                });

            } catch (error) {
                console.error("Anonymous sign-in failed:", error);
                showNotification("Falha na autenticação com o servidor.", "error");
                setLoading(false);
            }
        };

        signInAndSetupListener();

        return () => {
            unsubscribe();
        };
    }, [showNotification, loading]);

    const setScale = useCallback((newScale: number, scrollX?: number, scrollY?: number) => {
        const viewport = viewportRef.current;
        const scalableContainer = scalableContainerRef.current;
        if (!viewport || !scalableContainer) return;

        scaleStateRef.current.currentScale = Math.max(scaleStateRef.current.minScale, Math.min(newScale, 2.0));
        scalableContainer.style.transform = `scale(${scaleStateRef.current.currentScale})`;
        if (scrollX !== undefined) viewport.scrollLeft = scrollX;
        if (scrollY !== undefined) viewport.scrollTop = scrollY;
    }, []);

    const initializeScale = useCallback(() => {
        const viewport = viewportRef.current;
        const scalableContainer = scalableContainerRef.current;
        if (!viewport || !scalableContainer) return;

        const fitScale = viewport.clientWidth / scalableContainer.offsetWidth;
        scaleStateRef.current.minScale = fitScale;
        if (window.innerWidth < 768) {
            setScale(fitScale, 0, 0);
        } else {
            setScale(1.0, 0, 0);
        }
    }, [setScale]);


    useEffect(() => {
        const viewport = viewportRef.current;
        const scalableContainer = scalableContainerRef.current;

        if (!viewport || !scalableContainer) return;

        let initialDistance = 0;
        let initialScale = 1;
        let scrollStart = { x: 0, y: 0 };
        let touchCenter = { x: 0, y: 0 };
        
        const handleTouchStart = (e: TouchEvent) => {
            if (e.touches.length === 2) {
                e.preventDefault();
                initialDistance = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
                initialScale = scaleStateRef.current.currentScale;
                scrollStart = { x: viewport.scrollLeft, y: viewport.scrollTop };
                touchCenter = {
                    x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
                    y: (e.touches[0].clientY + e.touches[1].clientY) / 2
                };
            }
        };

        const handleTouchMove = (e: TouchEvent) => {
            if (e.touches.length === 2) {
                e.preventDefault();
                const currentDistance = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
                const scaleRatio = currentDistance / initialDistance;
                const newScale = initialScale * scaleRatio;
                
                const originX = touchCenter.x - viewport.getBoundingClientRect().left;
                const originY = touchCenter.y - viewport.getBoundingClientRect().top;

                const contentOriginX = (scrollStart.x + originX) / initialScale;
                const contentOriginY = (scrollStart.y + originY) / initialScale;

                const newScrollX = (contentOriginX * newScale) - originX;
                const newScrollY = (contentOriginY * newScale) - originY;
                
                setScale(newScale, newScrollX, newScrollY);
            }
        };

        const handleWheel = (e: WheelEvent) => {
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                const zoomIntensity = 0.002;
                const delta = -e.deltaY * zoomIntensity;
                const newScale = scaleStateRef.current.currentScale + delta * scaleStateRef.current.currentScale;

                const originX = e.clientX - viewport.getBoundingClientRect().left;
                const originY = e.clientY - viewport.getBoundingClientRect().top;

                const contentOriginX = (viewport.scrollLeft + originX) / scaleStateRef.current.currentScale;
                const contentOriginY = (viewport.scrollTop + originY) / scaleStateRef.current.currentScale;

                const newScrollX = (contentOriginX * newScale) - originX;
                const newScrollY = (contentOriginY * newScale) - originY;

                setScale(newScale, newScrollX, newScrollY);
            }
        };

        let lastWidth = window.innerWidth;
        const handleResize = () => {
            const currentViewport = viewportRef.current;
            const currentScalableContainer = scalableContainerRef.current;
            if (!currentViewport || !currentScalableContainer) return;
            
            if (window.innerWidth !== lastWidth) {
                lastWidth = window.innerWidth;
                
                const fitScale = currentViewport.clientWidth / currentScalableContainer.offsetWidth;
                scaleStateRef.current.minScale = fitScale;

                if (scaleStateRef.current.currentScale < fitScale) {
                    setScale(fitScale);
                }
            }
        };

        window.addEventListener('load', initializeScale);
        window.addEventListener('resize', handleResize);
        viewport.addEventListener('wheel', handleWheel, { passive: false });
        viewport.addEventListener('touchstart', handleTouchStart, { passive: false });
        viewport.addEventListener('touchmove', handleTouchMove, { passive: false });

        return () => {
            window.removeEventListener('load', initializeScale);
            window.removeEventListener('resize', handleResize);
            if (viewport) {
              viewport.removeEventListener('wheel', handleWheel);
              viewport.removeEventListener('touchstart', handleTouchStart);
              viewport.removeEventListener('touchmove', handleTouchMove);
            }
        };

    }, [initializeScale, setScale]);

    const handleStatusChange = async (id: string, type: StatusType) => {
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
        
        const docRef = doc(db, 'employees', id);
        await updateDoc(docRef, updatedData);
    };
    
    const handleToggleSpecialTeam = async (id: string) => {
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
            showNotification('Falha ao atualizar status.', 'error');
        } finally {
            setTogglingSpecialTeamId(null);
        }
    };

    const handleManualRegister = (matricula: string, subject: string, origin: 'main' | 'special') => {
        if (!matricula) {
            showNotification('Por favor, insira uma matrícula.', 'error');
            return;
        }
        
        const newRegistration: ManualRegistration = {
            matricula,
            subject: subject || 'Não informado',
            origin,
            timestamp: new Date(),
        };

        setManualRegistrations(prev => [...prev, newRegistration]);
        showNotification(`Registro para matrícula ${matricula} adicionado ao relatório.`, 'success');
    };

    const handleAdminLogin = async (email: string) => {
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
            showNotification('Erro ao tentar fazer login.', 'error');
        }
    };
    
    const handleAddUser = async (name: string, matricula: string) => {
        if (!isAdmin) {
            showNotification('Apenas administradores podem adicionar usuários.', 'error');
            return;
        }
        try {
            const existingUser = employees.find(e => e.matricula === matricula);
            if(existingUser) {
                throw new Error('Matrícula já existe.');
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
                showNotification('Falha ao deletar usuário.', 'error');
            }
        }
    };

    const handleClearData = async () => {
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
                    inSpecialTeam: false,
                });
            });
            await batch.commit();
            setActiveModal(ModalType.None);
            showNotification('Dados de status foram limpos!', 'success');
        } catch(error) {
            console.error("Error clearing data:", error);
            showNotification('Falha ao limpar dados.', 'error');
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
            <div ref={viewportRef} className="viewport fixed inset-0">
                <div ref={scalableContainerRef} className="scalable-container w-[2448px] min-h-full p-8">
                    <Header
                        stats={stats}
                        loading={loading}
                        onAdminClick={() => setActiveModal(ModalType.AdminLogin)}
                        isDarkMode={isDarkMode}
                        onToggleDarkMode={handleToggleDarkMode}
                    />

                    <ManualRegisterSection onRegister={(matricula, subject) => handleManualRegister(matricula, subject, 'main')} />

                    <div className="flex gap-8 w-[2384px]">
                        <div className="flex-grow flex gap-8">
                            <div className="flex flex-col gap-6 w-[752px]">
                                {leftColumn.map(emp => <EmployeeCard key={emp.id} employee={emp} onStatusChange={handleStatusChange} onToggleSpecialTeam={handleToggleSpecialTeam} isTogglingSpecialTeam={togglingSpecialTeamId === emp.id} isAdmin={isAdmin} onDelete={handleDeleteUser} />)}
                            </div>
                            <div className="flex flex-col gap-6 w-[752px]">
                                {rightColumn.map(emp => <EmployeeCard key={emp.id} employee={emp} onStatusChange={handleStatusChange} onToggleSpecialTeam={handleToggleSpecialTeam} isTogglingSpecialTeam={togglingSpecialTeamId === emp.id} isAdmin={isAdmin} onDelete={handleDeleteUser} />)}
                            </div>
                        </div>
                        <SpecialTeamPanel 
                            specialTeam={specialTeam} 
                            onStatusChange={handleStatusChange}
                            onToggleSpecialTeam={handleToggleSpecialTeam}
                            onRegister={(matricula, subject) => handleManualRegister(matricula, subject, 'special')}
                            togglingSpecialTeamId={togglingSpecialTeamId}
                            isAdmin={isAdmin}
                            onDelete={handleDeleteUser}
                        />
                    </div>
                    <Footer />
                </div>
            </div>
            
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
                manualRegistrations={manualRegistrations}
                showNotification={showNotification}
            />
            <div className="fixed top-5 right-5 z-[100] space-y-3">
                {notifications.map(n => <Notification key={n.id} notification={n} onDismiss={dismissNotification} />)}
            </div>
        </div>
    );
};

const ManualRegisterSection: React.FC<{onRegister: (matricula: string, subject: string) => void}> = ({onRegister}) => {
    const [subject, setSubject] = useState('');
    const [matricula, setMatricula] = useState('');

    const handleRegisterClick = () => {
        onRegister(matricula, subject);
    };
    
    const handleMatriculaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setMatricula(e.target.value.replace(/[^0-9]/g, ''));
    };

    return (
        <div className="bg-light-card dark:bg-dark-card rounded-3xl p-8 mb-8 shadow-lg flex items-center gap-6 w-[1536px]">
            <div className="relative flex-1 max-w-md">
                <SubjectIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Assunto do DSS (7H-19H)" className="w-full pl-12 pr-4 py-4 bg-light-bg dark:bg-dark-bg border-2 border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none transition"/>
            </div>
            <div className="relative flex-1 max-w-md">
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
            <button onClick={handleRegisterClick} className="px-9 py-4 font-bold text-white bg-gradient-to-r from-primary to-primary-dark rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300">
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
            <button onClick={onClear} className="w-full py-4 font-bold text-white bg-orange rounded-lg hover:bg-orange-600 transition">LIMPAR STATUS</button>
            <button onClick={onSendReport} className="w-full py-4 font-bold text-white bg-blue-500 rounded-lg hover:bg-blue-600 transition">ENVIAR RELATÓRIO</button>
            <button onClick={onReorganize} className="w-full py-4 font-bold text-white bg-danger rounded-lg hover:bg-red-600 transition">REORGANIZAR PAINEL</button>
            <button onClick={onAddUser} className="w-full py-4 font-bold text-white bg-success rounded-lg hover:bg-green-600 transition">NOVO USUÁRIO</button>
        </div>
    </Modal>
);

const AddUserModal: React.FC<{isOpen: boolean, onClose: () => void, onAdd: (name: string, matricula: string) => void}> = ({isOpen, onClose, onAdd}) => {
    const [name, setName] = useState('');
    const [matricula, setMatricula] = useState('');
    
    const handleSubmit = () => {
        if (name && matricula) {
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
    manualRegistrations: ManualRegistration[];
    showNotification: (message: string, type?: 'success' | 'error') => void;
}> = ({ isOpen, onClose, employees, manualRegistrations, showNotification }) => {
    
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

STATUS "NÃO ESTOU BEM"
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
            manualRegistrationsText = [...manualRegistrations]
              .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
              .map(reg => {
                const formattedTimestamp = `${reg.timestamp.toLocaleDateString('pt-BR', {day: '2-digit', month: '2-digit', year: 'numeric'})} ${reg.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
                return `- Matrícula: ${reg.matricula} | Assunto: ${reg.subject} | Turno: ${reg.origin === 'main' ? '7H-19H' : '6H'} | Hora: ${formattedTimestamp}`
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

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Relatório de Status">
            <div className="text-left bg-light-bg dark:bg-dark-bg-secondary p-4 rounded-lg max-h-96 overflow-y-auto">
                <pre className="whitespace-pre-wrap text-sm font-mono text-light-text dark:text-dark-text">{reportText}</pre>
            </div>
            <div className="mt-6 flex flex-col sm:flex-row gap-4">
                <button onClick={handleCopyReport} className="w-full py-4 font-bold text-white bg-primary rounded-lg hover:bg-primary-dark transition">
                    COPIAR RELATÓRIO
                </button>
                <button onClick={handleDownloadReport} className="w-full py-4 font-bold text-white bg-success rounded-lg hover:bg-green-600 transition">
                    BAIXAR RELATÓRIO
                </button>
            </div>
        </Modal>
    );
};

export default App;