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
import Direction from '@/components/direction';
import Distance from '@/components/distance';
import Calendar from '@/components/calendar';
import Menu from '@/components/menu';
import LanguageSwitcher from '@/components/language-switcher';

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
      <Direction texto="Pick up from"/>
      <Direction texto="Move to"/>
      <Distance/>
      <Calendar/>
      <Menu/>
      <LanguageSwitcher/>
    </>
  );
}