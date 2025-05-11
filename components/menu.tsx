'use client';

import { useLanguage } from "@/lib/translations/language-context";
import { useState } from 'react';
import { usePathname } from 'next/navigation';
import LanguageSwitcher from './language-switcher';

export default function Menu() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const { t } = useLanguage();

  const links = [
    { href: '/', label: t('home') },
    { href: '/about', label: t('about') },
    { href: '/services', label: t('services') },
    { href: '/booking/distance', label: t('booking') },
  ];

  return (
    <div className="relative">
      {/* Botón hamburguesa para móviles */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="md:hidden text-gray-100 focus:outline-none"
        aria-label="Toggle menu"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {isOpen ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          )}
        </svg>
      </button>

      {/* Menú móvil */}
      <div
        className={`fixed top-0 left-0 h-full w-64 transform transition-transform duration-300 ease-in-out z-50 md:hidden shadow-xl ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-4">
          <button
            onClick={() => setIsOpen(false)}
            className="text-gray-100 mb-4"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <ul className="space-y-4">
            {links.map(({ href, label }) => {
              const isActive = pathname === href;
              return (
                <li key={href}>
                  <a
                    href={href}
                    className={`block py-2 px-3 rounded-sm text-lg ${
                      isActive
                        ? 'text-rose-600'
                        : 'text-gray-100 hover:bg-gray-700'
                    }`}
                  >
                    {label}
                  </a>
                </li>
              );
            })}
            <li className="mt-4">
              <LanguageSwitcher />
            </li>
          </ul>
        </div>
      </div>

      {/* Menú desktop */}
      <div className="hidden md:flex md:w-auto md:order-1 items-center">
        <ul className="flex flex-col p-4 md:p-0 mt-4 font-medium border rounded-lg md:space-x-8 rtl:space-x-reverse md:flex-row md:mt-0 md:border-0 shadow-xl">
          {links.map(({ href, label }) => {
            const isActive = pathname === href;
            return (
              <li key={href}>
                <a
                  href={href}
                  className={`block py-2 px-3 rounded-sm md:p-0 text-lg
                    ${isActive
                      ? 'text-rose-600 dark:text-blue-500'
                      : 'text-gray-100 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 md:hover:bg-transparent md:hover:text-blue-700 md:dark:hover:text-blue-500'}
                  `}
                >
                  {label}
                </a>
              </li>
            );
          })}
          <li className="ml-4">
            <LanguageSwitcher />
          </li>
        </ul>
      </div>
    </div>
  );
}