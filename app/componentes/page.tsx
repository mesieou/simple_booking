import DeployButton from '@/components/deploy-button'
import { EnvVarWarning } from "@/components/env-var-warning";
import { FormMessage } from '@/components/form-message'
import AuthButton from '@/components/header-auth'
import Header from '@/components/hero'
import NextLogo from '@/components/next-logo'
import { SubmitButton } from '@/components/submit-button'
import SupabaseLogo from '@/components/supabase-logo'
import { ThemeSwitcher } from '@/components/theme-switcher'
import JoinWaitlist from '@/components/waitlist-form'
import Precios from '@/components/precios';


export default async function Componentes() {
    const mensajeExito = { success: "¡Datos guardados exitosamente!" };
    
    return (
    <>
      <DeployButton/>
      <EnvVarWarning/>
      <FormMessage message={mensajeExito}/>
      <AuthButton/>
      <Header/>
      <NextLogo/>
      <SubmitButton/>
      <SupabaseLogo/>
      <ThemeSwitcher/>
      <JoinWaitlist/>
      <Precios/>
    </>
  );
}