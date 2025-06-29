import { FormProvider } from '@/lib/rename-categorise-better/utils/FormContext';
import { ProviderContextProvider } from '../context/ProviderContext';

export default function ProviderLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProviderContextProvider>
      <FormProvider>
        {children}
      </FormProvider>
    </ProviderContextProvider>
  );
} 