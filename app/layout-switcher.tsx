'use client';

import { Suspense } from 'react';
import { usePathname } from 'next/navigation';
import Navbar from '@components/layout/navbar';
import { Footer } from '@components/layout/footer';
import AnimatedBackground from '@/components/AnimatedBackground';
import { Toaster } from '@/components/ui/toaster';

export function LayoutSwitcher({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isDashboard = pathname.startsWith('/protected');

  if (isDashboard) {
    // Render a minimal, full-screen layout for the dashboard routes.
    // It takes up the entire viewport and doesn't have the standard page decorations.
    return (
      <>
        <AnimatedBackground />
        <main className="h-screen w-screen overflow-hidden">
          {children}
        </main>
      </>
    );
  }

  // Render the default, centered layout for all other marketing/content pages.
  return (
    <>
      <AnimatedBackground />
      <main className="min-h-screen flex flex-col">
        <div className="flex-1 w-full flex flex-col items-center">
          <Navbar />
          <div className="flex flex-col gap-20 max-w-5xl px-4 sm:px-6 lg:px-8 pt-4 sm:pt-8 lg:pt-12 pb-5 relative z-10 w-full">
            <Suspense
              fallback={
                <div className="flex items-center justify-center min-h-[200px]">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              }
            >
              {children}
            </Suspense>
          </div>
          <Footer />
        </div>
      </main>
      <Toaster />
    </>
  );
}
