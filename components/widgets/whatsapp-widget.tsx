'use client';

import { useEffect } from 'react';

interface WhatsAppWidgetProps {
  businessId: string;
  baseUrl?: string;
}

const WhatsAppWidget: React.FC<WhatsAppWidgetProps> = ({ 
  businessId, 
  baseUrl = typeof window !== 'undefined' ? window.location.origin : '' 
}) => {
  useEffect(() => {
    // Create and append the widget iframe
    const iframe = document.createElement('iframe');
    iframe.src = `${baseUrl}/api/widget/embed?businessId=${businessId}&t=${Date.now()}`;
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