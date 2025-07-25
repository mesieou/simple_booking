// Este archivo será movido a components/layout/footer.tsx
import Link from 'next/link'
import Image from 'next/image'
import logo from '@/public/SkedyLogo.png'

export function Footer() {
  return (
    <footer className="w-full bg-gradient-to-r from-violet-950/5 to-gray-800/5 text-white backdrop-blur-md mt-auto shadow-[0_-4px_20px_-5px_rgba(0,0,0,0.1)]">
      <div className="w-full max-w-4xl mx-auto px-4 py-10 flex flex-col items-center justify-center">
        <Link href="/" className="mb-4 flex items-center justify-center" aria-label="Skedy logo" tabIndex={0}>
          <Image
            src={logo}
            alt="Skedy logo"
            width={100}
            height={100}
            className="w-24 h-24 object-contain"
          />
        </Link>
        <nav className="mb-6">
          <ul className="flex flex-wrap gap-8 justify-center items-center text-base text-gray-200 font-medium">
            <li><Link href="/features" className="hover:text-yellow-400 transition-colors" tabIndex={0} aria-label="Features">Features</Link></li>
            <li><Link href="/pricing" className="hover:text-yellow-400 transition-colors" tabIndex={0} aria-label="Pricing">Pricing</Link></li>
            <li><Link href="/contact" className="hover:text-yellow-400 transition-colors" tabIndex={0} aria-label="Contact">Contact</Link></li>
            <li><Link href="/faq" className="hover:text-yellow-400 transition-colors" tabIndex={0} aria-label="FAQ">FAQ</Link></li>
            <li><Link href="/privacy" className="hover:text-yellow-400 transition-colors" tabIndex={0} aria-label="Privacy">Privacy</Link></li>
            <li><Link href="/terms" className="hover:text-yellow-400 transition-colors" tabIndex={0} aria-label="Terms">Terms</Link></li>
          </ul>
        </nav>
        <div className="flex gap-6 mb-6 justify-center">
          <a href="#" className="text-gray-400 hover:text-yellow-400 transition-colors" aria-label="Facebook" tabIndex={0}>
            <svg className="w-5 h-5" aria-hidden="true" fill="currentColor" viewBox="0 0 8 19"><path fillRule="evenodd" d="M6.135 3H8V0H6.135a4.147 4.147 0 0 0-4.142 4.142V6H0v3h2v9.938h3V9h2.021l.592-3H5V3.591A.6.6 0 0 1 5.592 3h.543Z" clipRule="evenodd" /></svg>
          </a>
          <a href="#" className="text-gray-400 hover:text-yellow-400 transition-colors" aria-label="Twitter" tabIndex={0}>
            <svg className="w-5 h-5" aria-hidden="true" fill="currentColor" viewBox="0 0 20 17"><path fillRule="evenodd" d="M20 1.892a8.178 8.178 0 0 1-2.355.635 4.074 4.074 0 0 0 1.8-2.235 8.344 8.344 0 0 1-2.605.98A4.13 4.13 0 0 0 13.85 0a4.068 4.068 0 0 0-4.1 4.038 4 4 0 0 0 .105.919A11.705 11.705 0 0 1 1.4.734a4.006 4.006 0 0 0 1.268 5.392 4.165 4.165 0 0 1-1.859-.5v.05A4.057 4.057 0 0 0 4.1 9.635a4.19 4.19 0 0 1-1.856.07 4.108 4.108 0 0 0 3.831 2.807A8.36 8.36 0 0 1 0 14.184 11.732 11.732 0 0 0 6.291 16 11.502 11.502 0 0 0 17.964 4.5c0-.177 0-.35-.012-.523A8.143 8.143 0 0 0 20 1.892Z" clipRule="evenodd" /></svg>
          </a>
          <a href="#" className="text-gray-400 hover:text-yellow-400 transition-colors" aria-label="GitHub" tabIndex={0}>
            <svg className="w-5 h-5" aria-hidden="true" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 .333A9.911 9.911 0 0 0 6.866 19.65c.5.092.678-.215.678-.477 0-.237-.01-1.017-.014-1.845-2.757.6-3.338-1.169-3.338-1.169a2.627 2.627 0 0 0-1.1-1.451c-.9-.615.07-.6.07-.6a2.084 2.084 0 0 1 1.518 1.021 2.11 2.11 0 0 0 2.884.823c.044-.503.268-.973.63-1.325-2.2-.25-4.516-1.1-4.516-4.9A3.832 3.832 0 0 1 4.7 7.068a3.56 3.56 0 0 1 .095-2.623s.832-.266 2.726 1.016a9.409 9.409 0 0 1 4.962 0c1.89-1.282 2.717-1.016 2.717-1.016.366.83.402 1.768.1 2.623a3.827 3.827 0 0 1 1.02 2.659c0 3.807-2.319 4.644-4.525 4.889a2.366 2.366 0 0 1 .673 1.834c0 1.326-.012 2.394-.012 2.72 0 .263.18.572.681.475A9.911 9.911 0 0 0 10 .333Z" clipRule="evenodd" /></svg>
          </a>
          <a href="#" className="text-gray-400 hover:text-yellow-400 transition-colors" aria-label="Instagram" tabIndex={0}>
            <svg className="w-5 h-5" aria-hidden="true" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 1.366.062 2.633.334 3.608 1.308.974.974 1.246 2.241 1.308 3.608.058 1.266.07 1.646.07 4.85s-.012 3.584-.07 4.85c-.062 1.366-.334 2.633-1.308 3.608-.974.974-2.241 1.246-3.608 1.308-1.266.058-1.646.07-4.85.07s-3.584-.012-4.85-.072c-1.366-.062-2.633-.334-3.608-1.308-.974-.974-1.246-2.241-1.308-3.608C2.175 15.647 2.163 15.267 2.163 12s.012-3.584.07-4.85c.062-1.366.334-2.633 1.308-3.608.974-.974 2.241-1.246 3.608-1.308C8.416 2.175 8.796 2.163 12 2.163zm0-2.163C8.741 0 8.332.013 7.052.072 5.775.13 4.602.402 3.635 1.37 2.668 2.337 2.396 3.51 2.338 4.788.013 8.332 0 8.741 0 12c0 3.259.013 3.668.072 4.948.058 1.277.33 2.45 1.297 3.417.967.967 2.14 1.239 3.417 1.297C8.332 23.987 8.741 24 12 24c3.259 0 3.668-.013 4.948-.072 1.277-.058 2.45-.33 3.417-1.297.967-.967 1.239-2.14 1.297-3.417.059-1.28.072-1.689.072-4.948 0-3.259-.013-3.668-.072-4.948-.058-1.277-.33-2.45-1.297-3.417-.967-.967-2.14-1.239-3.417-1.297C15.668.013 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zm0 10.162a3.999 3.999 0 1 1 0-7.998 3.999 3.999 0 0 1 0 7.998zm6.406-11.845a1.44 1.44 0 1 0 0 2.88 1.44 1.44 0 0 0 0-2.88z"/></svg>
          </a>
        </div>
        <span className="text-sm text-gray-400 text-center block">
          © 2024 <Link href="/" className="hover:underline">Skedy™</Link>. All rights reserved.
        </span>
      </div>
    </footer>
  )
} 