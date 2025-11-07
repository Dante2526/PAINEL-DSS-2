export interface Employee {
  id: string;
  name: string;
  matricula: string;
  assDss: boolean;
  bem: boolean;
  mal: boolean;
  absent: boolean;
  time: string | null;
  inSpecialTeam: boolean;
}

export interface ManualRegistration {
  id: string;
  matricula: string;
  assunto: string;
  TURNO: string;
}

export type StatusType = 'assDss' | 'bem' | 'mal' | 'absent';

export enum ModalType {
  None,
  AdminLogin,
  AdminOptions,
  AddUser,
  Report,
}