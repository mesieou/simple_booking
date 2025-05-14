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
import BookingSummary from '@/components/BookingSummary';

export default async function Componentes() {
    const mensajeExito = { success: "¡Datos guardados exitosamente!" };
    
    return (
    <>
      <BookingSummary
        origen="America's Food Basket of Atlantic Ave, Ocean Hill"
        origenDireccion="2220 Atlantic Ave, Ocean Hill, NY 11233"
        destino="Neir's Tavern, Woodhaven"
        destinoDireccion="87-48 78th St, Woodhaven, NY 11421"
        vehiculo="Pickup"
        luggers={2}
        precioBase={62.02}
        precioPorMinuto={1.94}
        arrivalWindow="10:00 - 12:00"
        moving="2 cajas grandes, 1 sofá"
      />
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