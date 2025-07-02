"use client";

import { createClient } from '@/lib/database/supabase/client';
import { type Session } from '@supabase/supabase-js';
import { useSearchParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/lib/rename-categorise-better/utils/use-toast';
import Link from 'next/link';

export default function InvitePage() {
  const supabase = createClient();
  const searchParams = useSearchParams();
  const router = useRouter();
  const businessId = searchParams.get('businessId');
  const { toast } = useToast();

  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [isAlreadyMember, setIsAlreadyMember] = useState(false);

  const [businessName, setBusinessName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState('invite'); // 'invite', 'signup', 'login'

  useEffect(() => {
    const getInitialData = async () => {
      setSessionLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      // If user exists, get the full session for compatibility
      if (user) {
        const { data: { session } } = await supabase.auth.getSession();
        setSession(session);
      } else {
        setSession(null);
      }

      if (businessId) {
        // Check if business exists
        const { data: businessData, error } = await supabase
          .from('businesses')
          .select('name')
          .eq('id', businessId)
          .single();
        
        if (businessData) {
          setBusinessName(businessData.name);
        }
        
        if (error && !businessData) {
          toast({ title: "Invalid Invitation", description: "This invitation link is invalid or has expired.", variant: "destructive" });
        }

        // If user is logged in, check if they're already part of this business
        if (user) {
          const { data: userProfile, error: profileError } = await supabase
            .from('users')
            .select('businessId')
            .eq('id', user.id)
            .single();

          if (!profileError && userProfile?.businessId === businessId) {
            setIsAlreadyMember(true);
          }
        }
      }
      setSessionLoading(false);
    };
    getInitialData();
  }, [businessId, supabase, toast]);

  const handleAcceptInvite = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke('link-user-to-business', {
      body: { businessId },
    });
    if (error) {
        toast({ title: "Failed to join", description: error.message, variant: "destructive" });
    } else {
        toast({ title: "Success!", description: data.message });
        router.push('/protected'); // Use Next.js router instead of hard redirect
    }
    setLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
        toast({ title: "Passwords do not match", variant: "destructive" });
        return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { 
          data: { firstName, lastName, businessId, role: 'provider' },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
    });
    if (error) {
        toast({ title: "Sign up failed", description: error.message, variant: "destructive" });
    } else {
        toast({ title: "Success!", description: 'Please check your email to confirm your account.' });
        setView('invite');
    }
    setLoading(false);
  };

  const handleLoginAndLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
        toast({ title: "Sign in failed", description: signInError.message, variant: "destructive" });
        setLoading(false);
        return;
    }
    const { data: linkData, error: linkError } = await supabase.functions.invoke(
      'link-user-to-business',
      { body: { businessId } }
    );
    if (linkError) {
        toast({ title: "Failed to join", description: linkError.message, variant: "destructive" });
    } else {
        toast({ title: "Success!", description: linkData.message });
        router.push('/protected'); // Use Next.js router instead of hard redirect
    }
    setLoading(false);
  };

  if (sessionLoading) {
    return <div className="flex-1 flex flex-col w-full px-8 sm:max-w-md justify-center gap-2 animate-pulse"><p className='text-center'>Loading...</p></div>;
  }

  // Handle case where user is already a member of this business
  if (session && isAlreadyMember) {
    return (
      <div className="flex-1 flex flex-col w-full px-8 sm:max-w-md justify-center gap-6 text-center">
        <h1 className="text-2xl font-bold">Already a Member!</h1>
        <p className="text-muted-foreground">
          You are already a member of <span className='font-bold text-foreground'>{businessName}</span>.
        </p>
        <p className="text-sm text-muted-foreground">Logged in as {session.user.email}</p>
        <Button onClick={() => router.push('/protected')}>
          Go to Dashboard
        </Button>
      </div>
    );
  }

  if (session) {
    return (
      <div className="flex-1 flex flex-col w-full px-8 sm:max-w-md justify-center gap-6 text-center">
         <h1 className="text-2xl font-bold">Accept Invitation</h1>
         {businessName ? (
            <p className="text-muted-foreground">You have been invited to join <span className='font-bold text-foreground'>{businessName}</span>.</p>
         ) : (
            <p className="text-muted-foreground">Invalid invitation link.</p>
         )}
         <p className="text-sm text-muted-foreground">You are logged in as {session.user.email}</p>
         <Button onClick={handleAcceptInvite} disabled={loading || !businessName}>
           {loading ? 'Joining...' : 'Accept & Continue'}
         </Button>
      </div>
    );
  }

  if (view === 'invite') {
    return (
      <div className="flex-1 flex flex-col w-full px-8 sm:max-w-md justify-center gap-6 text-center">
        <h1 className="text-2xl font-bold">You've been invited!</h1>
        {businessName ? (
            <p className="text-muted-foreground">To join <span className='font-bold text-foreground'>{businessName}</span>, please sign up or log in.</p>
        ) : (
            <p className="text-muted-foreground">This invitation link seems to be invalid.</p>
        )}
        <div className='flex flex-col gap-4'>
            <Button onClick={() => setView('signup')} disabled={!businessName}>Create a new account</Button>
            <Button onClick={() => setView('login')} variant="outline" disabled={!businessName}>Log in with an existing account</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col w-full px-8 sm:max-w-md justify-center gap-2">
       <Link href="/invite" onClick={(e) => { e.preventDefault(); setView('invite'); }} className="absolute top-8 left-8 text-sm text-muted-foreground hover:text-foreground">
        ← Back
      </Link>
      <form
        className="animate-in flex-1 flex flex-col w-full justify-center gap-6 text-foreground"
        onSubmit={view === 'signup' ? handleSignUp : handleLoginAndLink}
      >
        <div className="flex flex-col gap-2 text-center">
          <h1 className="text-2xl font-bold">{view === 'signup' ? 'Create Your Account' : 'Log In'}</h1>
          <p className="text-muted-foreground">
            To join <span className='font-bold text-foreground'>{businessName}</span>
          </p>
        </div>
        <div className="flex flex-col gap-4">
            {view === 'signup' && (
                <>
                    <div className="flex flex-col gap-2">
                        <Label htmlFor="firstName">First Name</Label>
                        <Input id="firstName" placeholder="John" value={firstName} onChange={(e) => setFirstName(e.target.value)} required autoComplete="given-name" />
                    </div>
                     <div className="flex flex-col gap-2">
                        <Label htmlFor="lastName">Last Name</Label>
                        <Input id="lastName" placeholder="Doe" value={lastName} onChange={(e) => setLastName(e.target.value)} required autoComplete="family-name" />
                    </div>
                </>
            )}
            <div className="flex flex-col gap-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
            </div>
            <div className="flex flex-col gap-2">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete={view === 'signup' ? 'new-password' : 'current-password'} />
            </div>
            {view === 'signup' && (
                 <div className="flex flex-col gap-2">
                    <Label htmlFor="confirmPassword">Confirm Password</Label>
                    <Input id="confirmPassword" type="password" placeholder="••••••••" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required autoComplete="new-password" />
                </div>
            )}
        </div>
        <Button type="submit" disabled={loading}>
          {loading ? 'Processing...' : (view === 'signup' ? 'Sign Up & Join' : 'Log In & Join')}
        </Button>
      </form>
    </div>
  );
} 