import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2 } from 'lucide-react';

const SERVICES = [
  {
    name: 'Residential Cleaning',
    tagline: 'Your home, consistently pristine.',
    desc: 'Our signature residential cleaning service is tailored to your home\'s layout and your lifestyle. From weekly maintenance to seasonal refreshes, we adapt to your needs.',
    includes: ['Full kitchen clean including appliances exterior', 'All bathrooms sanitized and polished', 'Dusting, vacuuming, mopping all surfaces', 'Bedroom and living area refresh', 'Waste removal and bin liners replaced'],
    ideal: 'Homeowners and renters seeking regular, reliable cleaning',
    img: 'https://images.unsplash.com/photo-1484154218962-a197022b5858?w=700&h=500&fit=crop&auto=format',
  },
  {
    name: 'Deep Cleaning', 
    tagline: 'A true top-to-bottom reset.',
    desc: 'The deep clean is our most comprehensive service — covering every surface, appliance interior, baseboard, and hard-to-reach area.',
    includes: ['Inside oven, fridge, and microwave', 'Cabinet interiors and drawer cleaning', 'Baseboard, door frame, and trim detailing', 'Window sill and blind cleaning', 'Tile and grout treatment'],
    ideal: 'First-time clients, seasonal cleans, or pre-event preparation',
    img: 'https://images.unsplash.com/photo-1556909212-d5b604d0c90d?w=700&h=500&fit=crop&auto=format',
  },
  {
    name: 'Move-In / Move-Out Cleaning', 
    tagline: 'Every transition deserves a fresh start.',
    desc: 'Moving is stressful enough. Our move-in and move-out service ensures your space is immaculate for landlords, new tenants, or new owners.',
    includes: ['Full deep clean of all rooms', 'Inside all appliances', 'Wall spot cleaning', 'Window and track cleaning', 'Closet and cabinet interiors'],
    ideal: 'Tenants, landlords, real estate agents, and property managers',
    img: 'https://images.unsplash.com/photo-1600607688960-e095ff83135c?w=700&h=500&fit=crop&auto=format',
  },
  {
    name: 'Post-Construction Cleaning',
    tagline: 'Revealing the space behind the work.',
    desc: 'Construction leaves behind fine dust, debris, and residue invisible to the eye but felt underfoot. Our post-construction team uses specialized equipment and techniques to deliver reveal-ready results.',
    includes: ['Construction dust and debris removal', 'Window cleaning — interior and exterior', 'Polished surface protection and care', 'Air vent and duct surface cleaning', 'Final inspection walk-through'],
    ideal: 'Developers, construction companies, and renovating homeowners',
    img: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=700&h=500&fit=crop&auto=format',
  },
  {
    name: 'Commercial Cleaning',
    tagline: 'Professional spaces demand professional standards.',
    desc: 'Our commercial service is designed for retail environments, clinics, boutiques, and any customer-facing business that demands impeccable presentation.',
    includes: ['Floor care — vacuum, mop, and buffing', 'Reception and customer area detailing', 'Restroom deep sanitization', 'Display and surface dusting', 'Waste management and restocking'],
    ideal: 'Retail, medical, hospitality, and client-facing businesses',
    img: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=700&h=500&fit=crop&auto=format',
  },
  {
    name: 'Condo Cleaning', 
    tagline: 'Premium living deserves premium care.',
    desc: 'Condominiums have unique needs — smaller footprints, premium finishes, and shared-space considerations. Our condo specialists know exactly how to treat every surface.',
    includes: ['Premium surface and finish care', 'Balcony and exterior window sills', 'Kitchen and bathroom polish', 'Building access coordination', 'Discretion and security awareness'],
    ideal: 'Luxury condo owners and residents',
    img: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=700&h=500&fit=crop&auto=format',
  },
  {
    name: 'Office Cleaning', 
    tagline: 'Minimal disruption. Maximum impact.',
    desc: 'After-hours or early-morning, our office cleaning teams ensure your workspace is ready for a productive day — every day.',
    includes: ['Desk and workstation cleaning', 'Common area maintenance', 'Kitchen and break room', 'Restroom sanitization', 'Floor care and entrance detailing'],
    ideal: 'Small to mid-size offices and co-working spaces',
    img: 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=700&h=500&fit=crop&auto=format',
  },
  {
    name: 'Specialized Cleaning', 
    tagline: 'Bespoke solutions for unique requirements.',
    desc: 'Some spaces or situations don\'t fit a standard template. We work with you to design a service perfectly suited to your specific need.',
    includes: ['Pre- or post-event cleaning', 'Unique surface and material care', 'High-frequency sanitization programs', 'Custom scope and schedule', 'Dedicated account coordination'],
    ideal: 'Event spaces, unique properties, and custom requirements',
    img: 'https://images.unsplash.com/photo-1563453392212-326f5e854473?w=700&h=500&fit=crop&auto=format',
  },
];

export default function Services() {
  return (
    <div className="pt-16 min-h-screen bg-navy-950">
      {/* Header */}
      <section className="py-20 bg-navy-900 border-b border-gold-400/10">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-xs text-gold-400 tracking-[0.2em] uppercase font-medium mb-3">What We Offer</div>
          <h1 className="font-serif text-5xl md:text-6xl text-cream-100 mb-5">Our Services</h1>
          <p className="text-cream-300 text-lg max-w-xl leading-relaxed">
            Eight specialized cleaning services, each delivered with the same standard of precision and care that defines the Luxurious Cleaning Co. experience.
          </p>
        </div>
      </section>

      {/* Services list */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-6 space-y-12">
          {SERVICES.map((service, i) => (
            <div
              key={service.name}
              className={`grid md:grid-cols-2 gap-8 items-center ${i % 2 === 1 ? 'md:[&>*:first-child]:order-2' : ''}`}
            >
              <div className="bg-navy-800 rounded-2xl overflow-hidden">
                <img
                  src={service.img}
                  alt={service.name}
                  className="w-full h-64 object-cover"
                />
              </div>
              <div>
                <h2 className="font-serif text-3xl text-cream-100 mb-1">{service.name}</h2>
                <div className="text-gold-400 text-sm italic mb-4">{service.tagline}</div>
                <p className="text-cream-300 text-sm leading-relaxed mb-5">{service.desc}</p>
                <div className="space-y-2 mb-5">
                  {service.includes.map(item => (
                    <div key={item} className="flex items-center gap-2 text-sm text-cream-200">
                      <span className="shrink-0"><CheckCircle2 size={13} className="text-gold-400" /></span>
                      {item}
                    </div>
                  ))}
                </div>
                <div className="text-xs text-cream-300/70 mb-5 italic">Ideal for: {service.ideal}</div>
                <Link
                  to={`/book?service=${encodeURIComponent(service.name)}`}
                  className="inline-flex items-center gap-2 bg-gold-400 hover:bg-gold-300 text-navy-950 text-sm font-semibold px-6 py-2.5 rounded-lg transition-colors"
                >
                  Book {service.name} <ArrowRight size={14} />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-navy-800 border-t border-gold-400/10">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="font-serif text-3xl text-cream-100 mb-4">Not Sure Which Service You Need?</h2>
          <p className="text-cream-300 mb-6">Contact our team and we'll help you choose the right service for your space.</p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link to="/book" className="flex items-center gap-2 bg-gold-400 hover:bg-gold-300 text-navy-950 font-semibold px-6 py-3 rounded-lg transition-colors text-sm">
              Book Now <ArrowRight size={14} />
            </Link>
            <Link to="/contact" className="border border-gold-400/30 hover:border-gold-400/60 text-cream-100 text-sm px-6 py-3 rounded-lg transition-colors">
              Contact Us
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
