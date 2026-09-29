import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

const SECTIONS = [
  {
    title: '1. Services',
    body: 'Luxurious Cleaning Co. provides residential and commercial cleaning services in Metro Manila, including regular cleaning, deep cleaning, move-in/move-out cleaning, post-construction cleaning, and office cleaning. Service inclusions, pricing, and scheduling are confirmed at the time of booking through our website or customer portal.',
  },
  {
    title: '2. Bookings and Scheduling',
    body: 'A booking is confirmed once you receive a booking reference and our team accepts your request. We recommend booking 48–72 hours in advance for standard services and at least two weeks ahead for large post-construction projects. Gold members may request urgent cleaning subject to availability.',
  },
  {
    title: '3. Cancellations and Rescheduling',
    body: 'You may reschedule or cancel a booking free of charge up to 24 hours before the scheduled service time through your customer portal or by contacting us at 0919 002 4136. Cancellations made less than 24 hours before the appointment, or if our team is denied entry on arrival, may incur a service fee of up to 50% of the booked service price.',
  },
  {
    title: '4. Payments and Membership',
    body: 'Service fees are payable as quoted at booking. Membership plans (Bronze, Silver, Gold) are billed per the terms presented at sign-up and renew as described in your membership agreement until cancelled. Member pricing, priority booking, and other perks apply only while your membership is active and in good standing.',
  },
  {
    title: '5. Customer Responsibilities',
    body: 'Please ensure our team has safe access to the property at the scheduled time, secure valuables and fragile items before the appointment, and disclose relevant information such as allergies, pets on the premises, or surfaces requiring special care. Please also inform us of any access instructions (gate passes, concierge procedures) in advance.',
  },
  {
    title: '6. Quality Guarantee and Liability',
    body: 'If any part of the service does not meet the agreed scope, notify us within 24 hours and we will return to re-clean the affected areas at no additional charge. Our liability for any single booking is limited to the amount paid for that booking. We are not liable for pre-existing damage, wear and tear, or issues arising from undisclosed property conditions.',
  },
  {
    title: '7. Conduct and Account Use',
    body: 'You agree to provide accurate information, use your account only for lawful purposes, and treat our cleaners and staff with respect. We reserve the right to refuse or discontinue service, or suspend accounts, in cases of abuse, fraud, unsafe working conditions, or violation of these terms.',
  },
  {
    title: '8. Changes and Contact',
    body: 'We may update these terms from time to time; material changes will be posted on this page with a revised date. Continued use of our services after changes take effect constitutes acceptance. For questions about these terms, contact us at luxuriouscleaning.klassic@gmail.com or 0919 002 4136.',
  },
];

export default function Terms() {
  return (
    <div className="pt-16 min-h-screen bg-navy-950">
      <section className="py-20 bg-navy-900 border-b border-gold-400/10">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-xs text-gold-400 tracking-[0.2em] uppercase font-medium mb-3">Legal</div>
          <h1 className="font-serif text-5xl md:text-6xl text-cream-100 mb-5">Terms of Service</h1>
          <p className="text-cream-300 text-sm">Last updated: September 2026</p>
        </div>
      </section>

      <section className="py-16">
        <div className="max-w-4xl mx-auto px-6">
          <p className="text-cream-300 leading-relaxed mb-10">
            These mock terms govern your use of the Luxurious Cleaning Co. website, portals, and cleaning
            services. By creating an account or booking a service, you agree to the terms below.
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
