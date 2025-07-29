'use client';

import { useEffect } from 'react';

interface WhatsAppWidgetProps {
  businessId: string;
  baseUrl?: string;
}

const WhatsAppWidget: React.FC<WhatsAppWidgetProps> = ({ 
  businessId, 
  baseUrl 
}) => {
  useEffect(() => {
    // Determine the correct base URL based on environment
    const getBaseUrl = (): string => {
      // If baseUrl is explicitly provided, use it
      if (baseUrl) {
        return baseUrl;
      }
      
      // Check for environment variable first
      if (typeof window !== 'undefined' && (window as any).__NEXT_DATA__?.props?.siteUrl) {
        return (window as any).__NEXT_DATA__.props.siteUrl;
      }
      
      // Use environment variable if available
      if (process.env.NEXT_PUBLIC_SITE_URL) {
        return process.env.NEXT_PUBLIC_SITE_URL;
      }
      
      // Fallback based on environment
      if (process.env.NODE_ENV === 'production') {
        return 'https://skedy.io';
      }
      
      // Development fallback
      return typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
    };

    const widgetBaseUrl = getBaseUrl();
    
    // Create and append the widget iframe
    const iframe = document.createElement('iframe');
    iframe.src = `${widgetBaseUrl}/api/widget/embed?businessId=${businessId}&t=${Date.now()}`;
    iframe.style.position = 'fixed';
    iframe.style.bottom = '0';
    iframe.style.right = '0';
    iframe.style.width = '300px';
    iframe.style.height = '150px';
    iframe.style.border = 'none';
    iframe.style.zIndex = '9999';
    iframe.style.pointerEvents = 'none'; // Let clicks pass through to the content inside
    iframe.style.backgroundColor = 'transparent';
    
    // Allow pointer events on the iframe content
    iframe.onload = () => {
      iframe.style.pointerEvents = 'auto';
    };

    document.body.appendChild(iframe);

    // Cleanup on unmount
    return () => {
      if (iframe.parentNode) {
        iframe.parentNode.removeChild(iframe);
      }
    };
  }, [businessId, baseUrl]);

  return null; // This component doesn't render anything directly
};

export default WhatsAppWidget; 