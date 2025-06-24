import DeployButton from "@components/misc/deploy-button";
import { EnvVarWarning } from "@components/misc/env-var-warning";
import HeaderAuth from "@components/layout/header-auth";
import { ThemeSwitcher } from "@components/layout/theme-switcher";
import { hasEnvVars } from "@/lib/database/supabase/check-env-vars";
import { Geist } from "next/font/google";
import { ThemeProvider } from "next-themes";
import Link from "next/link";
import Image from "next/image";
import "./globals.css";
import logo from "../public/SkedyLogo.png";
import { Footer } from "@components/layout/footer";
import Menu from "@components/layout/menu";
import { LanguageProvider } from "@/lib/rename-categorise-better/utils/translations/language-context";
import { Toaster } from "@components/ui/toaster";
import { cn } from "@/lib/rename-categorise-better/utils/utils";
import { AuthProvider } from "./context/auth-context";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ProviderContextProvider } from './context/ProviderContext';

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(defaultUrl),
  title: "Skedy",
  description: "The best way to manage bookings and calendars",
  icons: {
    icon: "/favicon.ico",
  },
};

const geistSans = Geist({
  display: "swap",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn(geistSans.className)} suppressHydrationWarning>
      <body className="bg-background text-foreground">
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
                  <nav className="w-full flex justify-center border-b border-b-foreground/10 h-16">
                    <div className="w-full max-w-5xl flex justify-between items-center p-3 px-5 text-sm">
                      <div className="flex items-center w-1/3">
                        <div className="md:hidden">
                          <Menu />
                        </div>
                        <Link href="/" className="flex items-center">
                          <Image 
                            src={logo} 
                            className="w-40 m:h-auto m:m-10" 
                            alt="Skedy logo. bookings and scheduler business"
                            priority 
                          />
                        </Link>
                      </div>
                      <div className="flex-1 flex justify-center">
                        <div className="hidden md:block w-full">
                          <Menu />
                        </div>
                      </div>
                      <div className="flex items-center justify-end w-1/3">
                        {!hasEnvVars ? <EnvVarWarning /> : <HeaderAuth />}
                      </div>
                    </div>
                  </nav>
                  <div className="flex flex-col gap-20 max-w-5xl p-5">
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