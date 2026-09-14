import { Link } from 'react-router-dom';
import { Phone, Mail, MapPin, Share2 } from 'lucide-react';
import logoImg from '../imports/image-3.png';

export default function Footer() {
  return (
    <footer className="bg-navy-950 border-t border-gold-400/10">
      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
          {/* Brand */}
          <div className="lg:col-span-1">
            <div className="mb-4">
              <img src={logoImg} alt="Luxurious Cleaning Co." className="h-10 w-auto object-contain" />
            </div>
            <p className="text-sm text-cream-300 leading-relaxed mb-5">
              Premium residential and commercial cleaning services delivered with care, precision, and discretion.
            </p>
            <div className="flex items-center gap-3">
              {['IG', 'FB', 'LI'].map(s => (
              <a key={s} href="#" className="w-8 h-8 rounded-full border border-gold-400/20 flex items-center justify-center hover:border-gold-400/50 transition-colors text-[10px] text-cream-300 font-medium">
                {s}
              </a>
            ))}
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
                <span className="text-sm text-cream-300">+1 416-555-LUXE</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="shrink-0 mt-0.5"><Mail size={13} className="text-gold-400" /></span>
                <span className="text-sm text-cream-300">hello@luxuriouscleaning.ca</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="shrink-0 mt-0.5"><MapPin size={13} className="text-gold-400" /></span>
                <span className="text-sm text-cream-300">Toronto, Ontario<br />Greater Toronto Area</span>
              </li>
            </ul>
            <Link
              to="/book"
              className="inline-flex mt-6 bg-gold-400 hover:bg-gold-300 text-navy-950 text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors"
            >
              Book Now
            </Link>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-gold-400/10 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-cream-300/60">© {new Date().getFullYear()} Luxurious Cleaning Co. All rights reserved.</p>
          <div className="flex items-center gap-5">
            <a href="#" className="text-xs text-cream-300/60 hover:text-cream-300 transition-colors">Privacy Policy</a>
            <a href="#" className="text-xs text-cream-300/60 hover:text-cream-300 transition-colors">Terms of Service</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
