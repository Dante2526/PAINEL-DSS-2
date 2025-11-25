
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Header from './components/Header';
import EmployeeCard from './components/EmployeeCard';
import SpecialTeamPanel from './components/SpecialTeamPanel';
import Modal from './components/Modal';
import Notification from './components/Notification';
import { SubjectIcon, UserIcon } from './components/icons';
import { Employee, StatusType, ModalType, ManualRegistration } from './types';
import type { NotificationData } from './components/Notification';
import { db, auth, isConfigured } from './firebase';
// FIX: Switched to scoped Firebase packages for imports to match project configuration and resolve module errors.
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
} from '@firebase/firestore';
// FIX: Switched to scoped Firebase packages for imports to match project configuration and resolve module errors.
import { signInAnonymously } from '@firebase/auth';
import emailjs from '@emailjs/browser';
import './styles.css';
import { formatTimestamp } from './services/employeeService';

// --- CONFIGURAÇÃO EMAILJS ---
const EMAILJS_SERVICE_ID = "service_adjw0cj";
const EMAILJS_TEMPLATE_ID = "template_owo0dmm";
const EMAILJS_PUBLIC_KEY = "Ef-7IoF9U9NQ_iV8X";
// ----------------------------

const App: React.FC = () => {
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeModal, setActiveModal] = useState<ModalType>(ModalType.None);
    const [notifications, setNotifications] = useState<NotificationData[]>([]);
    const [togglingSpecialTeamId, setTogglingSpecialTeamId] = useState<string | null>(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const viewportRef = useRef<HTMLDivElement>(null);
    const scalableContainerRef = useRef<HTMLDivElement>(null);
    const scaleStateRef = useRef({ currentScale: 1 });
    const [modalScale, setModalScale] = useState(1);
    
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

    useEffect(() => {
        const calculateModalScale = () => {
            const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
            
            if (isTouchDevice) {
                // The previous scale factor (4.5) was still a bit too large,
                // causing the modal to be clipped vertically on some phone screens.
                // This further reduced factor provides a better fit, ensuring the entire
                // modal is visible while remaining large and legible.
                setModalScale(2.0);
            } else {
                setModalScale(1); // Default scale for desktop
            }
        };

        calculateModalScale();
        window.addEventListener('resize', calculateModalScale);
        return () => window.removeEventListener('resize', calculateModalScale);
    }, []);

    const handleToggleDarkMode = () => setIsDarkMode(prev => !prev);

    const showNotification = useCallback((message: string, type: 'success' | 'error' = 'success') => {
        const newNotification = { id: Date.now(), message, type };
        setNotifications(prev => [...prev, newNotification]);
    }, []);

    const dismissNotification = (id: number) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
    };

    // Função para enviar alerta por e-mail
    const sendAlertEmail = async (name: string, matricula: string, turno: string) => {
        try {
            const currentTime = new Date().toLocaleString('pt-BR');
            
            // HTML EMAIL BUILDER - CLEAN CARD LAYOUT (NO BORDERS, BLACK TEXT)
            const emailContent = `
            <!DOCTYPE html>
            <html lang="pt-BR">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Alerta de Saúde</title>
            </head>
            <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #ffffff;">
                
                <!-- Main Wrapper -->
                <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #ffffff; width: 100%;">
                    <tr>
                        <td align="center" style="padding: 20px 0;">
                            
                            <!-- Container (Max Width 600px for Mobile) -->
                            <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; width: 100%;">
                                
                                <!-- Pre-header (Inbox Preview Text) -->
                                <tr>
                                    <td style="display:none !important; visibility:hidden; mso-hide:all; font-size:1px; color:#ffffff; line-height:1px; max-height:0px; max-width:0px; opacity:0; overflow:hidden;">
                                        🚨 Alerta de Saúde: Colaborador informou "ESTOU MAL". Verifique imediatamente.
                                    </td>
                                </tr>

                                <!-- Header Alert -->
                                <tr>
                                    <td style="padding-bottom: 20px;">
                                        <table width="100%" border="0" cellspacing="0" cellpadding="0">
                                            <tr>
                                                <td style="border-left: 4px solid #dc2626; padding-left: 15px;">
                                                    <h1 style="margin: 0; color: #dc2626; font-size: 24px; font-weight: bold; line-height: 1.2;">
                                                        Alerta de Saúde e Segurança!
                                                    </h1>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>

                                <!-- Main Message -->
                                <tr>
                                    <td style="padding-bottom: 30px;">
                                        <p style="margin: 0; font-size: 18px; line-height: 1.5; color: #000000;">
                                            O colaborador <strong>${name}</strong> informou que não está se sentindo bem.
                                        </p>
                                    </td>
                                </tr>

                                <!-- Details Card (Clean Layout) -->
                                <tr>
                                    <td style="padding-bottom: 30px;">
                                        <div style="background-color: #f8f9fa; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px;">
                                            
                                            <!-- Card Header -->
                                            <p style="margin: 0 0 16px 0; font-size: 12px; font-weight: bold; color: #000000; text-transform: uppercase; letter-spacing: 1px;">
                                                DETALHES DO REGISTRO:
                                            </p>

                                            <!-- Data Table (No Borders) -->
                                            <table width="100%" border="0" cellspacing="0" cellpadding="0">
                                                <!-- Nome -->
                                                <tr>
                                                    <td style="padding-bottom: 8px; width: 100px; vertical-align: top;">
                                                        <strong style="font-size: 15px; color: #000000;">Nome:</strong>
                                                    </td>
                                                    <td style="padding-bottom: 8px; vertical-align: top;">
                                                        <span style="font-size: 15px; color: #000000; font-weight: bold;">${name}</span>
                                                    </td>
                                                </tr>
                                                <!-- Matrícula -->
                                                <tr>
                                                    <td style="padding-bottom: 8px; width: 100px; vertical-align: top;">
                                                        <strong style="font-size: 15px; color: #000000;">Matrícula:</strong>
                                                    </td>
                                                    <td style="padding-bottom: 8px; vertical-align: top;">
                                                        <span style="font-size: 15px; color: #000000; font-weight: bold;">${matricula}</span>
                                                    </td>
                                                </tr>
                                                <!-- Turno -->
                                                <tr>
                                                    <td style="padding-bottom: 8px; width: 100px; vertical-align: top;">
                                                        <strong style="font-size: 15px; color: #000000;">Turno:</strong>
                                                    </td>
                                                    <td style="padding-bottom: 8px; vertical-align: top;">
                                                        <span style="font-size: 15px; color: #000000; font-weight: bold;">${turno}</span>
                                                    </td>
                                                </tr>
                                                <!-- Horário -->
                                                <tr>
                                                    <td style="padding-bottom: 0; width: 100px; vertical-align: top;">
                                                        <strong style="font-size: 15px; color: #000000;">Horário:</strong>
                                                    </td>
                                                    <td style="padding-bottom: 0; vertical-align: top;">
                                                        <span style="font-size: 15px; color: #000000; font-weight: bold;">${currentTime}</span>
                                                    </td>
                                                </tr>
                                            </table>
                                        </div>
                                    </td>
                                </tr>

                                <!-- Footer Alert Box -->
                                <tr>
                                    <td>
                                        <table width="100%" border="0" cellspacing="0" cellpadding="0">
                                            <tr>
                                                <td align="center" style="background-color: #ff5252; border-radius: 8px; padding: 16px; border: 1px solid #ff5252;">
                                                    <span style="color: #000000; font-weight: bold; font-size: 16px;">
                                                        Por favor, verifique a situação imediatamente.
                                                    </span>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>

                                <!-- Footer Note -->
                                <tr>
                                    <td align="center" style="padding-top: 30px;">
                                        <p style="margin: 0; font-size: 12px; color: #000000;">
                                            Este é um e-mail automático do sistema DSS.
                                        </p>
                                    </td>
                                </tr>

                            </table>
                            <!-- End Container -->

                        </td>
                    </tr>
                </table>
            </body>
            </html>
            `;

            const templateParams = {
                // O Template do EmailJS deve conter APENAS: {{{html_content}}}
                html_content: emailContent,
                // Assunto personalizado com Sirene e "ESTOU MAL" em maiúsculo
                subject: `🚨 ALERTA URGENTE TURMA B: "ESTOU MAL"`,
            };

            await emailjs.send(
                EMAILJS_SERVICE_ID,
                EMAILJS_TEMPLATE_ID,
                templateParams,
                EMAILJS_PUBLIC_KEY
            );
            
            showNotification('Alerta enviado por e-mail ao setor responsável.', 'success');
        } catch (error) {
            console.error("Erro ao enviar e-mail via EmailJS:", error);
            // Não mostramos erro visual para o usuário final para não gerar pânico, apenas logamos
        }
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
                            turno: data.turno || '7H',
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
    }, [showNotification]);

    const setScale = useCallback((newScale: number, scrollX?: number, scrollY?: number) => {
        const viewport = viewportRef.current;
        const scalableContainer = scalableContainerRef.current;
        if (!viewport || !scalableContainer) return;

        const finalScale = Math.max(0.1, Math.min(newScale, 2.0));
        scaleStateRef.current.currentScale = finalScale;

        // Dynamically set minWidth and minHeight to ensure the container always fills the viewport,
        // effectively expanding it when zoomed out.
        scalableContainer.style.minWidth = `${viewport.clientWidth / finalScale}px`;
        scalableContainer.style.minHeight = `${viewport.clientHeight / finalScale}px`;

        scalableContainer.style.transform = `scale(${finalScale})`;
        if (scrollX !== undefined) viewport.scrollLeft = scrollX;
        if (scrollY !== undefined) viewport.scrollTop = scrollY;
    }, []);

    const initializeScale = useCallback(() => {
        const viewport = viewportRef.current;
        const scalableContainer = scalableContainerRef.current;
        if (!viewport || !scalableContainer) return;

        const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        if (isTouchDevice) {
            const fitScale = viewport.clientWidth / scalableContainer.offsetWidth;
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
            if (window.innerWidth !== lastWidth) {
                lastWidth = window.innerWidth;
                // Re-applying the scale will trigger a recalculation of minWidth/minHeight
                // based on the new viewport dimensions.
                setScale(scaleStateRef.current.currentScale);
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
                    // TRIGGER EMAIL ALERT HERE
                    sendAlertEmail(employee.name, employee.matricula, employee.turno);
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
            const newTurno = employee.turno === '6H' ? '7H' : '6H';
            await updateDoc(docRef, { 
                turno: newTurno
            });
            showNotification(`${employee.name} foi movido para o turno ${newTurno}.`, 'success');
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
                turno: '7H'
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
            
            // 1. Limpar status dos funcionários
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

            // 2. Limpar registros manuais (Assunto DSS e Matrícula)
            const registrationsSnapshot = await getDocs(collection(db, 'registrosDSS'));
            registrationsSnapshot.forEach((doc) => {
                batch.delete(doc.ref);
            });

            await batch.commit();
            setActiveModal(ModalType.None);
            showNotification('Dados de status diário e registros manuais foram limpos!', 'success');
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
    
    const mainTeam = useMemo(() => employees.filter(e => e.turno !== '6H'), [employees]);
    const specialTeam = useMemo(() => employees.filter(e => e.turno === '6H'), [employees]);

    const columnSize = Math.ceil(mainTeam.length / 2);
    const leftColumn = mainTeam.slice(0, columnSize);
    const rightColumn = mainTeam.slice(columnSize);

    return (
        <div className="bg-light-bg-secondary dark:bg-dark-bg min-h-screen text-light-text dark:text-dark-text transition-colors">
            <div ref={viewportRef} className="viewport fixed inset-0">
                <div ref={scalableContainerRef} className="scalable-container w-[2448px] p-8">
                    <Header
                        stats={stats}
                        loading={loading}
                        onAdminClick={() => setActiveModal(ModalType.AdminLogin)}
                        isDarkMode={isDarkMode}
                        onToggleDarkMode={handleToggleDarkMode}
                    />
                    
                    <div className="flex gap-8 w-[2384px]">
                       <div className="w-[1536px] flex flex-col gap-8">
                            <ManualRegisterSection 
                                subject={mainSubject}
                                matricula={mainMatricula}
                                onSubjectChange={setMainSubject}
                                onMatriculaChange={setMainMatricula}
                                onRegister={() => handleManualRegister('7H-19H')} 
                            />
                            <div className="flex-grow flex gap-8">
                                <div className="flex flex-col gap-6 w-[752px]">
                                    {leftColumn.map(emp => <EmployeeCard key={emp.id} employee={emp} onStatusChange={handleStatusChange} onToggleSpecialTeam={handleToggleSpecialTeam} isTogglingSpecialTeam={togglingSpecialTeamId === emp.id} isAdmin={isAdmin} onDelete={handleDeleteUser} />)}
                                </div>
                                <div className="flex flex-col gap-6 w-[752px]">
                                    {rightColumn.map(emp => <EmployeeCard key={emp.id} employee={emp} onStatusChange={handleStatusChange} onToggleSpecialTeam={handleToggleSpecialTeam} isTogglingSpecialTeam={togglingSpecialTeamId === emp.id} isAdmin={isAdmin} onDelete={handleDeleteUser} />)}
                                </div>
                            </div>
                       </div>
                        <SpecialTeamPanel 
                            specialTeam={specialTeam} 
                            onStatusChange={handleStatusChange}
                            onToggleSpecialTeam={handleToggleSpecialTeam}
                            togglingSpecialTeamId={togglingSpecialTeamId}
                            isAdmin={isAdmin}
                            onDeleteUser={handleDeleteUser}
                            // Props for controlled inputs
                            subject={specialSubject}
                            matricula={specialMatricula}
                            onSubjectChange={setSpecialSubject}
                            onMatriculaChange={setSpecialMatricula}
                            onRegister={() => handleManualRegister('6H')}
                        />
                    </div>
                </div>
            </div>
            
            <AdminLoginModal isOpen={activeModal === ModalType.AdminLogin} onClose={() => setActiveModal(ModalType.None)} onLogin={handleAdminLogin} scale={modalScale} />
            <AdminOptionsModal 
                isOpen={activeModal === ModalType.AdminOptions} 
                onClose={() => setActiveModal(ModalType.None)} 
                onClear={handleClearData} 
                onReorganize={handleReorganize} 
                onAddUser={() => setActiveModal(ModalType.AddUser)}
                onSendReport={() => setActiveModal(ModalType.Report)}
                scale={modalScale}
            />
            <AddUserModal isOpen={activeModal === ModalType.AddUser} onClose={() => setActiveModal(ModalType.None)} onAdd={handleAddUser} scale={modalScale} />
            <ReportModal 
                isOpen={activeModal === ModalType.Report}
                onClose={() => setActiveModal(ModalType.None)}
                employees={employees}
                showNotification={showNotification}
                scale={modalScale}
            />
            <div 
                className="fixed top-5 right-5 z-[100] space-y-3"
                style={{ transform: `scale(${modalScale})`, transformOrigin: 'top right' }}
            >
                {notifications.map(n => <Notification key={n.id} notification={n} onDismiss={dismissNotification} />)}
            </div>
        </div>
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
            <div className="relative flex-1 max-w-md">
                <SubjectIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input 
                    type="text" 
                    value={subject} 
                    onChange={(e) => onSubjectChange(e.target.value)} 
                    placeholder="Assunto do DSS" 
                    className="w-full pl-12 pr-4 py-4 bg-light-bg dark:bg-dark-bg border-2 border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none transition"
                />
            </div>
            <div className="relative flex-1 max-w-md">
                <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input 
                    type="text" 
                    value={matricula} 
                    onChange={handleMatriculaChange} 
                    placeholder="Matrícula" 
                    className="w-full pl-12 pr-4 py-4 bg-light-bg dark:bg-dark-bg border-2 border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none transition"
                    inputMode="numeric"
                    pattern="[0-9]*"
                />
            </div>
            <button onClick={onRegister} className="px-9 py-4 font-bold text-white bg-gradient-to-r from-primary to-primary-dark rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300">
                REGISTRAR
            </button>
        </div>
    );
};

const AdminLoginModal: React.FC<{isOpen: boolean, onClose: () => void, onLogin: (email: string) => void, scale?: number}> = ({isOpen, onClose, onLogin, scale}) => {
    const [email, setEmail] = useState('');

    const handleSubmit = () => {
        onLogin(email);
        setEmail('');
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Acesso Administrativo" scale={scale}>
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
    onSendReport: () => void,
    scale?: number
}> = ({isOpen, onClose, onClear, onReorganize, onAddUser, onSendReport, scale}) => (
    <Modal isOpen={isOpen} onClose={onClose} title="Opções Administrativas" scale={scale}>
        <div className="space-y-4">
            <button onClick={onClear} className="w-full py-4 font-bold text-white bg-orange rounded-lg hover:bg-orange-600 transition">LIMPAR STATUS DIÁRIO</button>
            <button onClick={onSendReport} className="w-full py-4 font-bold text-white bg-blue-500 rounded-lg hover:bg-blue-600 transition">GERAR RELATÓRIO</button>
            <button onClick={onReorganize} className="w-full py-4 font-bold text-white bg-danger rounded-lg hover:bg-red-600 transition">REORGANIZAR PAINEL</button>
            <button onClick={onAddUser} className="w-full py-4 font-bold text-white bg-success rounded-lg hover:bg-green-600 transition">NOVO USUÁRIO</button>
        </div>
    </Modal>
);

const AddUserModal: React.FC<{isOpen: boolean, onClose: () => void, onAdd: (name: string, matricula: string) => void, scale?: number}> = ({isOpen, onClose, onAdd, scale}) => {
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
        <Modal isOpen={isOpen} onClose={onClose} title="Adicionar Novo Usuário" scale={scale}>
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
    scale?: number;
}> = ({ isOpen, onClose, employees, showNotification, scale = 1 }) => {
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

    // Logic for plain text clipboard/email
    const reportText = useMemo(() => {
        const total = employees.length;
        
        const categorizeEmployees = (team: Employee[]) => {
            const mal = team.filter(e => e.mal);
            const ok = team.filter(e => !e.mal && e.bem && e.assDss);
            // Pendentes covers everyone else (including explicit absent)
            const pending = team.filter(e => !e.mal && !(e.bem && e.assDss));
            return { mal, ok, pending };
        };

        const mainTeam = employees.filter(e => e.turno !== '6H');
        const specialTeam = employees.filter(e => e.turno === '6H');

        const mainCat = categorizeEmployees(mainTeam);
        const specialCat = categorizeEmployees(specialTeam);
        
        const totalOk = mainCat.ok.length + specialCat.ok.length;
        const totalMal = mainCat.mal.length + specialCat.mal.length;
        const presentCount = totalOk + totalMal;
        const pendingAbsentCount = total - presentCount;

        // Format helper
        const formatList = (list: Employee[], emptyLabel = "Nenhum") => {
            if (list.length === 0) return emptyLabel;
            // Sort by name for better readability? The list is likely already sorted by the main query listener, but good to ensure.
            // Assuming employees are sorted in state.
            return list.map(e => `• ${e.name} (Matrícula: ${e.matricula})`).join('\n');
        };

        const employeeReport = `RESUMO GERAL
--------------------------------------------------
• Total de Funcionários: ${total}
• Presentes (DSS + Bem/Mal): ${presentCount}
• Pendentes / Ausentes: ${pendingAbsentCount}

TURNO 7H
--------------------------------------------------
ASS.DSS + ESTOU BEM
${formatList(mainCat.ok)}

ESTOU MAL
${formatList(mainCat.mal)}

PENDENTES / AUSENTES
${formatList(mainCat.pending)}

TURNO 6H
--------------------------------------------------
ASS.DSS + ESTOU BEM
${formatList(specialCat.ok)}

ESTOU MAL
${formatList(specialCat.mal)}

PENDENTES / AUSENTES
${formatList(specialCat.pending)}`;

        return employeeReport;
    }, [employees]);

    // Logic for Visual HTML Report
    const categorizeEmployees = (team: Employee[]) => {
        const mal = team.filter(e => e.mal);
        const ok = team.filter(e => !e.mal && e.bem && e.assDss);
        // Pendentes: Quem não está mal, e não completou o processo (ausente ou esqueceu de marcar algo)
        const pending = team.filter(e => !e.mal && !(e.bem && e.assDss));
        return { mal, ok, pending };
    };

    const mainTeam = employees.filter(e => e.turno !== '6H');
    const specialTeam = employees.filter(e => e.turno === '6H');

    const mainCat = categorizeEmployees(mainTeam);
    const specialCat = categorizeEmployees(specialTeam);

    const renderEmployeeList = (list: Employee[], emptyText: string = 'Ninguém') => (
        <ul className="list-none space-y-1 pl-1">
            {list.map(e => (
                <li key={e.id} className="text-light-text dark:text-dark-text text-sm flex items-center gap-2">
                   {e.mal ? <span className="text-red-500 font-bold">⚠</span> : 
                    (e.bem && e.assDss) ? <span className="text-green-500 font-bold">✓</span> : 
                    <span className="text-gray-400">•</span>}
                   <span className={e.mal ? "font-bold" : ""}>{e.name} ({e.matricula})</span>
                   {e.absent && <span className="text-xs text-gray-400">(Ausente)</span>}
                </li>
            ))}
            {list.length === 0 && <li className="text-gray-400 text-xs italic ml-4">{emptyText}</li>}
        </ul>
    );

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

    if (!isOpen) return null;

    const isMobile = scale > 1.1; // Threshold to detect if we are scaled up for mobile
    const finalScale = isMobile ? scale * 0.7 : 0.85;
    const maxWidthClass = isMobile ? 'max-w-2xl' : 'max-w-5xl';
    const maxHeightClass = isMobile ? 'max-h-[40vh]' : 'max-h-[80vh]';

    const modalStyle = { 
        transform: `scale(${finalScale})`, 
        animation: 'fade-in-scale 0.3s forwards ease-out' 
    };

    return (
        <div 
            className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 transition-opacity duration-300"
            onClick={onClose}
        >
            <div 
                className={`bg-light-card dark:bg-dark-card rounded-2xl shadow-2xl p-8 w-full ${maxWidthClass} text-center`}
                style={modalStyle}
                onClick={(e) => e.stopPropagation()}
            >
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-3xl z-10">&times;</button>
                <h2 className="text-xl font-bold uppercase text-light-text dark:text-dark-text mb-6">RELATÓRIO</h2>
                
                <div className={`text-left bg-light-bg dark:bg-dark-bg-secondary p-6 rounded-lg ${maxHeightClass} overflow-y-auto`}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Column 7H */}
                        <div>
                            <h2 className="text-xl font-bold text-primary mb-4 border-b-2 border-primary pb-2">TURNO 7H</h2>
                            
                            <div className="mb-6">
                                <h3 className="bg-success text-white font-bold px-3 py-1 rounded text-sm uppercase mb-2">ASS.DSS + ESTOU BEM ({mainCat.ok.length})</h3>
                                {renderEmployeeList(mainCat.ok)}
                            </div>

                            <div className="mb-6">
                                <h3 className="bg-danger text-white font-bold px-3 py-1 rounded text-sm uppercase mb-2">ESTOU MAL ({mainCat.mal.length})</h3>
                                {renderEmployeeList(mainCat.mal)}
                            </div>

                            <div className="mb-6">
                                <h3 className="bg-neutral text-white font-bold px-3 py-1 rounded text-sm uppercase mb-2">PENDENTES / AUSENTES ({mainCat.pending.length})</h3>
                                {renderEmployeeList(mainCat.pending)}
                            </div>
                        </div>

                        {/* Column 6H */}
                         <div>
                            <h2 className="text-xl font-bold text-orange mb-4 border-b-2 border-orange pb-2">TURNO 6H</h2>
                            
                            <div className="mb-6">
                                <h3 className="bg-success text-white font-bold px-3 py-1 rounded text-sm uppercase mb-2">ASS.DSS + ESTOU BEM ({specialCat.ok.length})</h3>
                                {renderEmployeeList(specialCat.ok)}
                            </div>

                            <div className="mb-6">
                                <h3 className="bg-danger text-white font-bold px-3 py-1 rounded text-sm uppercase mb-2">ESTOU MAL ({specialCat.mal.length})</h3>
                                {renderEmployeeList(specialCat.mal)}
                            </div>

                            <div className="mb-6">
                                <h3 className="bg-neutral text-white font-bold px-3 py-1 rounded text-sm uppercase mb-2">PENDENTES / AUSENTES ({specialCat.pending.length})</h3>
                                {renderEmployeeList(specialCat.pending)}
                            </div>
                        </div>
                    </div>

                    {/* Manual Registrations Section */}
                    {manualRegistrations.length > 0 && (
                        <div className="mt-8 pt-6 border-t-2 border-gray-200 dark:border-gray-700">
                            <h2 className="text-lg font-bold text-light-text dark:text-dark-text mb-4">ASSUNTOS DA DSS</h2>
                            <ul className="list-disc pl-5 space-y-2">
                                 {manualRegistrations.map(reg => {
                                     return (
                                         <li key={reg.id} className="text-sm text-light-text dark:text-dark-text">
                                             <span className="font-bold">{reg.matricula}</span> - {reg.assunto} <span className="text-xs bg-gray-200 dark:bg-gray-600 px-1 rounded">{reg.TURNO === '7H-19H' ? '7H' : reg.TURNO}</span>
                                         </li>
                                     )
                                 })}
                            </ul>
                        </div>
                    )}
                </div>

                <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <button onClick={handleCopyReport} className="w-full py-4 font-bold text-white bg-primary rounded-lg hover:bg-primary-dark transition">
                        COPIAR
                    </button>
                    <button onClick={handleDownloadReport} className="w-full py-4 font-bold text-white bg-success rounded-lg hover:bg-green-600 transition">
                        BAIXAR
                    </button>
                </div>
            </div>
            <style>{`
                @keyframes fade-in-scale {
                  from { opacity: 0; transform: scale(${finalScale * 0.95}); }
                  to { opacity: 1; transform: scale(${finalScale}); }
                }
            `}</style>
        </div>
    );
};

export default App;
