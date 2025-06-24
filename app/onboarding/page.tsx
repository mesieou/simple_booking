'use client';

import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function OnboardingPage() {
  const searchParams = useSearchParams();
  const [stripeStatus, setStripeStatus] = useState<'checking' | 'success' | 'refresh' | 'error' | null>(null);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const success = searchParams.get('success');
    const refresh = searchParams.get('refresh');
    const businessIdParam = searchParams.get('businessId');

    if (businessIdParam) {
      setBusinessId(businessIdParam);
    }

    if (success === 'true') {
      setStripeStatus('success');
      // Optionally check the account status
      checkStripeAccountStatus(businessIdParam);
    } else if (refresh === 'true') {
      setStripeStatus('refresh');
    }
  }, [searchParams]);

  const checkStripeAccountStatus = async (businessId: string | null) => {
    if (!businessId) return;
    
    try {
      const response = await fetch(`/api/onboarding/stripe-connect?businessId=${businessId}`);
      const data = await response.json();
      
      if (data.success && data.status === 'active') {
        setStripeStatus('success');
      } else {
        setStripeStatus('checking');
      }
    } catch (error) {
      console.error('Error checking Stripe status:', error);
      setStripeStatus('error');
    }
  };

  const handleCreateOnboardingLink = async () => {
    if (!businessId) return;
    
    setIsLoading(true);
    
    try {
      const response = await fetch('/api/onboarding/stripe-connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          businessId, 
          action: 'create_onboarding_link' 
        }),
      });
      
      const data = await response.json();
      if (data.success && data.onboardingUrl) {
        window.location.href = data.onboardingUrl;
      } else {
        setStripeStatus('error');
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Error creating onboarding link:', error);
      setStripeStatus('error');
      setIsLoading(false);
    }
  };

  // Stripe Connect success case
  if (stripeStatus === 'success') {
    return (
      <div className="flex-1 flex flex-col w-full px-8 sm:max-w-md justify-center gap-6 text-center">
        <div className="text-green-600 text-6xl mb-4">✅</div>
        <h1 className="text-2xl font-bold text-green-600">Payment Setup Complete!</h1>
        <p className="text-muted-foreground">
          Your Stripe account has been successfully connected. You can now receive payments from customers.
        </p>
        <div className="flex flex-col gap-4">
          <Button asChild>
            <Link href="/protected">Go to Dashboard</Link>
          </Button>
          <p className="text-sm text-muted-foreground">
            Your business is now ready to accept bookings and payments.
          </p>
        </div>
      </div>
    );
  }

  // Stripe Connect refresh case (user needs to complete onboarding)
  if (stripeStatus === 'refresh') {
    return (
      <div className="flex-1 flex flex-col w-full px-8 sm:max-w-md justify-center gap-6 text-center">
        <div className="text-orange-500 text-6xl mb-4">⚠️</div>
        <h1 className="text-2xl font-bold text-orange-600">Complete Your Setup</h1>
        <p className="text-muted-foreground">
          Your payment setup needs to be completed. Please continue with the Stripe onboarding process.
        </p>
        <div className="flex flex-col gap-4">
          <Button 
            onClick={handleCreateOnboardingLink} 
            disabled={!businessId || isLoading}
            className="relative"
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Redirecting...
              </>
            ) : (
              'Continue Setup'
            )}
          </Button>
          <p className="text-sm text-muted-foreground">
            This will redirect you to Stripe to complete your account setup.
          </p>
        </div>
      </div>
    );
  }

  // Stripe Connect error case
  if (stripeStatus === 'error') {
    return (
      <div className="flex-1 flex flex-col w-full px-8 sm:max-w-md justify-center gap-6 text-center">
        <div className="text-red-500 text-6xl mb-4">❌</div>
        <h1 className="text-2xl font-bold text-red-600">Setup Error</h1>
        <p className="text-muted-foreground">
          There was an error with your payment setup. Please try again or contact support.
        </p>
        <div className="flex flex-col gap-4">
          <Button 
            onClick={handleCreateOnboardingLink} 
            disabled={!businessId || isLoading}
            className="relative"
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Redirecting...
              </>
            ) : (
              'Try Again'
            )}
          </Button>
          <Button variant="outline" asChild>
            <Link href="/protected">Go to Dashboard</Link>
          </Button>
        </div>
      </div>
    );
  }

  // Stripe Connect checking status
  if (stripeStatus === 'checking') {
    return (
      <div className="flex-1 flex flex-col w-full px-8 sm:max-w-md justify-center gap-6 text-center">
        <div className="text-blue-500 text-6xl mb-4 animate-spin">⏳</div>
        <h1 className="text-2xl font-bold">Redirecting to Stripe...</h1>
        <p className="text-muted-foreground">
          Please wait while we redirect you to complete your payment setup.
        </p>
      </div>
    );
  }

  // Default onboarding case (no Stripe parameters)
  return (
    <div className="flex-1 flex flex-col w-full px-8 sm:max-w-md justify-center gap-6 text-center">
      <h1 className="text-2xl font-bold">Welcome to Skedy!</h1>
      <p className="text-muted-foreground">
        Your account is ready. To continue, you need to be part of a business.
      </p>
      
      <div className="flex flex-col gap-4">
        <Button asChild>
          <Link href="/onboarding/create-business">Create a new Business</Link>
        </Button>
        <p className="text-sm text-muted-foreground">
          Or, if you have an invitation link, please use it to join an existing business.
        </p>
      </div>
    </div>
  );
} 