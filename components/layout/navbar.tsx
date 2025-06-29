"use client";

import Link from 'next/link';
import Image from 'next/image';
import logo from '../../public/SkedyLogo.png';
import { useAuth } from '@/app/context/auth-context';
import { Button } from '@components/ui/button';

const menuItems = [
  { label: 'Home', href: '/' },
  { label: 'Services', href: '/services' },
  { label: 'About', href: '/about' },
  { label: 'Contact', href: '/contact' },
];

export const Navbar = () => {
  const { user, loading, signOut } = useAuth();

  const renderAuthSection = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
        </div>
      );
    }

    if (user) {
      return (
        <div className="flex items-center gap-4">
          <Link 
            href="/protected"
            className="text-sm text-muted-foreground font-medium hover:text-primary transition-colors cursor-pointer px-2 py-1 rounded hover:bg-accent/50 group relative"
            title="Click to go to Admin Dashboard"
          >
            {user.email}
            <span className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity text-xs">
              📊
            </span>
          </Link>
          <Button 
            variant="ghost" 
            onClick={signOut}
            className="h-10 px-4 py-2"
          >
            Sign out
          </Button>
        </div>
      );
    }

    return (
      <>
        <Link 
          href="/sign-in"
          className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 text-secondary-foreground border border-border h-10 px-4 py-2 hover:bg-accent hover:text-accent-foreground"
          aria-label="Sign In" 
          tabIndex={0}
        >
          Sign In
        </Link>
        <Link 
          href="/sign-up"
          className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-gradient-to-r from-primary to-secondary border border-border text-primary-foreground hover:bg-gradient-to-r hover:from-secondary hover:to-primary h-10 px-4 py-2"
          aria-label="Sign Up" 
          tabIndex={0}
        >
          Sign Up
        </Link>
      </>
    );
  };

  const renderMobileAuthSection = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center w-full px-4 mt-2">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
        </div>
      );
    }

    if (user) {
      return (
        <div className="flex flex-col gap-3 w-full px-4 mt-2">
          <Link 
            href="/protected"
            className="text-center text-sm text-muted-foreground font-medium py-2 hover:text-primary transition-colors cursor-pointer px-3 rounded hover:bg-accent/50 group"
            title="Click to go to Admin Dashboard"
          >
            {user.email} 
            <span className="ml-1 opacity-70 group-hover:opacity-100 transition-opacity text-xs">
              📊
            </span>
          </Link>
          <Button 
            variant="ghost" 
            onClick={signOut}
            className="w-full h-10 px-4 py-2"
          >
            Sign out
          </Button>
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-3 w-full px-4 mt-2">
        <Link 
          href="/sign-in"
          className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 text-secondary-foreground border border-border h-10 px-4 py-2 hover:bg-accent hover:text-accent-foreground w-full"
          aria-label="Sign In" 
          tabIndex={0}
        >
          Sign In
        </Link>
        <Link 
          href="/sign-up"
          className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-gradient-to-r from-primary to-secondary border border-border text-primary-foreground hover:bg-gradient-to-r hover:from-secondary hover:to-primary h-10 px-4 py-2 w-full"
          aria-label="Sign Up" 
          tabIndex={0}
        >
          Sign Up
        </Link>
      </div>
    );
  };

  return (
    <nav className="w-full flex justify-center h-20 relative my-4">
      <div className="w-full max-w-5xl flex justify-between items-center p-4 px-6 text-sm">
        {/* Logo */}
        <div className="flex items-center w-1/3">
          <Link href="/" className="flex items-center" aria-label="Home" tabIndex={0}>
            <Image 
              src={logo} 
              className="w-40 h-auto" 
              alt="Skedy logo. bookings and scheduler business"
              priority 
            />
          </Link>
        </div>
        
        {/* Menu Desktop */}
        <div className="flex-1 flex justify-center">
          <ul className="hidden md:flex gap-8 list-none">
            {menuItems.map((item) => (
              <li key={item.label}>
                <Link
                  href={item.href}
                  className="text-foreground font-semibold text-xl transition-all duration-200 opacity-90 hover:opacity-100 focus:opacity-100 focus:outline-none"
                  aria-label={item.label}
                  tabIndex={0}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        
        {/* Auth Section Desktop */}
        <div className="hidden md:flex items-center justify-end w-1/3 gap-4">
          {renderAuthSection()}
        </div>
        
        {/* Mobile Menu Toggle - Hidden on desktop */}
        <div className="md:hidden">
          <details className="relative">
            <summary className="flex items-center justify-center p-2 rounded focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer">
              <span className="sr-only">Toggle menu</span>
              <svg
                className="w-7 h-7 text-foreground"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
              </svg>
            </summary>
            
            {/* Mobile Dropdown Menu */}
            <div className="absolute top-16 left-0 w-full bg-secondary/80 backdrop-blur-md shadow-lg z-50 flex flex-col items-center py-6 gap-6">
              {menuItems.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className="text-foreground font-semibold text-xl px-4 py-2 rounded hover:bg-primary/20 focus:bg-primary/20 focus:outline-none transition-colors"
                  aria-label={item.label}
                  tabIndex={0}
                >
                  {item.label}
                </Link>
              ))}
              {renderMobileAuthSection()}
            </div>
          </details>
        </div>
      </div>
    </nav>
  );
};

export default Navbar; 