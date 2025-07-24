'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AlertTriangle, CreditCard, CheckCircle, X } from 'lucide-react';
import { useSearchParams } from 'next/navigation';

interface PaymentSetupStatusProps {
  businessId?: string;
}

export function PaymentSetupStatus({ businessId }: PaymentSetupStatusProps) {
  const [showBanner, setShowBanner] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<'checking' | 'active' | 'pending' | 'disabled' | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const searchParams = useSearchParams();

  useEffect(() => {
    // Check if user was redirected here after payment setup error
    const paymentSetupError = searchParams.get('payment_setup_error');
    const businessIdFromUrl = searchParams.get('businessId');
    
    if (paymentSetupError === 'true' || businessId || businessIdFromUrl) {
      setShowBanner(true);
      checkPaymentStatus(businessId || businessIdFromUrl);
    }

    // Also check local storage for business ID from failed onboarding
    const onboardingBusinessId = localStorage.getItem('onboarding_business_id');
    if (onboardingBusinessId && !isDismissed) {
      setShowBanner(true);
      checkPaymentStatus(onboardingBusinessId);
    }
  }, [businessId, searchParams, isDismissed]);

  const checkPaymentStatus = async (id?: string | null) => {
    if (!id) return;
    
    setPaymentStatus('checking');
    try {
      const response = await fetch(`/api/onboarding/stripe-connect?businessId=${id}`);
      const data = await response.json();
      
      if (data.success) {
        setPaymentStatus(data.status);
        if (data.status === 'active') {
          // If payments are active, hide the banner after a short delay
          setTimeout(() => setShowBanner(false), 3000);
        }
      } else {
        setPaymentStatus('pending');
      }
    } catch (error) {
      console.error('Error checking payment status:', error);
      setPaymentStatus('pending');
    }
  };

  const handleSetupPayments = async () => {
    const id = businessId || searchParams.get('businessId') || localStorage.getItem('onboarding_business_id');
    if (!id) return;

    setIsLoading(true);
    try {
      const response = await fetch('/api/onboarding/stripe-connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          businessId: id, 
          action: 'create_onboarding_link' 
        }),
      });
      
      const data = await response.json();
      if (data.success && data.onboardingUrl) {
        window.location.href = data.onboardingUrl;
      } else {
        throw new Error(data.error || 'Failed to create onboarding link');
      }
    } catch (error) {
      console.error('Error setting up payments:', error);
      alert('Failed to setup payments. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    setShowBanner(false);
    // Clear the onboarding business ID from localStorage
    localStorage.removeItem('onboarding_business_id');
    
    // Clear URL parameters
    const url = new URL(window.location.href);
    url.searchParams.delete('payment_setup_error');
    url.searchParams.delete('businessId');
    window.history.replaceState({}, '', url.toString());
  };

  if (!showBanner || isDismissed) {
    return null;
  }

  const getStatusConfig = () => {
    switch (paymentStatus) {
      case 'active':
        return {
          icon: CheckCircle,
          color: 'text-green-400',
          bgColor: 'bg-green-900/20',
          borderColor: 'border-green-500/30',
          title: 'Payment Setup Complete!',
          description: 'Your Stripe account is active and ready to accept payments.',
          showButton: false,
        };
      case 'pending':
        return {
          icon: AlertTriangle,
          color: 'text-yellow-400',
          bgColor: 'bg-yellow-900/20',
          borderColor: 'border-yellow-500/30',
          title: 'Complete Payment Setup',
          description: 'Your business is ready, but payment processing needs to be completed.',
          showButton: true,
        };
      case 'disabled':
        return {
          icon: AlertTriangle,
          color: 'text-red-400',
          bgColor: 'bg-red-900/20',
          borderColor: 'border-red-500/30',
          title: 'Payment Setup Required',
          description: 'Payment processing is disabled. Complete setup to accept online payments.',
          showButton: true,
        };
      case 'checking':
        return {
          icon: CreditCard,
          color: 'text-blue-400',
          bgColor: 'bg-blue-900/20',
          borderColor: 'border-blue-500/30',
          title: 'Checking Payment Status...',
          description: 'Please wait while we verify your payment setup.',
          showButton: false,
        };
      default:
        return {
          icon: CreditCard,
          color: 'text-gray-400',
          bgColor: 'bg-gray-900/20',
          borderColor: 'border-gray-500/30',
          title: 'Payment Setup Available',
          description: 'Set up payment processing to accept online payments from customers.',
          showButton: true,
        };
    }
  };

  const config = getStatusConfig();
  const StatusIcon = config.icon;

  return (
    <Card className={`${config.bgColor} ${config.borderColor} border backdrop-blur-sm`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <StatusIcon className={`h-6 w-6 ${config.color} flex-shrink-0 mt-0.5`} />
          <div className="flex-1 min-w-0">
            <h3 className={`font-semibold ${config.color} text-sm`}>{config.title}</h3>
            <p className="text-gray-300 text-xs mt-1">{config.description}</p>
            
            {config.showButton && (
              <div className="flex gap-2 mt-3">
                <Button
                  onClick={handleSetupPayments}
                  disabled={isLoading}
                  size="sm"
                  className="bg-primary hover:bg-primary/90"
                >
                  {isLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-2"></div>
                      Setting up...
                    </>
                  ) : (
                    'Complete Setup'
                  )}
                </Button>
                <Button
                  onClick={handleDismiss}
                  variant="ghost"
                  size="sm"
                  className="text-gray-400 hover:text-gray-300"
                >
                  Maybe Later
                </Button>
              </div>
            )}
          </div>
          
          <Button
            onClick={handleDismiss}
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-gray-400 hover:text-gray-300 flex-shrink-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
} 