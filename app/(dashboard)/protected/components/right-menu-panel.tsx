'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/app/context/auth-context';
import { createClient } from '@/lib/database/supabase/client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { LogOut, User, X, Home, Briefcase, Info, Mail } from 'lucide-react';

export type RightMenuPanelProps = {
  onClose: () => void;
  showCloseButton?: boolean;
};

export function RightMenuPanel({ onClose, showCloseButton = true }: RightMenuPanelProps) {
  const { user } = useAuth();
  const router = useRouter();

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/sign-in');
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
      </nav>

      <div className="mt-auto">
        <div className="border-t border-white/10 pt-6">
          <div className="flex items-center gap-4 mb-4 p-2 rounded-lg">
            <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center">
              <User className="h-6 w-6 text-gray-400" />
            </div>
            <p className="text-sm font-medium truncate">
              {user?.email ?? 'Loading...'}
            </p>
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