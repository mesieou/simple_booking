import { usePathname } from 'next/navigation';
import { useProvider } from '@/app/context/ProviderContext';

export default function Menu() {
  const pathname = usePathname();
  const { providerId } = useProvider();

  const links = [
    { href: '/', label: 'Inicio' },
    { href: '/about', label: 'Sobre Nosotros' },
    { href: '/services', label: 'Servicios' },
    providerId
      ? { href: `/${providerId}/booking/distance`, label: 'Reservar' }
      : { href: '#', label: 'Reservar', disabled: true },
  ];

  return (
    <div className="relative">
      {/* Mobile menu toggle */}
      <div className="md:hidden">
        <details className="relative">
          <summary className="text-gray-100 focus:outline-none cursor-pointer">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </summary>
          
          {/* Mobile menu */}
          <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50">
            {links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className={`block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 ${
                  pathname === link.href ? 'bg-gray-100' : ''
                } ${link.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                onClick={link.disabled ? (e) => e.preventDefault() : undefined}
              >
                {link.label}
              </a>
            ))}
          </div>
        </details>
      </div>

      {/* Desktop menu */}
      <nav className="hidden md:flex space-x-8">
        {links.map((link) => (
          <a
            key={link.href}
            href={link.href}
            className={`text-gray-100 hover:text-white transition-colors ${
              pathname === link.href ? 'text-white font-medium' : ''
            } ${link.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            onClick={link.disabled ? (e) => e.preventDefault() : undefined}
          >
            {link.label}
          </a>
        ))}
      </nav>
    </div>
  );
}