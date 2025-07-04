"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { generateBreadcrumbs, generateBreadcrumbStructuredData } from "@/lib/breadcrumb-utils";

export const useBreadcrumb = () => {
  const pathname = usePathname();
  const breadcrumbs = generateBreadcrumbs(pathname);

  useEffect(() => {
    // Generar datos estructurados
    const structuredData = generateBreadcrumbStructuredData(breadcrumbs);
    
    // Remover breadcrumb anterior si existe
    const existingScript = document.querySelector('script[data-breadcrumb="true"]');
    if (existingScript) {
      existingScript.remove();
    }

    // Crear nuevo script con datos estructurados
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.setAttribute('data-breadcrumb', 'true');
    script.textContent = JSON.stringify(structuredData);
    document.head.appendChild(script);

    // Cleanup al desmontar
    return () => {
      const scriptToRemove = document.querySelector('script[data-breadcrumb="true"]');
      if (scriptToRemove) {
        scriptToRemove.remove();
      }
    };
  }, [pathname, breadcrumbs]);

  return {
    breadcrumbs,
    currentPage: breadcrumbs[breadcrumbs.length - 1]?.name || "Inicio",
    hasBreadcrumbs: breadcrumbs.length > 1
  };
}; 