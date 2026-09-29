import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Phone, Mail, MapPin } from 'lucide-react';
import { useCurrentUser } from '../store';
import AuthPromptModal from './AuthPromptModal';
import Logo from './Logo';

function FacebookIcon({ size = 14, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </svg>
  );
}

export default function Footer() {
  const user = useCurrentUser();
  const [authPromptOpen, setAuthPromptOpen] = useState(false);

  function handleBookClick(e: React.MouseEvent) {
    if (user) return;
    e.preventDefault();
    setAuthPromptOpen(true);
  }

  return (
    <footer className="bg-navy-950 border-t border-gold-400/10">
      <AuthPromptModal open={authPromptOpen} onClose={() => setAuthPromptOpen(false)} redirectAfterLogin="/book" />
      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
          {/* Brand */}
          <div className="lg:col-span-1">
            <div className="mb-4">
              <Logo height={56} align="left" />
            </div>
            <p className="text-sm text-cream-300 leading-relaxed mb-5">
              Premium residential and commercial cleaning services delivered with care, precision, and discretion.
            </p>
            <div className="flex items-center gap-3">
              <a
                href="https://www.facebook.com/luxuriouscleaningph/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Luxurious Cleaning on Facebook"
                className="w-8 h-8 rounded-full border border-gold-400/20 flex items-center justify-center hover:border-gold-400/50 hover:bg-gold-400/10 transition-colors text-cream-300"
              >
                <FacebookIcon size={14} />
              </a>
            </div>
          </div>

          {/* Services */}
          <div>
            <h4 className="text-xs font-semibold tracking-[0.15em] uppercase text-gold-400 mb-4">Services</h4>
            <ul className="space-y-2.5">
              {['Residential Cleaning', 'Deep Cleaning', 'Move-In / Move-Out', 'Post-Construction', 'Commercial Cleaning', 'Office Cleaning', 'Condo Cleaning'].map(s => (
                <li key={s}>
                  <Link to="/services" className="text-sm text-cream-300 hover:text-cream-50 transition-colors">{s}</Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="text-xs font-semibold tracking-[0.15em] uppercase text-gold-400 mb-4">Company</h4>
            <ul className="space-y-2.5">
              {[
                { to: '/about', label: 'About Us' },
                { to: '/membership', label: 'Membership' },
                { to: '/partnerships', label: 'Partnerships' },
                { to: '/training', label: 'Training' },
                { to: '/contact', label: 'Contact' },
                { to: '/book', label: 'Book a Service' },
              ].map(l => (
                <li key={l.to}>
                  <Link to={l.to} className="text-sm text-cream-300 hover:text-cream-50 transition-colors">{l.label}</Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-xs font-semibold tracking-[0.15em] uppercase text-gold-400 mb-4">Contact</h4>
            <ul className="space-y-3">
              <li className="flex items-start gap-2.5">
                <span className="shrink-0 mt-0.5"><Phone size={13} className="text-gold-400" /></span>
                <a href="tel:09190024136" className="text-sm text-cream-300 hover:text-cream-50 transition-colors">0919 002 4136</a>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="shrink-0 mt-0.5"><Mail size={13} className="text-gold-400" /></span>
                <a href="mailto:luxuriouscleaning.klassic@gmail.com" className="text-sm text-cream-300 hover:text-cream-50 transition-colors break-all">luxuriouscleaning.klassic@gmail.com</a>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="shrink-0 mt-0.5"><MapPin size={13} className="text-gold-400" /></span>
                <span className="text-sm text-cream-300">Atlanta Centre, 31 Annapolis Street, San Juan City, Metro Manila, San Juan, Philippines</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="shrink-0 mt-0.5"><FacebookIcon size={13} className="text-gold-400" /></span>
                <a
                  href="https://www.facebook.com/luxuriouscleaningph/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-cream-300 hover:text-cream-50 transition-colors break-all"
                >
                  facebook.com/luxuriouscleaningph
                </a>
              </li>
            </ul>
            <Link
              to="/book"
              onClick={handleBookClick}
              className="inline-flex mt-6 bg-gold-400 hover:bg-gold-300 text-navy-950 text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors"
            >
              Book Now
            </Link>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-gold-400/10 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-cream-300/60">© {new Date().getFullYear()} Luxurious Cleaning Co. All rights reserved.</p>
          <div className="flex items-center gap-5">
            <Link to="/privacy" className="text-xs text-cream-300/60 hover:text-cream-300 transition-colors">Privacy Policy</Link>
            <Link to="/terms" className="text-xs text-cream-300/60 hover:text-cream-300 transition-colors">Terms of Service</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
