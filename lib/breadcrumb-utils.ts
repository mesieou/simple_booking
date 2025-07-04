export interface BreadcrumbItem {
  name: string;
  url: string;
  position: number;
}

export const generateBreadcrumbs = (pathname: string): BreadcrumbItem[] => {
  const baseUrl = process.env.VERCEL_URL 
    ? `https://${process.env.VERCEL_URL}` 
    : "http://localhost:3000";
  
  const segments = pathname.split('/').filter(Boolean);
  const breadcrumbs: BreadcrumbItem[] = [
    {
      name: "Inicio",
      url: baseUrl,
      position: 1
    }
  ];

  let currentPath = '';
  
  segments.forEach((segment, index) => {
    currentPath += `/${segment}`;
    
    // Mapeo de segmentos a nombres legibles
    const nameMap: Record<string, string> = {
      'about': 'Acerca de',
      'services': 'Servicios',
      'contact': 'Contacto',
      'blog': 'Blog',
      'faq': 'Preguntas Frecuentes',
      'privacy': 'Privacidad',
      'terms': 'Términos',
      'dashboard': 'Panel',
      'onboarding': 'Configuración',
      'sign-in': 'Iniciar Sesión',
      'sign-up': 'Registrarse',
      'forgot-password': 'Recuperar Contraseña',
      'booking': 'Reserva',
      'products': 'Productos',
      'locations': 'Ubicaciones',
      'datetime-picker': 'Fecha y Hora',
      'additional-info': 'Información Adicional'
    };

    const displayName = nameMap[segment] || segment.charAt(0).toUpperCase() + segment.slice(1);
    
    breadcrumbs.push({
      name: displayName,
      url: `${baseUrl}${currentPath}`,
      position: index + 2
    });
  });

  return breadcrumbs;
};

export const generateBreadcrumbStructuredData = (breadcrumbs: BreadcrumbItem[]) => {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": breadcrumbs.map(breadcrumb => ({
      "@type": "ListItem",
      "position": breadcrumb.position,
      "name": breadcrumb.name,
      "item": breadcrumb.url
    }))
  };
}; 