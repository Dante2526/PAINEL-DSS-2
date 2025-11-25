import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, orderBy, doc, updateDoc, deleteDoc, addDoc, Timestamp } from '@firebase/firestore';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged, User } from '@firebase/auth';
import { db, auth, isConfigured } from './firebase';
import { Employee, ManualRegistration, StatusType, ModalType } from './types';
import Header from './components/Header';
import EmployeeCard from './components/EmployeeCard';
import SpecialTeamPanel from './components/SpecialTeamPanel';
import ManualRegistrationsList from './components/ManualRegistrationsList';
import Modal from './components/Modal';
import Notification, { NotificationData } from './components/Notification';
import Footer from './components/Footer';
import ZoomIndicator from './components/ZoomIndicator';

const App: React.FC = () => {
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [manualRegistrations, setManualRegistrations] = useState<ManualRegistration[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);
    const [user, setUser] = useState<User | null>(null);
    const [isDarkMode, setIsDarkMode] = useState(() => {
        const saved = localStorage.getItem('theme');
        return saved ? saved === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    });
    
    const [activeModal, setActiveModal] = useState<ModalType>(ModalType.None);
    const [pendingMalEmployeeId, setPendingMalEmployeeId] = useState<string | null>(null);
    const [notification, setNotification] = useState<NotificationData | null>(null);
    const [togglingSpecialTeamId, setTogglingSpecialTeamId] = useState<string | null>(null);

    // Inputs for Special Team Panel
    const [subject6H, setSubject6H] = useState('');
    const [matricula6H, setMatricula6H] = useState('');

    // Inputs for Admin
    const [adminEmail, setAdminEmail] = useState('');
    const [adminPassword, setAdminPassword] = useState('');
    const [newUserName, setNewUserName] = useState('');
    const [newUserMatricula, setNewUserMatricula] = useState('');
    const [newUserTurno, setNewUserTurno] = useState('8H');

    // Zoom
    const [zoomLevel, setZoomLevel] = useState(100);
    const [isZoomVisible, setIsZoomVisible] = useState(false);

    // Calculate stats
    const stats = useMemo(() => {
        return {
            bem: employees.filter(e => e.bem).length,
            mal: employees.filter(e => e.mal).length,
            absent: employees.filter(e => e.absent).length,
            total: employees.length
        };
    }, [employees]);

    // Firebase Listeners
    useEffect(() => {
        if (!isConfigured || !db) {
            setLoading(false);
            return;
        }

        const q = query(collection(db, 'employees'), orderBy('name'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as unknown as Employee));
            setEmployees(data);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching employees:", error);
            showNotification("Erro ao carregar funcionários", "error");
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (!isConfigured || !db) return;
        const q = query(collection(db, 'manualRegistrations'), orderBy('createdAt', 'desc'));
            const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ManualRegistration));
            setManualRegistrations(data);
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (!auth) return;
        const unsubscribe = onAuthStateChanged(auth, (u) => {
            setUser(u);
            setIsAdmin(!!u);
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (isDarkMode) {
            document.documentElement.classList.add('dark');
            localStorage.setItem('theme', 'dark');
        } else {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('theme', 'light');
        }
    }, [isDarkMode]);

    // Zoom Handler
    useEffect(() => {
        const handleResize = () => {
            const level = Math.round(window.devicePixelRatio * 100);
            if (level !== zoomLevel) {
                setZoomLevel(level);
                setIsZoomVisible(true);
                setTimeout(() => setIsZoomVisible(false), 2000);
            }
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [zoomLevel]);

    const showNotification = (message: string, type: 'success' | 'error') => {
        setNotification({ id: Date.now(), message, type });
    };

    const handleDismissNotification = () => setNotification(null);

    const handleStatusChange = async (id: string, type: StatusType) => {
        if (!db) return;
        
        if (type === 'mal') {
            setPendingMalEmployeeId(id);
            setActiveModal(ModalType.ConfirmMal);
            return;
        }

        try {
            const updateData: Partial<Employee> = {
                time: Timestamp.now() as any,
                assDss: type === 'assDss',
                bem: type === 'bem',
                mal: false,
                absent: type === 'absent'
            };
            await updateDoc(doc(db, 'employees', id), updateData);
        } catch (error) {
            console.error("Error updating status:", error);
            showNotification("Erro ao atualizar status", "error");
        }
    };

    const handleConfirmMal = async () => {
        if (!pendingMalEmployeeId || !db) return;
        try {
            await updateDoc(doc(db, 'employees', pendingMalEmployeeId), {
                mal: true,
                bem: false,
                assDss: false,
                absent: false,
                time: Timestamp.now() as any
            });
            showNotification("Status atualizado para 'Estou Mal'", "success");
        } catch (error) {
                showNotification("Erro ao atualizar status", "error");
        }
        setPendingMalEmployeeId(null);
        setActiveModal(ModalType.None);
    };

    const handleToggleSpecialTeam = async (id: string) => {
        if (!db) return;
        setTogglingSpecialTeamId(id);
        try {
            const employee = employees.find(e => e.id === id);
            if (employee) {
                const newTurno = employee.turno === '6H' ? '8H' : '6H';
                await updateDoc(doc(db, 'employees', id), { turno: newTurno });
            }
        } catch (error) {
            showNotification("Erro ao alterar turno", "error");
        } finally {
            setTogglingSpecialTeamId(null);
        }
    };

    const handleRegisterManual = async () => {
        if (!db) return;
        if (!subject6H || !matricula6H) {
            showNotification("Preencha todos os campos", "error");
            return;
        }
        try {
            await addDoc(collection(db, 'manualRegistrations'), {
                matricula: matricula6H,
                assunto: subject6H,
                TURNO: '6H',
                createdAt: Timestamp.now()
            });
            showNotification("Registro manual adicionado", "success");
            setSubject6H('');
            setMatricula6H('');
        } catch (error) {
            showNotification("Erro ao adicionar registro", "error");
        }
    };

    const handleAdminLogin = async () => {
        if (!auth) return;
        try {
            await signInWithEmailAndPassword(auth, adminEmail, adminPassword);
            setActiveModal(ModalType.None);
            setAdminEmail('');
            setAdminPassword('');
            showNotification("Login realizado com sucesso", "success");
        } catch (error) {
            showNotification("Erro no login", "error");
        }
    };

    const handleLogout = async () => {
        if (!auth) return;
        await signOut(auth);
        setIsAdmin(false);
        showNotification("Logout realizado", "success");
    };

    const handleAddUser = async () => {
        if (!db) return;
        if (!newUserName || !newUserMatricula) {
            showNotification("Preencha nome e matrícula", "error");
            return;
        }
        try {
            await addDoc(collection(db, 'employees'), {
                name: newUserName.toUpperCase(),
                matricula: newUserMatricula,
                turno: newUserTurno,
                assDss: false,
                bem: false,
                mal: false,
                absent: false,
                time: null
            });
            showNotification("Funcionário adicionado", "success");
            setNewUserName('');
            setNewUserMatricula('');
            setActiveModal(ModalType.None);
        } catch (error) {
            showNotification("Erro ao adicionar funcionário", "error");
        }
    };

    const handleDeleteUser = async (id: string) => {
            if (!db || !window.confirm("Tem certeza que deseja excluir este funcionário?")) return;
            try {
                await deleteDoc(doc(db, 'employees', id));
                showNotification("Funcionário removido", "success");
            } catch (error) {
                showNotification("Erro ao remover funcionário", "error");
            }
    };
    
    const handleDeleteRegistration = async (id: string) => {
            if (!db || !window.confirm("Tem certeza que deseja excluir este registro?")) return;
            try {
                await deleteDoc(doc(db, 'manualRegistrations', id));
                showNotification("Registro removido", "success");
            } catch (error) {
                showNotification("Erro ao remover registro", "error");
            }
    };

    const regularEmployees = employees.filter(e => e.turno !== '6H');
    const specialTeamEmployees = employees.filter(e => e.turno === '6H');
    const modalScale = 1;

    return (
        <div className={`min-h-screen bg-gray-100 dark:bg-gray-900 transition-colors duration-300 p-8 flex flex-col items-center overflow-x-hidden ${isDarkMode ? 'dark' : ''}`}>
            <Header 
                stats={stats} 
                loading={loading} 
                onAdminClick={() => isAdmin ? setActiveModal(ModalType.AdminOptions) : setActiveModal(ModalType.AdminLogin)}
                isDarkMode={isDarkMode}
                onToggleDarkMode={() => setIsDarkMode(!isDarkMode)}
            />

            <main className="w-[2384px] flex gap-8 items-start relative">
                <div className="flex-grow">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {regularEmployees.map(employee => (
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
                        {regularEmployees.length === 0 && !loading && (
                            <div className="col-span-full text-center py-12 text-gray-500 text-xl">
                                Nenhum funcionário encontrado no turno regular.
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex flex-col gap-8 sticky top-8">
                        <SpecialTeamPanel 
                        specialTeam={specialTeamEmployees}
                        onStatusChange={handleStatusChange}
                        onToggleSpecialTeam={handleToggleSpecialTeam}
                        togglingSpecialTeamId={togglingSpecialTeamId}
                        isAdmin={isAdmin}
                        onDeleteUser={handleDeleteUser}
                        subject={subject6H}
                        matricula={matricula6H}
                        onSubjectChange={setSubject6H}
                        onMatriculaChange={setMatricula6H}
                        onRegister={handleRegisterManual}
                        />
                        
                        <ManualRegistrationsList 
                        title="REGISTROS MANUAIS - 6H"
                        registrations={manualRegistrations.filter(r => r.TURNO === '6H')}
                        employees={employees}
                        isAdmin={isAdmin}
                        onDelete={handleDeleteRegistration}
                        />
                </div>
            </main>

            <Footer />

            {/* Modals */}
            <Modal isOpen={activeModal === ModalType.AdminLogin} onClose={() => setActiveModal(ModalType.None)} title="Login Administrativo">
                <div className="space-y-4">
                    <input type="email" placeholder="Email" className="w-full p-3 border rounded dark:bg-gray-700 dark:text-white" value={adminEmail} onChange={e => setAdminEmail(e.target.value)} />
                    <input type="password" placeholder="Senha" className="w-full p-3 border rounded dark:bg-gray-700 dark:text-white" value={adminPassword} onChange={e => setAdminPassword(e.target.value)} />
                    <button onClick={handleAdminLogin} className="w-full bg-primary text-white p-3 rounded font-bold">ENTRAR</button>
                </div>
            </Modal>

            <Modal isOpen={activeModal === ModalType.AdminOptions} onClose={() => setActiveModal(ModalType.None)} title="Opções de Administrador">
                    <div className="space-y-4">
                    <button onClick={() => setActiveModal(ModalType.AddUser)} className="w-full bg-blue-500 text-white p-3 rounded font-bold">ADICIONAR FUNCIONÁRIO</button>
                    <button onClick={handleLogout} className="w-full bg-red-500 text-white p-3 rounded font-bold">SAIR</button>
                </div>
            </Modal>
            
            <Modal isOpen={activeModal === ModalType.AddUser} onClose={() => setActiveModal(ModalType.AdminOptions)} title="Novo Funcionário">
                <div className="space-y-4">
                        <input type="text" placeholder="Nome" className="w-full p-3 border rounded dark:bg-gray-700 dark:text-white" value={newUserName} onChange={e => setNewUserName(e.target.value)} />
                        <input type="text" placeholder="Matrícula" className="w-full p-3 border rounded dark:bg-gray-700 dark:text-white" value={newUserMatricula} onChange={e => setNewUserMatricula(e.target.value)} />
                        <select className="w-full p-3 border rounded dark:bg-gray-700 dark:text-white" value={newUserTurno} onChange={e => setNewUserTurno(e.target.value)}>
                        <option value="8H">Turno 8H</option>
                        <option value="6H">Turno 6H</option>
                        </select>
                        <button onClick={handleAddUser} className="w-full bg-success text-white p-3 rounded font-bold">SALVAR</button>
                </div>
            </Modal>

            {/* Confirm Mal Modal */}
            <Modal 
                isOpen={activeModal === ModalType.ConfirmMal} 
                onClose={() => {
                    setPendingMalEmployeeId(null);
                    setActiveModal(ModalType.None);
                }} 
                title="CONFIRMAÇÃO NECESSÁRIA" 
                scale={modalScale}
            >
                <div className="space-y-6 text-center p-2">
                    <div className="mx-auto w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-4">
                        <span className="text-4xl">🚨</span>
                    </div>
                    
                    <div className="flex flex-col items-center justify-center gap-1">
                        <p className="text-lg text-light-text dark:text-dark-text font-medium">
                            Você selecionou a opção
                        </p>
                        <h3 className="text-3xl font-extrabold text-danger mt-1">
                            "ESTOU MAL"
                        </h3>
                    </div>

                    <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary px-2">
                        Isso enviará um alerta imediato para a <strong className="text-light-text dark:text-dark-text">gestão</strong>. <br/>
                        Deseja realmente confirmar que não está se sentindo bem?
                    </p>
                    
                    <div className="grid grid-cols-1 gap-3 mt-6">
                        <button 
                            onClick={handleConfirmMal} 
                            className="w-full py-4 font-bold text-white bg-danger rounded-lg hover:bg-red-700 shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-1"
                        >
                            SIM, ESTOU MAL
                        </button>
                        <button 
                            onClick={() => {
                                setPendingMalEmployeeId(null);
                                setActiveModal(ModalType.None);
                            }} 
                            className="w-full py-4 font-bold text-light-text dark:text-white bg-gray-200 dark:bg-gray-600 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition"
                        >
                            CANCELAR
                        </button>
                    </div>
                </div>
            </Modal>

            {notification && <Notification notification={notification} onDismiss={handleDismissNotification} />}
            <ZoomIndicator level={zoomLevel} isVisible={isZoomVisible} />
        </div>
    );
};

export default App;