'use client';

import { useProvider } from './ProviderContext';
import { useEffect, useState } from 'react';

interface ProviderTitleProps {
  providerId?: string;
}

export default function ProviderTitle({ providerId: propProviderId }: ProviderTitleProps) {
  const { providerId, setProviderId } = useProvider();
  const effectiveProviderId = propProviderId || providerId;
  const [providerName, setProviderName] = useState<string>('');

  // Si recibimos un providerId por prop y es diferente al del contexto, lo guardamos en el contexto
  useEffect(() => {
    if (propProviderId && propProviderId !== providerId) {
      setProviderId(propProviderId);
    }
    // Solo queremos que esto se ejecute cuando cambie el propProviderId
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propProviderId]);

  useEffect(() => {
    async function fetchProviderName() {
      if (effectiveProviderId) {
        try {
          const response = await fetch(`/api/provider/${effectiveProviderId}`);
          const data = await response.json();
          if (data.error) {
            setProviderName('');
            return;
          }
          setProviderName(`${data.firstName} ${data.lastName}`);
        } catch (error) {
          setProviderName('');
        }
      }
    }
    fetchProviderName();
  }, [effectiveProviderId]);

  if (!effectiveProviderId) return "No hay proveedor seleccionado";
  if (!providerName) return "No se encontró el nombre del proveedor";

  return (
    <h1 className="text-2xl font-bold mb-4">
      Reserva con: {providerName}
    </h1>
  );
} 