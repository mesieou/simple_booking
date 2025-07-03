'use client';

import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/app/context/auth-context";
import { createClient } from "@/lib/database/supabase/client";

export default function OnboardingPage() {
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const [stripeStatus, setStripeStatus] = useState<'checking' | 'success' | 'refresh' | 'error' | null>(null);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isLoadingRole, setIsLoadingRole] = useState(true);

  // Fetch user role
  useEffect(() => {
    const fetchUserRole = async () => {
      if (!user) {
        setIsLoadingRole(false);
        return;
      }

      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from('users')
          .select('role')
          .eq('id', user.id)
          .single();

        if (error) {
          console.error('Error fetching user role:', error);
        } else {
          setUserRole(data.role);
          
          // If user is super_admin and no Stripe parameters, redirect to dashboard
          if (data.role === 'super_admin' && !searchParams.get('success') && !searchParams.get('refresh') && !searchParams.get('businessId')) {
            window.location.href = '/protected';
          }
        }
      } catch (error) {
        console.error('Error fetching user role:', error);
      } finally {
        setIsLoadingRole(false);
      }
    };

    fetchUserRole();
  }, [user, searchParams]);

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

  // Show loading while fetching user role
  if (isLoadingRole) {
    return (
      <div className="flex-1 flex flex-col w-full px-8 sm:max-w-md justify-center gap-6 text-center">
        <div className="text-blue-500 text-6xl mb-4 animate-spin">⏳</div>
        <h1 className="text-2xl font-bold">Loading...</h1>
        <p className="text-muted-foreground">
          Please wait while we load your account information.
        </p>
      </div>
    );
  }

  // Stripe Connect success case
  if (stripeStatus === 'success') {
    return (
      <div className="flex-1 flex flex-col w-full px-8 sm:max-w-md justify-center gap-6 text-center">
        <div className="text-green-600 text-6xl mb-4">✅</div>
        <h1 className="text-2xl font-bold text-green-600">Payment Setup Complete!</h1>
        <p className="text-muted-foreground">
          Your Stripe account has been successfully connected. You can now receive payments from customers.
        </p>
        {userRole === 'super_admin' && (
          <div className="bg-purple-600/20 border border-purple-500/30 rounded-lg p-4">
            <p className="text-purple-300 text-sm font-medium">🔑 Super Admin Access</p>
            <p className="text-purple-200 text-xs">You have access to all businesses and conversations.</p>
          </div>
        )}
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
        <h1 className="text-2xl font-bold text-purple-600">Complete Your Setup</h1>
        <p className="text-muted-foreground">
          Your payment setup needs to be completed. Please continue with the Stripe onboarding process.
        </p>
        {userRole === 'super_admin' && (
          <div className="bg-purple-600/20 border border-purple-500/30 rounded-lg p-4">
            <p className="text-purple-300 text-sm font-medium">🔑 Super Admin Access</p>
            <p className="text-purple-200 text-xs">You have access to all businesses and conversations.</p>
          </div>
        )}
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
        {userRole === 'super_admin' && (
          <div className="bg-purple-600/20 border border-purple-500/30 rounded-lg p-4">
            <p className="text-purple-300 text-sm font-medium">🔑 Super Admin Access</p>
            <p className="text-purple-200 text-xs">You have access to all businesses and conversations.</p>
          </div>
        )}
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
        {userRole === 'super_admin' && (
          <div className="bg-purple-600/20 border border-purple-500/30 rounded-lg p-4">
            <p className="text-purple-300 text-sm font-medium">🔑 Super Admin Access</p>
            <p className="text-purple-200 text-xs">You have access to all businesses and conversations.</p>
          </div>
        )}
      </div>
    );
  }

  // Default onboarding case (no Stripe parameters)
  return (
    <div className="flex-1 flex flex-col w-full px-8 sm:max-w-md justify-center gap-6 text-center">
      <h1 className="text-2xl font-bold">Welcome to Skedy!</h1>
      
      {userRole === 'super_admin' ? (
        <>
          <p className="text-muted-foreground">
            Welcome Super Admin! You have access to all businesses and conversations.
          </p>
          <div className="bg-purple-600/20 border border-purple-500/30 rounded-lg p-4">
            <p className="text-purple-300 text-sm font-medium">🔑 Super Admin Access</p>
            <p className="text-purple-200 text-xs">You can view and manage all conversations from all businesses.</p>
          </div>
          <div className="flex flex-col gap-4">
            <Button asChild>
              <Link href="/protected">Go to Dashboard</Link>
            </Button>
            <p className="text-sm text-muted-foreground">
              Access the global conversation management system.
            </p>
          </div>
        </>
      ) : (
        <>
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
        </>
      )}
    </div>
  );
} 