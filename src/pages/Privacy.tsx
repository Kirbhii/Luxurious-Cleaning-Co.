import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

const SECTIONS = [
  {
    title: '1. Information We Collect',
    body: 'We collect information you provide directly when you create an account, book a service, apply for membership, training, or partnership, or contact us. This includes your name, email address, phone number, service address, and booking preferences. We also collect service-related records such as booking history, before-and-after photos of cleaned spaces, and messages you send through our portals.',
  },
  {
    title: '2. How We Use Your Information',
    body: 'We use your information to schedule and deliver cleaning services, assign qualified cleaners, send booking confirmations and real-time service updates, process membership applications, respond to inquiries, and improve our services. We do not sell your personal information to third parties.',
  },
  {
    title: '3. Photos and Service Records',
    body: 'As part of our quality commitment, our cleaners may upload before, during, and after photos of serviced spaces to your customer portal. These photos are visible only to you, your assigned cleaner, and authorized Luxurious Cleaning Co. staff, and are used solely for service documentation and quality assurance.',
  },
  {
    title: '4. Data Protection and Your Rights',
    body: 'We process personal information in accordance with the Data Privacy Act of 2012 (Republic Act No. 10173) of the Philippines. You have the right to access, correct, or request deletion of your personal data, withdraw consent, and lodge a complaint with the National Privacy Commission. Reasonable technical and organizational safeguards are in place to protect your data against unauthorized access, loss, or disclosure.',
  },
  {
    title: '5. Data Retention',
    body: 'We retain your personal information only for as long as necessary to fulfill the purposes described in this policy, comply with legal obligations, and resolve disputes. Booking and transaction records may be retained for up to five (5) years for accounting and legal purposes.',
  },
  {
    title: '6. Cookies and Analytics',
    body: 'Our website may use basic cookies and similar technologies to keep you signed in, remember your preferences, and understand aggregate site usage. You may disable cookies in your browser settings, though some features may not function properly without them.',
  },
  {
    title: '7. Contact Us',
    body: 'For privacy-related questions or requests, contact us at luxuriouscleaning.klassic@gmail.com or 0919 002 4136, or visit us at Atlanta Centre, 31 Annapolis Street, San Juan City, Metro Manila. You may also reach us through our Facebook page at facebook.com/luxuriouscleaningph.',
  },
];

export default function Privacy() {
  return (
    <div className="pt-16 min-h-screen bg-navy-950">
      <section className="py-20 bg-navy-900 border-b border-gold-400/10">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-xs text-gold-400 tracking-[0.2em] uppercase font-medium mb-3">Legal</div>
          <h1 className="font-serif text-5xl md:text-6xl text-cream-100 mb-5">Privacy Policy</h1>
          <p className="text-cream-300 text-sm">Last updated: September 2026</p>
        </div>
      </section>

      <section className="py-16">
        <div className="max-w-4xl mx-auto px-6">
          <p className="text-cream-300 leading-relaxed mb-10">
            Luxurious Cleaning Co. ("we", "our", "us") respects your privacy. This mock policy explains what
            information we collect, how we use it, and the rights you have over your data when you use our
            website, customer portal, and cleaning services.
          </p>
          <div className="space-y-8">
            {SECTIONS.map(s => (
              <div key={s.title} className="bg-navy-800 border border-gold-400/10 rounded-2xl p-8">
                <h2 className="font-serif text-xl text-cream-100 mb-3">{s.title}</h2>
                <p className="text-sm text-cream-300 leading-relaxed">{s.body}</p>
              </div>
            ))}
          </div>
          <Link
            to="/"
            className="inline-flex items-center gap-2 mt-10 text-sm text-gold-400 hover:text-gold-300 transition-colors"
          >
            <ArrowLeft size={14} /> Back to Home
          </Link>
        </div>
      </section>
    </div>
  );
}
