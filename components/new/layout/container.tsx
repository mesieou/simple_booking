import React from 'react';

type ContainerProps = {
  children: React.ReactNode;
  className?: string;
};

const Container: React.FC<ContainerProps> = ({ children, className }) => (
  <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full ${className || ''}`}>
    {children}
  </div>
);

export default Container; 