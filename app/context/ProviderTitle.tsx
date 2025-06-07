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

  // If we receive a providerId by prop and it is different from the context, save it in the context
  useEffect(() => {
    if (propProviderId && propProviderId !== providerId) {
      setProviderId(propProviderId);
    }
    // We only want this to run when propProviderId changes
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

  if (!effectiveProviderId) return "No provider selected";
  if (!providerName) return "Provider name not found";

  return (
    <h1 className="text-2xl font-bold mb-4">
      Book with: {providerName}
    </h1>
  );
} 