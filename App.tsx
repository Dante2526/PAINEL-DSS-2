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
import ZoomIndicator from './components/ZoomIndicator';

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

    const [zoomLevel, setZoomLevel] = useState(100);
    const [isZooming, setIsZooming] = useState(false);
    let zoomTimeout: number;

     const updateZoomLevel = useCallback(() => {
        const currentZoom = Math.round(window.devicePixelRatio * 100);
        setZoomLevel(currentZoom);
    }, []);

    useEffect(() => {
        updateZoomLevel();
        window.addEventListener('resize', updateZoomLevel);

        const handleWheel = (event: WheelEvent) => {
            if (event.ctrlKey) {
                setIsZooming(true);
                clearTimeout(zoomTimeout);
                // The timeout will hide the indicator after the user stops zooming
                zoomTimeout = window.setTimeout(() => {
                    setIsZooming(false);
                }, 1500);
            }
        };

        window.addEventListener('wheel', handleWheel);

        return () => {
            window.removeEventListener('resize', updateZoomLevel);
            window.removeEventListener('wheel', handleWheel);
            clearTimeout(zoomTimeout);
        };
    }, [updateZoomLevel]);
    
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
            showNotification(`Erro ao atualizar status: ${message}`, 'error');
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
            showNotification(`${employee.name} foi ${!employee.inSpecialTeam ? 'adicionado à' : 'removido da'} equipe especial.`, 'success');
        } catch (error) {
            console.error("Error toggling special team status:", error);
            const message = error instanceof Error ? error.message : 'Ocorreu um erro desconhecido.';
            showNotification(`Erro ao atualizar status: ${message}`, "error");
        } finally {
            setTogglingSpecialTeamId(null);
        }
    };

    const handleDeleteUser = async (id: string) => {
        if (!db || !isAdmin) return;
        if (window.confirm("Tem certeza que deseja deletar este funcionário? Esta ação não pode ser desfeita.")) {
            try {
                await deleteDoc(doc(db, 'employees', id));
                showNotification('Funcionário deletado com sucesso.', 'success');
            } catch (error) {
                console.error("Error deleting employee:", error);
                const message = error instanceof Error ? error.message : 'Ocorreu um erro desconhecido.';
                showNotification(`Erro ao deletar funcionário: ${message}`, "error");
            }
        }
    };

    const handleManualRegister = async (matricula: string, assunto: string, turno: '7H-19H' | '6H') => {
        if (!db) return;
        if (!matricula || !assunto) {
            showNotification('Matrícula e assunto são obrigatórios.', 'error');
            return;
        }

        const employeeExists = employees.some(e => e.matricula === matricula);
        if (!employeeExists) {
            showNotification('Matrícula não encontrada.', 'error');
            return;
        }

        try {
            const registrationsQuery = query(collection(db, 'registrosDSS'), where("TURNO", "==", turno));
            const querySnapshot