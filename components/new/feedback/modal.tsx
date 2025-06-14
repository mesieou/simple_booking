import React from 'react';

type ModalProps = {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  className?: string;
};

const Modal: React.FC<ModalProps> = ({ open, onClose, children, title, className }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className={`bg-white rounded-lg shadow-lg max-w-lg w-full p-6 relative ${className || ''}`} role="dialog" aria-modal="true">
        <button
          onClick={onClose}
          className="absolute top-2 right-2 text-gray-500 hover:text-gray-700 focus:outline-none"
          aria-label="Cerrar"
        >
          <span aria-hidden="true">&times;</span>
        </button>
        {title && <h2 className="text-lg font-bold mb-4">{title}</h2>}
        {children}
      </div>
    </div>
  );
};

export default Modal; 