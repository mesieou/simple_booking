// Este archivo será movido a components/layout/footer.tsx
import Link from 'next/link'
import Image from 'next/image'
import logo from '@/public/SkedyLogo.png'

export function Footer() {
  return (
    <footer className="w-full bg-gradient-to-b from-transparent via-violet-900/20 to-violet-900/60 backdrop-blur-lg text-white mt-auto">
      <div className="w-full max-w-6xl mx-auto px-2 sm:px-4 py-6 sm:py-8 md:py-10 flex flex-col items-center justify-center">
        <Link href="/" className="mb-4 sm:mb-6 flex items-center justify-center hover:scale-105 transition-transform duration-300" aria-label="Skedy logo" tabIndex={0}>
          <Image
            src={logo}
            alt="Skedy logo"
            width={120}
            height={120}
            className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 object-contain"
          />
        </Link>

        <nav className="mb-4 sm:mb-6">
          <ul className="flex flex-wrap gap-3 sm:gap-4 md:gap-8 justify-center items-center text-sm sm:text-base md:text-lg text-white/90 font-medium">
            <li>
              <Link
                href="#demo-section"
                className="hover:text-primary transition-all duration-300 hover:scale-105 relative group px-2 py-1"
                tabIndex={0}
                aria-label="Services"
              >
                Services
                <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-gradient-to-r from-primary to-secondary transition-all duration-300 group-hover:w-full"></span>
              </Link>
            </li>
            <li>
              <Link
                href="#pricing-section"
                className="hover:text-secondary transition-all duration-300 hover:scale-105 relative group px-2 py-1"
                tabIndex={0}
                aria-label="Pricing"
              >
                Pricing
                <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-gradient-to-r from-primary to-secondary transition-all duration-300 group-hover:w-full"></span>
              </Link>
            </li>
            <li>
              <span className="text-white/30 cursor-not-allowed px-2 py-1" aria-label="About - Coming Soon">
                About
              </span>
            </li>
            <li>
              <Link
                href="/contact"
                className="hover:text-green-400 transition-all duration-300 hover:scale-105 relative group px-2 py-1"
                tabIndex={0}
                aria-label="Contact"
              >
                Contact
                <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-gradient-to-r from-primary to-secondary transition-all duration-300 group-hover:w-full"></span>
              </Link>
            </li>
          </ul>
        </nav>

        {/* Social Icons */}
        <div className="flex gap-6 mb-6 justify-center">
          <a href="https://www.instagram.com/skedy.io" target="_blank" rel="noopener noreferrer" className="p-3 bg-white/10 rounded-full text-pink-400 hover:text-pink-300 hover:bg-pink-400/20 transition-all duration-300 transform hover:scale-110 backdrop-blur-sm" aria-label="Instagram" tabIndex={0}>
            <svg className="w-5 h-5" aria-hidden="true" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 1.366.062 2.633.334 3.608 1.308.974.974 1.246 2.241 1.308 3.608.058 1.266.07 1.646.07 4.85s-.012 3.584-.07 4.85c-.062 1.366-.334 2.633-1.308 3.608-.974.974-2.241 1.246-3.608 1.308-1.266.058-1.646.07-4.85.07s-3.584-.012-4.85-.072c-1.366-.062-2.633-.334-3.608-1.308-.974-.974-1.246-2.241-1.308-3.608C2.175 15.647 2.163 15.267 2.163 12s.012-3.584.07-4.85c.062-1.366.334-2.633 1.308-3.608.974-.974 2.241-1.246 3.608-1.308C8.416 2.175 8.796 2.163 12 2.163zm0-2.163C8.741 0 8.332.013 7.052.072 5.775.13 4.602.402 3.635 1.37 2.668 2.337 2.396 3.51 2.338 4.788.013 8.332 0 8.741 0 12c0 3.259.013 3.668.072 4.948.058 1.277.33 2.45 1.297 3.417.967.967 2.14 1.239 3.417 1.297C8.332 23.987 8.741 24 12 24c3.259 0 3.668-.013 4.948-.072 1.277-.058 2.45-.33 3.417-1.297.967-.967 1.239-2.14 1.297-3.417.059-1.28.072-1.689.072-4.948 0-3.259-.013-3.668-.072-4.948-.058-1.277-.33-2.45-1.297-3.417-.967-.967-2.14-1.239-3.417-1.297C15.668.013 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zm0 10.162a3.999 3.999 0 1 1 0-7.998 3.999 3.999 0 0 1 0 7.998zm6.406-11.845a1.44 1.44 0 1 0 0 2.88 1.44 1.44 0 0 0 0-2.88z"/></svg>
          </a>
          <a href="https://www.linkedin.com/company/skedy-io" target="_blank" rel="noopener noreferrer" className="p-3 bg-white/10 rounded-full text-blue-500 hover:text-blue-400 hover:bg-blue-500/20 transition-all duration-300 transform hover:scale-110 backdrop-blur-sm" aria-label="LinkedIn" tabIndex={0}>
            <svg className="w-5 h-5" aria-hidden="true" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
          </a>
        </div>

        {/* Copyright */}
        <div className="text-center w-full">
          <span className="text-sm text-white/60 font-medium">
            © 2025 <Link href="/" className="text-white hover:text-primary transition-colors font-semibold">Skedy™</Link>. All rights reserved.
          </span>
        </div>
      </div>
    </footer>
  )
}
