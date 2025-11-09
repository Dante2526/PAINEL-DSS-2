import React, { ReactNode } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  scale?: number;
  isMobile?: boolean;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, scale = 1, isMobile = false }) => {
  if (!isOpen) return null;

  const modalContainerClasses = isMobile 
    ? "bg-light-card dark:bg-dark-card w-full h-full p-8 text-center modal-mobile-fullscreen" 
    : "bg-light-card dark:bg-dark-card rounded-2xl shadow-2xl p-8 w-full max-w-md text-center";

  const modalStyle = !isMobile 
    ? { transform: `scale(${scale})`, animation: 'fade-in-scale 0.3s forwards ease-out' } 
    : {};

  return (
    <div 
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 transition-opacity duration-300"
      onClick={onClose}
    >
      <div 
        className={modalContainerClasses}
        style={modalStyle}
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-3xl z-10">&times;</button>
        <h2 className="text-xl font-bold uppercase text-light-text dark:text-dark-text mb-6">{title}</h2>
        {children}
      </div>
      <style>{`
        @keyframes fade-in-scale {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes slide-in-up {
            from { transform: translateY(100%); opacity: 0.8; }
            to { transform: translateY(0); opacity: 1; }
        }
        .modal-mobile-fullscreen {
            animation: slide-in-up 0.4s forwards cubic-bezier(0.25, 0.46, 0.45, 0.94);
            display: flex;
            flex-direction: column;
            justify-content: center;
        }
      `}</style>
    </div>
  );
};

export default Modal;