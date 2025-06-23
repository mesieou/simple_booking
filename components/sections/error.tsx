"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const Illustration = (props: React.SVGProps<SVGSVGElement>) => (
  <svg {...props} viewBox="0 0 400 300">
    <g transform="translate(50, 20)">
      <rect x="50" y="50" width="200" height="150" rx="12" className="fill-muted/20" />
      <rect x="50" y="100" width="200" height="2" className="fill-muted/30" />
    </g>
    <g transform="translate(180, 160)">
      <circle cx="0" cy="0" r="60" className="fill-background/80" />
      <circle cx="0" cy="0" r="35" className="stroke-muted/50" strokeWidth="10" fill="none" />
      <line x1="25" y1="25" x2="45" y2="45" className="stroke-muted/50" strokeWidth="10" strokeLinecap="round" />
    </g>
  </svg>
);

export function ErrorSection() {
  return (
    <div className="flex items-center justify-center min-h-screen text-foreground p-8">
      <div className="container mx-auto">
        <div className="grid md:grid-cols-2 items-center gap-16">
          <div className="text-center md:text-left">
            <p className="text-primary font-semibold uppercase tracking-wider mb-2">
              404 error
            </p>
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-4">
              Page not found...
            </h1>
            <p className="text-lg text-muted-foreground mb-8">
              Sorry, the page you are looking for doesn't exist or has been moved.
            </p>
            <div className="flex justify-center md:justify-start">
              <Link href="/">
                <Button variant="secondary">Go back to homepage</Button>
              </Link>
            </div>
          </div>
          <div className="hidden md:block">
            <Illustration className="w-full h-auto max-w-md mx-auto" />
          </div>
        </div>
      </div>
    </div>
  );
}
