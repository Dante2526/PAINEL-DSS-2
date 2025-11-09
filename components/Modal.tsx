
import React, { ReactNode } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 transition-opacity duration-300 animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="bg-light-card dark:bg-dark-card rounded-2xl shadow-2xl p-8 w-11/12 max-w-md text-center relative animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-3xl z-10">&times;</button>
        <h2 className="text-xl font-bold uppercase text-light-text dark:text-dark-text mb-6">{title}</h2>
        {children}
      </div>
      <style>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scale-in {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-fade-in { animation: fade-in 0.2s forwards ease-out; }
        .animate-scale-in { animation: scale-in 0.2s forwards ease-out; }
      `}</style>
    </div>
  );
};

export default Modal;