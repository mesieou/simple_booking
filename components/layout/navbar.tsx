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
  ChevronDown,
  DollarSign
} from 'lucide-react';

const menuItems = [
  { label: 'Services', href: '#demo-section', icon: Briefcase },
  { label: 'Pricing', href: '#pricing-section', icon: DollarSign },
  { label: 'About', href: '#', icon: Info, comingSoon: true },
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
          className="text-white/90 hover:text-white text-xs lg:text-sm font-medium transition-all duration-200 px-2 lg:px-4 py-2 rounded-lg hover:bg-white/10 backdrop-blur-sm border border-transparent hover:border-white/20"
          aria-label="Sign In"
        >
          Sign In
        </Link>
        <Link
          href="/sign-up"
          className="bg-gradient-to-r from-primary to-secondary hover:from-purple-600 hover:to-pink-600 text-white px-3 lg:px-6 py-2 rounded-lg text-xs lg:text-sm font-semibold hover:shadow-lg hover:shadow-primary/25 transition-all duration-200 transform hover:scale-105"
          aria-label="Sign Up"
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
      <div className="flex flex-col gap-4 w-full mt-2">
        <Link
          href="/sign-in"
          className="flex items-center justify-center gap-3 w-full h-14 px-6 py-3 text-white border border-purple-400 rounded-xl bg-gradient-to-r from-primary to-secondary hover:from-purple-700 hover:to-pink-700 transition-all duration-200 font-semibold text-lg shadow-xl"
          aria-label="Sign In"
          tabIndex={0}
          onClick={handleMobileMenuClose}
        >
          <User className="h-6 w-6" />
          Sign In
        </Link>
        <Link
          href="/sign-up"
          className="flex items-center justify-center gap-3 w-full h-14 px-6 py-3 bg-white text-purple-600 rounded-xl hover:bg-purple-50 border-2 border-purple-300 hover:border-purple-400 transition-all duration-200 font-bold shadow-xl text-lg"
          aria-label="Sign Up"
          tabIndex={0}
          onClick={handleMobileMenuClose}
        >
          <User className="h-6 w-6" />
          Sign Up
        </Link>
      </div>
    );
  };

        return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-b from-white/20 via-white/10 to-transparent backdrop-blur-lg">
      <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16 sm:h-18 lg:h-20">

          {/* Logo */}
          <Link href="/" className="flex items-center" aria-label="Home">
            <Image
              src={logo}
              className="w-24 sm:w-28 md:w-32 h-auto transition-opacity duration-200 hover:opacity-90"
              alt="Skedy logo"
              priority
            />
          </Link>

          {/* Center Navigation */}
          <ul className="hidden md:flex gap-4 lg:gap-6 list-none">
            {menuItems.map((item) => (
              <li key={item.label}>
                {item.comingSoon ? (
                  <div className="relative group cursor-not-allowed">
                    <span className="text-white/40 text-sm lg:text-lg font-medium px-2 lg:px-3 py-2 rounded-lg">
                      {item.label}
                    </span>
                    <span className="absolute -top-1 -right-1 bg-gradient-to-r from-yellow-400 to-orange-500 text-xs font-bold text-black px-1.5 lg:px-2 py-0.5 rounded-full shadow-lg">
                      Soon
                    </span>
                  </div>
                ) : (
                  <Link
                    href={item.href}
                    className="text-white/90 hover:text-white transition-colors duration-200 relative group text-sm lg:text-lg font-medium px-2 lg:px-4 py-2"
                    aria-label={item.label}
                  >
                    {item.label}
                    <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-gradient-to-r from-primary to-secondary transition-all duration-200 ease-out group-hover:w-full"></span>
                  </Link>
                )}
              </li>
            ))}
          </ul>

          {/* Right Section */}
          <div className="hidden md:flex items-center space-x-2 lg:space-x-6">
                        {/* Social Icons */}
            <div className="flex gap-2 justify-center">
                            <a
                href="https://www.instagram.com/skedy.io"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 text-white/70 hover:text-primary transition-colors duration-200"
                aria-label="Instagram"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.40s-.644-1.44-1.439-1.40z"/>
                </svg>
              </a>
                            <a
                href="https://www.linkedin.com/company/skedy-io"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 text-white/70 hover:text-secondary transition-colors duration-200"
                aria-label="LinkedIn"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                </svg>
              </a>
            </div>

            {/* Auth Buttons */}
            {renderAuthSection()}
          </div>

                  {/* Mobile Menu Toggle */}
          <div className="md:hidden">
            <button
              onClick={handleMobileMenuToggle}
              className="p-3 rounded-lg text-white hover:bg-white/10 transition-colors duration-300"
              aria-label="Toggle mobile menu"
            >
              {mobileMenuOpen ? (
                <X className="w-7 h-7 sm:w-8 sm:h-8" />
              ) : (
                <Menu className="w-7 h-7 sm:w-8 sm:h-8" />
              )}
            </button>
          </div>
        </div>
      </div>

            {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-t border-gray-200 shadow-lg">
          <div className="px-6 py-8 space-y-6 max-w-sm mx-auto">
            {/* Navigation Items */}
            <div className="space-y-3">
              {menuItems.map((item) => (
                <div key={item.label}>
                  {item.comingSoon ? (
                    <div className="relative flex items-center justify-between py-4 px-5 rounded-xl bg-purple-50 border border-purple-200 shadow-lg">
                      <div className="flex items-center gap-3">
                        <item.icon className="h-6 w-6 text-purple-600" />
                        <span className="text-purple-600 font-medium text-lg">
                          {item.label}
                        </span>
                      </div>
                      <span className="bg-gradient-to-r from-yellow-400 to-orange-500 text-xs font-bold text-black px-3 py-1.5 rounded-full">
                        Soon
                      </span>
                    </div>
                  ) : (
                    <Link
                      href={item.href}
                      className="flex items-center gap-4 text-purple-700 font-medium py-4 px-5 rounded-xl bg-purple-50 hover:bg-purple-100 hover:text-purple-800 transition-all duration-200 group border border-purple-200 hover:border-purple-300 shadow-lg"
                      onClick={handleMobileMenuClose}
                    >
                      <item.icon className="h-6 w-6 group-hover:scale-110 transition-transform duration-200" />
                      <span className="text-lg">{item.label}</span>
                    </Link>
                  )}
                </div>
              ))}
            </div>

            {/* Social Icons */}
            <div className="flex items-center justify-center gap-6 pt-6 border-t border-purple-200">
              <a
                href="https://www.instagram.com/skedy.io" target="_blank" rel="noopener noreferrer"
                className="p-3 text-purple-600 hover:text-primary transition-colors duration-200 rounded-full hover:bg-purple-100"
                aria-label="Instagram"
              >
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.40s-.644-1.44-1.439-1.44z"/>
                </svg>
              </a>
              <a
                href="https://www.linkedin.com/company/skedy-io"
                target="_blank"
                rel="noopener noreferrer"
                className="p-3 text-purple-600 hover:text-secondary transition-colors duration-200 rounded-full hover:bg-purple-100"
                aria-label="LinkedIn"
              >
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                </svg>
              </a>
            </div>

            {/* Auth Section */}
            {renderMobileAuthSection()}
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
