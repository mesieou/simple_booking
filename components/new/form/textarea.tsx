import React from 'react';

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string;
  id?: string;
  className?: string;
};

const Textarea: React.FC<TextareaProps> = ({ label, id, className, ...props }) => (
  <div className={`flex flex-col gap-1 ${className || ''}`}>
    {label && (
      <label htmlFor={id} className="text-sm font-medium text-gray-700">
        {label}
      </label>
    )}
    <textarea
      id={id}
      className="border rounded-md px-3 py-2 bg-white text-black focus:outline-none focus:ring-2 focus:ring-primary min-h-[80px]"
      {...props}
    />
  </div>
);

export default Textarea; 