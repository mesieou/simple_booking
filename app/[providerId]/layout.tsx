import { FormProvider } from '@/lib/rename-categorise-better/utils/FormContext';

export default function ProviderLayout({ children }: { children: React.ReactNode }) {
  return (
    <FormProvider>
      {children}
    </FormProvider>
  );
} 