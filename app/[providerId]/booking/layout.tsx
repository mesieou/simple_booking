import { FormProvider } from '@/utils/FormContext';

export default function BookingLayout({ children }: { children: React.ReactNode }) {
  return (
    <FormProvider>
      {children}
    </FormProvider>
  );
} 