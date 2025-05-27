import { FormProvider } from '@/utils/FormContext';

export default function ProviderLayout({ children }: { children: React.ReactNode }) {
  return (
    <FormProvider>
      {children}
    </FormProvider>
  );
} 