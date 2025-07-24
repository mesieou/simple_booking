'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/app/context/auth-context';
import { createClient } from '@/lib/database/supabase/client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { LogOut, User, X, Home, Briefcase, Info, Mail, CreditCard } from 'lucide-react';

export type RightMenuPanelProps = {
  onClose: () => void;
  showCloseButton?: boolean;
};

export function RightMenuPanel({ onClose, showCloseButton = true }: RightMenuPanelProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [businessId, setBusinessId] = useState<string | null>(null);

  useEffect(() => {
    const fetchUserData = async () => {
      if (!user) return;

      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from('users')
          .select('role, businessId')
          .eq('id', user.id)
          .single();

        if (error) {
          console.error('Error fetching user data:', error);
        } else {
          setUserRole(data.role);
          setBusinessId(data.businessId);
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
      }
    };

    fetchUserData();
  }, [user]);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/sign-in');
  };

  const handlePaymentSetup = async () => {
    if (!businessId) return;

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
        throw new Error(data.error || 'Failed to create onboarding link');
      }
    } catch (error) {
      console.error('Error setting up payments:', error);
      alert('Failed to setup payments. Please try again later.');
    }
  };

  const navLinks = [
    { href: '/', label: 'Home', icon: Home },
    { href: '/services', label: 'Services', icon: Briefcase },
    { href: '/about', label: 'About', icon: Info },
    { href: '/contact', label: 'Contact', icon: Mail },
  ];

  return (
    <div className="h-full flex flex-col bg-slate-900/95 text-white p-6">
      <div className="flex justify-between items-center mb-10">
        <h2 className="text-xl font-semibold">Menu</h2>
        {showCloseButton && (
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-6 w-6" />
          </Button>
        )}
      </div>

      <nav className="flex flex-col space-y-2">
        {navLinks.map((link) => (
          <Link key={link.href} href={link.href} passHref>
            <Button
              variant="ghost"
              className="w-full justify-start text-lg p-6"
              onClick={onClose}
            >
              <link.icon className="mr-4 h-5 w-5 text-gray-400" />
              {link.label}
            </Button>
          </Link>
        ))}
        
        {/* Business Settings Section */}
        {businessId && (
          <>
            <div className="border-t border-white/10 my-4"></div>
            <div className="mb-2">
              <p className="text-xs font-semibold uppercase text-gray-400 tracking-wider px-6">Business Settings</p>
            </div>
            <Button
              variant="ghost"
              className="w-full justify-start text-lg p-6"
              onClick={handlePaymentSetup}
            >
              <CreditCard className="mr-4 h-5 w-5 text-gray-400" />
              Payment Setup
            </Button>
          </>
        )}
      </nav>

      <div className="mt-auto">
        <div className="border-t border-white/10 pt-6">
          <div className={`flex items-center gap-4 mb-4 p-2 rounded-lg ${
            userRole === 'super_admin' ? 'bg-purple-600/20 border border-purple-500/30' : ''
          }`}>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
              userRole === 'super_admin' ? 'bg-purple-600' : 'bg-slate-700'
            }`}>
              <User className={`h-6 w-6 ${
                userRole === 'super_admin' ? 'text-purple-200' : 'text-gray-400'
              }`} />
            </div>
            <div className="flex flex-col min-w-0">
              <p className="text-sm font-medium truncate">
                {user?.email ?? 'Loading...'}
              </p>
              {userRole && (
                <p className={`text-xs truncate capitalize ${
                  userRole === 'super_admin' ? 'text-purple-300' : 'text-gray-400'
                }`}>
                  {userRole === 'super_admin' ? '🔑 Super Admin' : userRole.replace('_', ' ')}
                </p>
              )}
            </div>
          </div>
          <Button
            variant="secondary"
            className="w-full bg-red-600/20 hover:bg-red-600/40 text-red-300 border border-red-500/20"
            onClick={handleSignOut}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Log Out
          </Button>
        </div>
      </div>
    </div>
  );
} 