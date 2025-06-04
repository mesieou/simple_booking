"use client";

import { hasEnvVars } from "@/lib/supabase/check-env-vars";
import Link from "next/link";
import { Badge } from "@components/ui/badge";
import { Button } from "@components/ui/button";
import { useAuth } from "@/app/context/auth-context";

export default function HeaderAuth() {
  const { user, loading, signOut } = useAuth();

  if (!hasEnvVars) {
    return (
      <Badge variant="destructive" className="ml-auto">
        Missing configuration
      </Badge>
    );
  }

  if (loading) {
    return <div className="ml-auto">Loading...</div>;
  }

  if (!user) {
    return (
      <div className="flex items-center gap-2 ml-auto">
        <Button asChild variant="outline" size="sm">
          <Link href="/sign-in">Sign in</Link>
        </Button>
        <Button asChild variant="default" size="sm">
          <Link href="/sign-up">Sign up</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4 ml-auto">
      <span className="text-sm text-muted-foreground">
        {user.email}
      </span>
      <Button variant="ghost" onClick={signOut}>
        Sign out
      </Button>
    </div>
  );
}
