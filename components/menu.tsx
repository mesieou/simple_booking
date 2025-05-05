// 'use client';

// import { usePathname } from 'next/navigation';

// export default function Menu() {
//   const pathname = usePathname();

//   const links = [
//     { href: '/', label: 'Home' },
//     { href: '/about', label: 'About' },
//     { href: '/services', label: 'Services' },
//     { href: '/componentes', label: 'Contact' },
//   ];

//   return (
//     <div className="items-center justify-between hidden w-full md:flex md:w-auto md:order-1" id="navbar-sticky">
//       <ul className="flex flex-col p-4 md:p-0 mt-4 font-medium border rounded-lg md:space-x-8 rtl:space-x-reverse md:flex-row md:mt-0 md:border-0 dark:bg-gray-800 md:dark:bg-gray-900 dark:border-gray-700">
//         {links.map(({ href, label }) => {
//           const isActive = pathname === href;
//           return (
//             <li key={href}>
//               <a
//                 href={href}
//                 className={`block py-2 px-3 rounded-sm md:p-0
//                   ${isActive
//                     ? 'text-rose-600 dark:text-blue-500'
//                     : 'text-gray-100 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 md:hover:bg-transparent md:hover:text-blue-700 md:dark:hover:text-blue-500'}
//                 `}
//               >
//                 {label}
//               </a>
//             </li>
//           );
//         })}
//       </ul>
//     </div>
//   );
// }

'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';

export default function Menu() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  const links = [
    { href: '/', label: 'Home' },
    { href: '/about', label: 'About' },
    { href: '/services', label: 'Services' },
    { href: '/componentes', label: 'Contact' },
  ];

  return (
    <div className="relative">
      {/* Botón hamburguesa visible solo en móviles */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="md:hidden text-gray-700 dark:text-white focus:outline-none"
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

      {/* Menú en pantallas grandes o desplegable en móviles */}
      <ul
        className={`${
          isOpen ? 'block absolute left-0 top-full bg-white dark:bg-gray-800 p-4 rounded shadow-md z-10' : 'hidden'
        } md:flex md:space-x-8 md:static md:bg-transparent md:shadow-none md:p-0`}
      >
        {links.map(({ href, label }) => {
          const isActive = pathname === href;
          return (
            <li key={href}>
              <Link
                href={href}
                className={`block py-2 px-3 rounded-sm md:p-0 ${
                  isActive
                    ? 'text-red-600 dark:text-blue-500'
                    : 'text-white dark:text-yellow-50 hover:bg-gray-100 dark:hover:bg-gray-700 md:hover:bg-transparent md:hover:text-blue-700 md:dark:hover:text-blue-500'
                }`}
              >
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}