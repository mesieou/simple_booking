import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function OnboardingPage() {
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