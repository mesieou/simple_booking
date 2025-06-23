"use client";

import Link from 'next/link';
import Image from 'next/image';
import logo from '../../public/SkedyLogo.png';
import { Button } from '../ui/button';
import { useState } from 'react';

const menuItems = [
  { label: 'Home', href: '/' },
  { label: 'Services', href: '/services' },
  { label: 'About', href: '/about' },
  { label: 'Contact', href: '/contact' },
];

export const Navbar = () => {
  const [menuOpen, setMenuOpen] = useState(false);

  const handleToggleMenu = () => setMenuOpen((open) => !open);
  const handleCloseMenu = () => setMenuOpen(false);

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
        {/* Auth Buttons Desktop */}
        <div className="hidden md:flex items-center justify-end w-1/3 gap-4">
          <Button asChild variant="secondary" aria-label="Sign In" tabIndex={0}>
            <Link href="/sign-in">
              Sign In
            </Link>
          </Button>
          <Button asChild variant="default" aria-label="Sign Up" tabIndex={0}>
            <Link href="/sign-up">
              Sign Up
            </Link>
          </Button>
        </div>
        {/* Hamburger Button Mobile */}
        <button
          className="md:hidden flex items-center justify-center p-2 rounded focus:outline-none focus:ring-2 focus:ring-primary"
          aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
          aria-expanded={menuOpen}
          onClick={handleToggleMenu}
        >
          <span className="sr-only">Toggle menu</span>
          <svg
            className="w-7 h-7 text-foreground"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            {menuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
            )}
          </svg>
        </button>
      </div>
      {/* Mobile Dropdown Menu */}
      {menuOpen && (
        <div className="md:hidden absolute top-16 left-0 w-full bg-secondary/80 backdrop-blur-md shadow-lg z-50 animate-fade-in flex flex-col items-center py-6 gap-6">
          {menuItems.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="text-foreground font-semibold text-xl px-4 py-2 rounded hover:bg-primary/20 focus:bg-primary/20 focus:outline-none transition-colors"
              aria-label={item.label}
              tabIndex={0}
              onClick={handleCloseMenu}
            >
              {item.label}
            </Link>
          ))}
          <div className="flex flex-col gap-3 w-full px-4 mt-2">
            <Button asChild variant="secondary" aria-label="Sign In" tabIndex={0} className="w-full">
              <Link href="/sign-in" onClick={handleCloseMenu}>
                Sign In
              </Link>
            </Button>
            <Button asChild variant="default" aria-label="Sign Up" tabIndex={0} className="w-full">
              <Link href="/sign-up" onClick={handleCloseMenu}>
                Sign Up
              </Link>
            </Button>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar; 