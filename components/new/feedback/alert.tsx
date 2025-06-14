import React from 'react';

type AlertProps = {
  children: React.ReactNode;
  type?: 'info' | 'success' | 'warning' | 'error';
  className?: string;
};

const typeStyles = {
  info: 'bg-blue-100 text-blue-800 border-blue-300',
  success: 'bg-green-100 text-green-800 border-green-300',
  warning: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  error: 'bg-red-100 text-red-800 border-red-300',
};

const Alert: React.FC<AlertProps> = ({ children, type = 'info', className }) => (
  <div
    role="alert"
    className={`border-l-4 p-4 rounded-md ${typeStyles[type]} ${className || ''}`}
  >
    {children}
  </div>
);

export default Alert; 