import React from 'react';

type Tab = {
  label: string;
  value: string;
};

type TabsProps = {
  tabs: Tab[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
};

const Tabs: React.FC<TabsProps> = ({ tabs, value, onChange, className }) => (
  <div className={`flex flex-col ${className || ''}`}>
    <div role="tablist" className="flex gap-2 border-b">
      {tabs.map(tab => (
        <button
          key={tab.value}
          role="tab"
          aria-selected={value === tab.value}
          className={`px-4 py-2 font-medium border-b-2 transition-colors focus:outline-none ${value === tab.value ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-primary'}`}
          onClick={() => onChange(tab.value)}
          tabIndex={0}
        >
          {tab.label}
        </button>
      ))}
    </div>
  </div>
);

export default Tabs; 