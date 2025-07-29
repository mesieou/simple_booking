import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const businessId = searchParams.get('businessId');

  if (!businessId) {
    return new NextResponse('Business ID is required', { status: 400 });
  }

  // Get the current domain for API calls with proper environment detection
  const getBaseUrl = (): string => {
    // Check for environment variable first
    if (process.env.NEXT_PUBLIC_SITE_URL) {
      return process.env.NEXT_PUBLIC_SITE_URL;
    }
    
    // Fallback based on environment
    if (process.env.NODE_ENV === 'production') {
      return 'https://skedy.io';
    }
    
    // Development fallback - use request headers
    const protocol = request.headers.get('x-forwarded-proto') || 'http';
    const host = request.headers.get('host') || 'localhost:3000';
    return `${protocol}://${host}`;
  };

  const baseUrl = getBaseUrl();
  
  // Debug logging for production troubleshooting
  console.log('[Widget Embed] Base URL:', baseUrl);
  console.log('[Widget Embed] Environment:', process.env.NODE_ENV);
  console.log('[Widget Embed] NEXT_PUBLIC_SITE_URL:', process.env.NEXT_PUBLIC_SITE_URL);
  console.log('[Widget Embed] Business ID:', businessId);

  const widgetHtml = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        .whatsapp-widget {
            position: fixed;
            bottom: 30px;
            right: 30px;
            z-index: 9999;
            cursor: pointer;
            transition: all 0.3s ease;
            animation: bounce 2s infinite;
        }
        
        .whatsapp-widget:hover {
            transform: scale(1.1);
            animation: none;
        }
        
        .whatsapp-button {
            width: 60px;
            height: 60px;
            background: linear-gradient(135deg, #25d366, #20ba5a);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 12px rgba(37, 211, 102, 0.4);
            border: none;
            cursor: pointer;
            transition: all 0.3s ease;
        }
        
        .whatsapp-button:hover {
            box-shadow: 0 6px 20px rgba(37, 211, 102, 0.6);
            transform: translateY(-2px);
        }
        
        .whatsapp-icon {
            width: 32px;
            height: 32px;
            fill: white;
        }
        
        @keyframes bounce {
            0%, 20%, 50%, 80%, 100% {
                transform: translateY(0);
            }
            40% {
                transform: translateY(-10px);
            }
            60% {
                transform: translateY(-5px);
            }
        }
        
        .tooltip {
            position: absolute;
            bottom: 70px;
            right: 15px;
            background: #25d366;
            color: white;
            padding: 8px 12px;
            border-radius: 16px;
            font-size: 12px;
            white-space: nowrap;
            opacity: 0;
            transform: translateY(10px);
            transition: all 0.3s ease;
            pointer-events: none;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            box-shadow: 0 2px 8px rgba(37, 211, 102, 0.3);
            z-index: 10000;
            visibility: hidden;
            font-weight: 500;
            text-align: center;
            min-width: 90px;
        }
        
        .tooltip::after {
            content: '';
            position: absolute;
            top: 100%;
            right: 20px;
            border: 6px solid transparent;
            border-top-color: #25d366;
        }
        

    </style>
</head>
<body>
    <div class="whatsapp-widget" id="whatsapp-widget">
        <div class="tooltip" id="tooltip">💰 Get a quote</div>
        <button class="whatsapp-button" onclick="openWhatsApp()">
            <svg class="whatsapp-icon" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.488"/>
            </svg>
        </button>
    </div>

        <script>
        let businessData = null;
        let messageInterval = null;
        let isHovering = false;
        let isDismissed = false;
        
        // Rotating messages
        const messages = [
            '💰 Get a quote',
            '⚡ Instant quote',
            '📝 Free estimate',
            '💬 Price check?',
            '🏷️ How much?',
            '📊 Quote me!'
        ];
        let currentMessageIndex = 0;
        
        // Fetch business data
        async function fetchBusinessData() {
            try {
                const response = await fetch('${baseUrl}/api/widget/whatsapp?businessId=${businessId}&t=' + Date.now());
                const data = await response.json();
                
                if (data.success) {
                    businessData = data;
                }
            } catch (error) {
                console.error('Error fetching business data:', error);
            }
        }
        
        // Start rotating messages
        function startMessageRotation() {
            const tooltip = document.getElementById('tooltip');
            const widget = document.getElementById('whatsapp-widget');
            
            if (!tooltip || !widget) return;
            
            // Show tooltip after 3 seconds (only if not dismissed)
            setTimeout(() => {
                if (!isHovering && !isDismissed) {
                    tooltip.style.visibility = 'visible';
                    tooltip.style.opacity = '1';
                    tooltip.style.transform = 'translateY(0)';
                    
                    // Start rotating messages every 3 seconds - keeps going forever
                    messageInterval = setInterval(() => {
                        if (!isHovering && !isDismissed) {
                            currentMessageIndex = (currentMessageIndex + 1) % messages.length;
                            tooltip.innerHTML = messages[currentMessageIndex];
                        }
                    }, 3000);
                }
            }, 3000);
            
            // Handle hover events
            widget.addEventListener('mouseenter', () => {
                isHovering = true;
                if (messageInterval) {
                    clearInterval(messageInterval);
                    messageInterval = null;
                }
                tooltip.innerHTML = '💬 Quick chat?';
                tooltip.style.visibility = 'visible';
                tooltip.style.opacity = '1';
                tooltip.style.transform = 'translateY(0)';
            });
            
            widget.addEventListener('mouseleave', () => {
                isHovering = false;
                // Hide tooltip when not hovering and stop auto-rotation
                isDismissed = true;
                tooltip.style.visibility = 'hidden';
                tooltip.style.opacity = '0';
                tooltip.style.transform = 'translateY(10px)';
                if (messageInterval) {
                    clearInterval(messageInterval);
                    messageInterval = null;
                }
            });
        }
        
        // Open WhatsApp chat
        function openWhatsApp() {
            if (!businessData || !businessData.whatsappNumber) {
                console.error('Business WhatsApp number not available');
                return;
            }
            
            const phoneNumber = businessData.whatsappNumber.replace(/[^\\d]/g, '');
            const message = encodeURIComponent('Hi! I found you through your website. Could I get a quote for your services?');
            const whatsappUrl = \`https://wa.me/\${phoneNumber}?text=\${message}\`;
            
            window.open(whatsappUrl, '_blank');
        }
        
        // Initialize widget
        fetchBusinessData();
        startMessageRotation();
    </script>
</body>
</html>`;

  return new NextResponse(widgetHtml, {
    headers: {
      'Content-Type': 'text/html',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache, no-store, must-revalidate', // No caching during development
      'Pragma': 'no-cache',
      'Expires': '0',
    },
  });
}

// Enable CORS for widget embedding
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
} 