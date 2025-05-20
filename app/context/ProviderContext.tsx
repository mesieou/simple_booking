'use client';

import { createContext, useContext, useState, ReactNode } from 'react';

interface ProviderContextType {
  providerId: string | null;
  setProviderId: (id: string) => void;
}

const ProviderContext = createContext<ProviderContextType | undefined>(undefined);

export function ProviderContextProvider({ children }: { children: ReactNode }) {
  const [providerId, setProviderId] = useState<string | null>(null);

  return (
    <ProviderContext.Provider value={{ providerId, setProviderId }}>
      {children}
    </ProviderContext.Provider>
  );
}

export function useProvider() {
  const context = useContext(ProviderContext);
  if (context === undefined) {
    throw new Error('useProvider debe ser usado dentro de un ProviderContextProvider');
  }
  return context;
} 