"use client";

import { createClient } from "@/lib/database/supabase/client";
import { useAuth } from "@/app/context/auth-context";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@components/ui/button";
import { Input } from "@components/ui/input";
import { Label } from "@components/ui/label";
import { useToast } from "@/lib/rename-categorise-better/utils/use-toast";
import Link from "next/link";
import { getSignUpRedirectUrl } from "@/lib/config/auth-config";

export default function SignUp() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [loading, setLoading] = useState(false);
  const { refreshSession } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  
  // Get the return URL from query parameters
  const returnUrl = searchParams.get('returnUrl');

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (password !== confirmPassword) {
      toast({
        title: "Validation error",
        description: "Passwords do not match",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    try {
      const supabase = createClient();
      
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            firstName,
            lastName,
            role: 'customer',
          },
          emailRedirectTo: getSignUpRedirectUrl(returnUrl || undefined),
        },
      });

      if (error) {
        throw error;
      }

      // Refresh the session to update the auth context
      await refreshSession();
      
      // Show success message
      toast({
        title: "Sign up successful",
        description: "Please check your email to complete the registration",
      });

      // The middleware will handle the redirect
    } catch (error: any) {
      toast({
        title: "Sign up error",
        description: error.message || "An error occurred while creating the account",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col w-full px-8 sm:max-w-md justify-center gap-2">
      <form
        className={`animate-in flex-1 flex flex-col w-full justify-center gap-6 text-foreground transition-opacity duration-200 ${
          loading ? "opacity-70" : "opacity-100"
        }`}
        onSubmit={handleSignUp}
      >
        <div className="flex flex-col gap-2 text-center">
          <h1 className="text-2xl font-bold">Sign Up</h1>
          <p className="text-muted-foreground">
            Enter your details to create your account
          </p>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="firstName">First Name</Label>
            <Input
              id="firstName"
              placeholder="John"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
              disabled={loading}
              autoComplete="given-name"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="lastName">Last Name</Label>
            <Input
              id="lastName"
              placeholder="Doe"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
              disabled={loading}
              autoComplete="family-name"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
              className="bg-background autofill:bg-background"
              autoComplete="email"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
              className="bg-background autofill:bg-background"
              autoComplete="new-password"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="confirmPassword">Confirm password</Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              disabled={loading}
              className="bg-background autofill:bg-background"
              autoComplete="new-password"
            />
          </div>
        </div>

        <Button type="submit" disabled={loading} className="relative">
          {loading && (
            <div className="absolute left-4 flex items-center">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            </div>
          )}
          <span className={loading ? "ml-6" : ""}>
            {loading ? "Creating account..." : "Sign Up"}
          </span>
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link 
            href={returnUrl ? `/sign-in?returnUrl=${encodeURIComponent(returnUrl)}` : "/sign-in"}
            className={`text-primary hover:underline transition-opacity ${
              loading ? "pointer-events-none opacity-50" : ""
            }`}
          >
            Sign In
          </Link>
        </p>
      </form>
      
      {/* Loading overlay */}
      {loading && (
        <div className="fixed inset-0 bg-black/10 backdrop-blur-sm z-40 flex items-center justify-center">
          <div className="bg-background/80 rounded-lg p-6 shadow-lg border flex items-center gap-3">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            <p className="text-foreground">Creating your account...</p>
          </div>
        </div>
      )}
    </div>
  );
}
