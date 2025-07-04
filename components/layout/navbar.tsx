"use client";

import Link from 'next/link';
import Image from 'next/image';
import logo from '../../public/SkedyLogo.png';
import { useAuth } from '@/app/context/auth-context';
import { Button } from '@components/ui/button';
import { useState } from 'react';
import { 
  Home, 
  Briefcase, 
  Info, 
  Mail, 
  User, 
  LogOut, 
  Menu, 
  X,
  ChevronDown
} from 'lucide-react';

const menuItems = [
  { label: 'Home', href: '/', icon: Home },
  { label: 'Services', href: '/services', icon: Briefcase },
  { label: 'About', href: '/about', icon: Info },
  { label: 'Contact', href: '/contact', icon: Mail },
];

export const Navbar = () => {
  const { user, loading, signOut } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleMobileMenuToggle = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  const handleMobileMenuClose = () => {
    setMobileMenuOpen(false);
  };

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
        <div className="flex items-center justify-center w-full px-4 mt-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
        </div>
      );
    }

    if (user) {
      return (
        <div className="flex flex-col gap-3 w-full px-4 mt-4">
          <Link 
            href="/protected"
            className="flex items-center justify-center gap-3 text-white font-medium py-3 px-4 rounded-lg hover:bg-white/10 transition-all duration-200 group"
            title="Click to go to Admin Dashboard"
            onClick={handleMobileMenuClose}
          >
            <User className="h-5 w-5" />
            <span className="text-sm">{user.email}</span>
            <span className="opacity-70 group-hover:opacity-100 transition-opacity text-xs">
              📊
            </span>
          </Link>
          <Button 
            variant="ghost" 
            onClick={() => {
              signOut();
              handleMobileMenuClose();
            }}
            className="w-full h-12 px-4 py-2 text-white border border-white/20 hover:bg-white/10 hover:border-white/40 transition-all duration-200"
          >
            <LogOut className="h-5 w-5 mr-2" />
            Sign out
          </Button>
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-3 w-full px-4 mt-4">
        <Link 
          href="/sign-in"
          className="flex items-center justify-center gap-3 w-full h-12 px-4 py-2 text-white border border-white/30 rounded-lg hover:bg-white/10 hover:border-white/50 transition-all duration-200 font-medium"
          aria-label="Sign In" 
          tabIndex={0}
          onClick={handleMobileMenuClose}
        >
          <User className="h-5 w-5" />
          Sign In
        </Link>
        <Link 
          href="/sign-up"
          className="flex items-center justify-center gap-3 w-full h-12 px-4 py-2 bg-white text-purple-600 rounded-lg hover:bg-gray-100 transition-all duration-200 font-semibold shadow-lg"
          aria-label="Sign Up" 
          tabIndex={0}
          onClick={handleMobileMenuClose}
        >
          <User className="h-5 w-5" />
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
          <button
            onClick={handleMobileMenuToggle}
            className="flex items-center justify-center p-3 rounded-lg bg-purple-600/10 hover:bg-purple-600/20 focus:outline-none focus:ring-2 focus:ring-purple-500/50 cursor-pointer transition-all duration-200"
            aria-label="Toggle mobile menu"
            tabIndex={0}
          >
            {mobileMenuOpen ? (
              <X className="w-6 h-6 text-purple-600" />
            ) : (
              <Menu className="w-6 h-6 text-purple-600" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      <div 
        className={`fixed inset-0 z-50 md:hidden transition-all duration-300 ease-in-out ${
          mobileMenuOpen 
            ? 'opacity-100 pointer-events-auto' 
            : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Backdrop */}
        <div 
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick={handleMobileMenuClose}
        />
        
        {/* Menu Content */}
        <div 
          className={`absolute top-20 left-0 right-0 bg-gradient-to-b from-purple-600 to-purple-700 shadow-2xl transition-all duration-300 ease-in-out ${
            mobileMenuOpen 
              ? 'translate-y-0 opacity-100' 
              : '-translate-y-4 opacity-0'
          }`}
        >
          <div className="flex flex-col py-6">
            {/* Menu Items */}
            <div className="flex flex-col space-y-2 px-4 mb-4">
              {menuItems.map((item, index) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className={`flex items-center gap-4 text-white font-semibold text-lg px-4 py-4 rounded-xl hover:bg-white/10 focus:bg-white/10 focus:outline-none transition-all duration-200 transform hover:scale-[1.02] ${
                    mobileMenuOpen 
                      ? 'translate-x-0 opacity-100' 
                      : 'translate-x-4 opacity-0'
                  }`}
                  style={{
                    transitionDelay: `${index * 100}ms`
                  }}
                  aria-label={item.label}
                  tabIndex={0}
                  onClick={handleMobileMenuClose}
                >
                  <item.icon className="h-6 w-6 text-white/80" />
                  {item.label}
                </Link>
              ))}
            </div>

            {/* Divider */}
            <div className="border-t border-white/20 mx-4 mb-4" />

            {/* Auth Section */}
            <div 
              className={`transition-all duration-300 ease-in-out ${
                mobileMenuOpen 
                  ? 'translate-y-0 opacity-100' 
                  : 'translate-y-4 opacity-0'
              }`}
              style={{
                transitionDelay: '400ms'
              }}
            >
              {renderMobileAuthSection()}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar; 