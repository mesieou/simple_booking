import DeployButton from "@components/misc/deploy-button";
import { EnvVarWarning } from "@components/misc/env-var-warning";
import HeaderAuth from "@components/layout/header-auth";
import { ThemeSwitcher } from "@components/layout/theme-switcher";
import { hasEnvVars } from "@/lib/database/supabase/check-env-vars";
import { Inter } from "next/font/google";
import { ThemeProvider } from "next-themes";
import Link from "next/link";
import Image from "next/image";
import "./globals.css";
import logo from "../public/SkedyLogo.png";
import { Footer } from "@components/layout/footer";
import Menu from "@components/layout/menu";
import { LanguageProvider } from "@/lib/rename-categorise-better/utils/translations/language-context";
import { Toaster } from "@components/ui/toaster";
import { cn } from "@/lib/utils";
import { AuthProvider } from "./context/auth-context";
import type { Metadata } from "next";
import { ProviderContextProvider } from './context/ProviderContext';
import Navbar from "@components/layout/navbar";
import { motion } from "framer-motion";
import AnimatedBackground from "@/components/AnimatedBackground";

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";


export const metadata: Metadata = {
  metadataBase: new URL(defaultUrl),
  title: "Skedy",
  description: "The best way to manage bookings and calendars",
  icons: {
    icon: "/favicon.ico",
  },
};

const inter = Inter({
  display: "swap",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn(inter.className)} suppressHydrationWarning>
      <body className="bg-background text-foreground">
        <AnimatedBackground />
        <AuthProvider>
          <LanguageProvider>
            <ThemeProvider
              attribute="class"
              defaultTheme="system"
              enableSystem
              disableTransitionOnChange
            >
              <ProviderContextProvider>
              <main className="min-h-screen flex flex-col">
                <div className="flex-1 w-full flex flex-col items-center">
                  <Navbar />
                  <div className="flex flex-col gap-20 max-w-5xl p-5 relative z-10">
                    {children}
                  </div>
                  <Footer />
                </div>
              </main>
              <Toaster />
              </ProviderContextProvider>
            </ThemeProvider>
          </LanguageProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
