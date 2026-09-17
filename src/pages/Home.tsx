import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, Star, CheckCircle2, ChevronDown, ChevronUp,
  Shield, Clock, Award, Leaf, Phone, MapPin, MessageSquare,
} from 'lucide-react';
import logoImg from '../imports/image-3.png';

/* ─── image constants ─────────────────────────────────────────── */
const IMG = {
  heroBg:       'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=1600&h=900&fit=crop&auto=format',
  cleanerPortrait: 'https://images.unsplash.com/photo-1758272421995-e993f97fae22?w=600&h=900&fit=crop&crop=top&auto=format',
  phoneTop:     'https://images.unsplash.com/photo-1628745277862-bc0b2d68c50c?w=400&h=220&fit=crop&auto=format',
  phoneBottom:  'https://images.unsplash.com/photo-1613545325278-f24b0cae1224?w=400&h=220&fit=crop&auto=format',
  whyUs:        'https://images.unsplash.com/photo-1758272421751-963195322eaa?w=700&h=800&fit=crop&auto=format',
  serviceBg:    'https://images.unsplash.com/photo-1779345169505-be7319f62b97?w=1200&h=600&fit=crop&auto=format',
  beforeClean:  'https://images.unsplash.com/photo-1597796681855-a8f9f83012f2?w=700&h=480&fit=crop&auto=format',
  afterClean:   'https://images.unsplash.com/photo-1628745277874-919d8f8ed03a?w=700&h=480&fit=crop&auto=format',
  commercial:   'https://images.unsplash.com/photo-1497366216548-37526070297c?w=700&h=500&fit=crop&auto=format',
  gloves:       'https://images.unsplash.com/photo-1758272421751-963195322eaa?w=400&h=300&fit=crop&auto=format',
  livingRoom:   'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=400&h=300&fit=crop&auto=format',
  kitchen:      'https://images.unsplash.com/photo-1484154218962-a197022b5858?w=400&h=300&fit=crop&auto=format',
  team:         'https://images.unsplash.com/photo-1614555199894-d1df9b97d301?w=800&h=500&fit=crop&auto=format',
  mopBucket:    'https://images.unsplash.com/photo-1779345169505-be7319f62b97?w=600&h=400&fit=crop&auto=format',
};

const SERVICES = [
  { name: 'Residential Cleaning', icon: '🏠', img: IMG.livingRoom },
  { name: 'Deep Cleaning', icon: '✨', img: IMG.kitchen },
  { name: 'Move-In / Move-Out', icon: '📦', img: IMG.afterClean },
  { name: 'Post-Construction', icon: '🏗️', img: IMG.mopBucket },
  { name: 'Commercial Cleaning', icon: '🏢', img: IMG.commercial },
  { name: 'Condo Cleaning', icon: '🏙️', img: IMG.gloves },
  { name: 'Office Cleaning', icon: '💼', img: IMG.commercial },
  { name: 'Specialized Cleaning', icon: '🎯', img: IMG.livingRoom },
];

const TESTIMONIALS = [
  { name: 'Catherine Liu', location: 'Yorkville, Toronto', rating: 5, quote: "Luxurious Cleaning Co. transformed my penthouse. The team is meticulous, discreet, and professional. I've never trusted anyone else with my home.", service: 'Gold Member — Bi-Weekly' },
  { name: 'David Okonkwo', location: 'Forest Hill, Toronto', rating: 5, quote: "After renovation, I expected weeks of dust. The post-construction team had our home looking perfect within a single day. Absolutely remarkable.", service: 'Post-Construction' },
  { name: 'Marina Petrov', location: 'Rosedale, Toronto', rating: 5, quote: "The real-time updates and photos through the portal give me complete peace of mind while I travel. Worth every penny.", service: 'Silver Member — Weekly' },
];

const FAQS = [
  { q: 'Are your cleaners vetted and insured?', a: "Yes. Every cleaner undergoes background checks, reference verification, and our in-house training program before ever entering a client's home. All team members are fully insured and bonded." },
  { q: 'What products do you use?', a: 'We use premium, environmentally responsible cleaning products. Clients with allergies or sensitivities can specify preferences at booking. Fragrance-free and hypoallergenic options are always available.' },
  { q: 'Can I get a regular cleaning schedule?', a: 'Absolutely. We offer weekly, bi-weekly, and monthly schedules. Membership plans include priority booking and preferred scheduling.' },
  { q: 'What is the real-time update feature?', a: 'Through your customer portal, your assigned cleaner uploads before, during, and after photos at key milestones. You receive notifications at each stage.' },
  { q: 'Do you service commercial properties?', a: 'Yes. Our B2B partnership program is designed for high-volume commercial clients including developers, property managers, and corporations.' },
  { q: 'How far in advance should I book?', a: 'We recommend 48–72 hours for standard bookings. Gold members have access to urgent cleaning. For large post-construction projects, two weeks is ideal.' },
];

/* ─── Phone mockup component ─────────────────────────────────── */
function PhoneMockup() {
  return (
    <div className="relative w-[260px] mx-auto select-none">
      {/* Phone shell */}
      <div
        className="relative z-10 rounded-[3rem] border-[6px] border-[#2a2520] bg-[#1a1612] shadow-[0_30px_80px_rgba(0,0,0,0.7)] overflow-hidden"
        style={{ height: 530 }}
      >
        {/* Notch */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 w-24 h-5 bg-[#1a1612] rounded-full z-20" />

        {/* Screen: Google Business card style */}
        <div className="absolute inset-0 bg-white flex flex-col overflow-hidden">

          {/* Top bar */}
          <div className="bg-[#1a73e8] px-3 py-2 flex items-center gap-2 shrink-0">
            <div className="w-4 h-4 bg-white/30 rounded-sm" />
            <div className="text-white text-[9px] font-medium truncate flex-1">Luxurious Cleaning Co.</div>
          </div>

          {/* Photo grid */}
          <div className="grid grid-cols-2 gap-0.5 shrink-0" style={{ height: 130 }}>
            <img src={IMG.phoneTop}   alt="clean kitchen"  className="w-full h-full object-cover" />
            <img src={IMG.phoneBottom} alt="clean living room" className="w-full h-full object-cover" />
          </div>

          {/* Business info */}
          <div className="px-3 py-2.5 flex-1 overflow-hidden">
            {/* Logo + name */}
            <div className="flex items-center gap-2 mb-1.5">
              <img src={logoImg} alt="Luxurious Cleaning Co." className="w-8 h-8 object-contain rounded-full shrink-0" />
              <div>
                <div className="text-[10px] font-bold text-gray-900 leading-tight">Luxurious Cleaning Co.</div>
                <div className="text-[8px] text-gray-500">Cleaning service</div>
              </div>
            </div>

            {/* Stars */}
            <div className="flex items-center gap-1 mb-1">
              {[...Array(5)].map((_, i) => (
                <Star key={i} size={8} className="fill-[#F5A623] text-[#F5A623]" />
              ))}
              <span className="text-[8px] text-gray-600 ml-0.5">5.0 (9)</span>
            </div>

            <div className="flex items-center gap-1 mb-2">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span className="text-[8px] text-emerald-600 font-medium">Always open</span>
            </div>

            {/* Book Now button */}
            <div className="bg-[#1a73e8] text-white text-[9px] font-bold text-center py-1.5 rounded-sm mb-2">
              📅 Book Now
            </div>

            {/* Info rows */}
            <div className="space-y-1">
              {[
                { icon: <MapPin size={7} />, text: 'Toronto, Ontario' },
                { icon: <Phone size={7} />, text: '+1 416-555-LUXE' },
                { icon: <MessageSquare size={7} />, text: '"Always on time, always perfect."' },
              ].map((row, i) => (
                <div key={i} className="flex items-start gap-1.5 text-[7px] text-gray-500">
                  <span className="text-gray-400 mt-px">{row.icon}</span>
                  {row.text}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Cleaner portrait bursting out of phone — no clip, overflows naturally */}
      <div
        className="absolute -right-10 -bottom-6 z-20 pointer-events-none"
        style={{ width: 180, height: 320 }}
      >
        <img
          src={IMG.cleanerPortrait}
          alt="Professional cleaner"
          className="w-full h-full object-cover object-top"
          style={{
            maskImage: 'linear-gradient(to top, transparent 0%, black 25%)',
            WebkitMaskImage: 'linear-gradient(to top, transparent 0%, black 25%)',
          }}
        />
      </div>
    </div>
  );
}

/* ─── Feature block (bottom strip) ──────────────────────────── */
function FeatureBlock({
  icon,
  title,
  amber,
  darkText,
}: {
  icon: string;
  title: string;
  amber?: boolean;
  darkText?: boolean;
}) {
  const textColor = amber || darkText ? 'text-[#1C1612]' : 'text-white';
  const subColor = amber || darkText ? 'text-[#1C1612]/70' : 'text-[#F5A623]';

  const bg = amber
    ? 'bg-[#F5A623]'
    : darkText
      ? 'bg-[#FCB316]'
      : 'bg-[#1E1B16]/90 backdrop-blur-sm';

  return (
    <div
      className={`px-7 py-6 flex flex-col gap-3 ${bg} border-r border-[#0E0C09] last:border-r-0`}
    >
      <div className="text-3xl">{icon}</div>

      <p
        className={`font-display font-black text-base uppercase leading-tight tracking-wide ${textColor} whitespace-pre-line`}
      >
        {title}
      </p>
    </div>
  );
}


/* ─── Main component ─────────────────────────────────────────── */
export default function Home() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="pt-16">

      {/* ══ HERO ══════════════════════════════════════════════════ */}
      <section className="relative min-h-screen flex flex-col">

        {/* Background photo — cleaners at work, heavily darkened */}
        <div className="absolute inset-0">
          <img
            src={IMG.heroBg}
            alt="Professional cleaning team"
            className="w-full h-full object-cover object-center"
          />
          {/* Warm dark overlay — matches the reference's desaturated, near-black treatment */}
          <div className="absolute inset-0 bg-[#0E0C09]/78" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0E0C09]/90 via-[#0E0C09]/60 to-transparent" />
        </div>

        {/* Main content grid */}
        <div className="relative flex-1 max-w-4xl mx-auto w-full px-6 sm:px-8 lg:px-12 flex items-center justify-center py-16 pb-40">

          {/* Centered headline and call-to-action */}
          <div className="text-center">
            {/* Eyebrow */}
            <div className="inline-flex items-center gap-3 mb-5">
              <div className="w-8 h-[2px] bg-[#F5A623]" />
              <span className="text-[#F5A623] text-[10px] tracking-[0.3em] uppercase font-bold">
                Premium · Trusted
              </span>
              <div className="w-8 h-[2px] bg-[#F5A623]" />
            </div>

            {/* The "A CLEAN YOU CAN TRUST" headline from reference */}
            <h1 className="font-display font-black uppercase leading-[0.9] mb-6">
              <span className="block text-[clamp(3rem,6vw,5rem)] text-white tracking-tight">A Clean</span>
              <span className="block text-[clamp(3rem,6vw,5rem)] text-white tracking-tight">You Can</span>
              <span
                className="block text-[clamp(3rem,6vw,5rem)] text-[#F5A623] tracking-tight"
                style={{ textShadow: '0 0 60px rgba(245,166,35,0.4)' }}
              >
                Trust.
              </span>
            </h1>

            <p className="text-[#C5BEB5] text-sm leading-relaxed max-w-md mx-auto mb-8">
              We offer a luxurious approach to deep cleaning your home or workplace — helping maintain a healthy, immaculate premises with real-time updates every step of the way.
            </p>

            {/* CTA row */}
            <div className="flex flex-wrap justify-center gap-3">
              <Link
                to="/book"
                className="flex items-center gap-2 bg-[#F5A623] hover:bg-[#fbbf4a] text-[#1C1612] font-black text-xs uppercase tracking-widest px-8 py-3.5 rounded transition-all shadow-lg shadow-[#F5A623]/25"
              >
                Book a Service <ArrowRight size={14} />
              </Link>
              <Link
                to="/services"
                className="flex items-center gap-2 border-2 border-white/20 hover:border-[#F5A623] text-white hover:text-[#F5A623] font-bold text-xs uppercase tracking-widest px-7 py-3.5 rounded transition-all"
              >
                Our Services
              </Link>
            </div>

            {/* Trust badges */}
            <div className="flex items-center justify-center gap-5 mt-8 mb-10">
              {[
                { v: '2,400+', l: 'Cleanings' },
                { v: '98%', l: 'Satisfaction' },
                { v: '5★', l: 'Rating' },
              ].map(b => (
                <div key={b.l} className="text-center">
                  <div className="font-display font-black text-xl text-[#F5A623]">{b.v}</div>
                  <div className="text-[9px] text-[#8A847D] uppercase tracking-wider">{b.l}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom feature strip — pinned to bottom exactly like the reference */}
       <div className="absolute bottom-0 left-0 right-0">
  <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-[#0E0C09]">
    <FeatureBlock
      icon="⏱️"
      title={"Save Your\nTeam & Money"}
    />

    <FeatureBlock
      icon="🫧"
      title={"Clean &\nHealthy Environment"}
      amber
    />

    <FeatureBlock
      icon="🏅"
      title={"Highly Trained\n& Professional"}
      darkText
    />
  </div>
</div>
      </section>

      {/* ══ SERVICES ══════════════════════════════════════════════ */}
      <section className="py-24 bg-[#141210]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-4">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-6 h-[2px] bg-[#F5A623]" />
                <span className="text-[#F5A623] text-[10px] tracking-[0.3em] uppercase font-bold">What We Offer</span>
              </div>
              <h2 className="font-display font-black text-4xl md:text-5xl uppercase text-white">
                Our <span className="text-[#F5A623]">Services</span>
              </h2>
            </div>
            <Link to="/services" className="flex items-center gap-2 text-[#F5A623] hover:text-[#fbbf4a] text-xs font-black uppercase tracking-widest transition-colors">
              View All Services <ArrowRight size={13} />
            </Link>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {SERVICES.map((service, i) => (
              <Link
                key={service.name}
                to="/book"
                className="group relative overflow-hidden rounded-xl aspect-[4/3] block"
              >
                <img
                  src={service.img}
                  alt={service.name}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110 brightness-50 group-hover:brightness-40"
                />
                {/* Amber bottom bar on hover */}
                <div className="absolute inset-x-0 bottom-0 h-1 bg-[#F5A623] scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left" />
                <div className="absolute inset-0 flex flex-col justify-end p-4">
                  <div className="text-xl mb-1">{service.icon}</div>
                  <h3 className="font-display font-black text-xs uppercase tracking-wide text-white leading-tight group-hover:text-[#F5A623] transition-colors">
                    {service.name}
                  </h3>
                </div>
                <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="w-6 h-6 rounded-full bg-[#F5A623] flex items-center justify-center">
                    <ArrowRight size={11} className="text-[#1C1612]" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ══ WHY CHOOSE US ═════════════════════════════════════════ */}
      <section className="py-24 bg-[#0E0C09]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">

            {/* Photo stack */}
            <div className="relative">
              <img
                src={IMG.whyUs}
                alt="Cleaner at work"
                className="w-full h-[560px] object-cover rounded-2xl"
              />
              {/* Amber accent block */}
              <div className="absolute -bottom-5 -right-5 bg-[#F5A623] rounded-xl p-5 shadow-2xl max-w-[200px]">
                <div className="font-display font-black text-3xl text-[#1C1612] leading-none">98%</div>
                <div className="text-[#1C1612] text-xs font-bold uppercase tracking-wide mt-1">Client Satisfaction</div>
                <div className="flex gap-0.5 mt-2">
                  {[...Array(5)].map((_, i) => <Star key={i} size={10} className="fill-[#1C1612] text-[#1C1612]" />)}
                </div>
              </div>
              {/* Dark stat block */}
              <div className="absolute -top-5 -left-5 bg-[#1C1916] border border-[#F5A623]/20 rounded-xl p-4 shadow-2xl">
                <div className="font-display font-black text-2xl text-[#F5A623]">2,400+</div>
                <div className="text-[#8A847D] text-[10px] uppercase tracking-wide mt-0.5">Cleanings Completed</div>
              </div>
            </div>

            {/* Copy */}
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-6 h-[2px] bg-[#F5A623]" />
                <span className="text-[#F5A623] text-[10px] tracking-[0.3em] uppercase font-bold">The Difference</span>
              </div>
              <h2 className="font-display font-black text-4xl md:text-5xl uppercase text-white mb-2">
                Why Choose
              </h2>
              <h2 className="font-display font-black text-4xl md:text-5xl uppercase text-[#F5A623] mb-6">
                Luxurious?
              </h2>
              <p className="text-[#A8A39D] text-sm leading-relaxed mb-8">
                We don't simply clean spaces — we care for them. Every booking is a commitment to precision, real-time transparency, and a standard that can only be described as luxurious.
              </p>
              <div className="space-y-5">
                {[
                  { icon: Shield, title: 'Vetted & Insured', desc: 'Background-checked, certified, and fully insured professionals on every job.' },
                  { icon: Clock, title: 'Real-Time Photo Updates', desc: 'Before, during, and after photos delivered directly to your portal as it happens.' },
                  { icon: Award, title: 'Training-Certified Team', desc: 'Every cleaner completes our proprietary training program before entering your home.' },
                  { icon: Leaf, title: 'Eco-Conscious Products', desc: 'Premium, environmentally responsible solutions used on every engagement.' },
                ].map(item => (
                  <div key={item.title} className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-lg bg-[#F5A623]/15 border border-[#F5A623]/30 flex items-center justify-center shrink-0">
                      <item.icon size={16} className="text-[#F5A623]" />
                    </div>
                    <div>
                      <div className="text-xs font-black uppercase tracking-wide text-white mb-0.5">{item.title}</div>
                      <div className="text-[#A8A39D] text-xs leading-relaxed">{item.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══ BEFORE / AFTER ════════════════════════════════════════ */}
      <section className="py-24 bg-[#141210]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-12">
            <div className="flex items-center justify-center gap-3 mb-3">
              <div className="w-6 h-[2px] bg-[#F5A623]" />
              <span className="text-[#F5A623] text-[10px] tracking-[0.3em] uppercase font-bold">Results</span>
              <div className="w-6 h-[2px] bg-[#F5A623]" />
            </div>
            <h2 className="font-display font-black text-4xl md:text-5xl uppercase text-white">
              The <span className="text-[#F5A623]">Transformation</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            <div className="relative overflow-hidden rounded-2xl group">
              <img src={IMG.beforeClean} alt="Before cleaning" className="w-full h-80 object-cover brightness-75 group-hover:brightness-90 transition-all duration-500" />
              <div className="absolute top-4 left-4 bg-[#1C1612]/90 backdrop-blur-sm text-white text-xs font-black tracking-[0.2em] uppercase px-4 py-2 rounded">
                BEFORE
              </div>
            </div>
            <div className="relative overflow-hidden rounded-2xl group">
              <img src={IMG.afterClean} alt="After cleaning" className="w-full h-80 object-cover brightness-100 group-hover:brightness-110 transition-all duration-500" />
              <div className="absolute top-4 left-4 bg-[#F5A623] text-[#1C1612] text-xs font-black tracking-[0.2em] uppercase px-4 py-2 rounded">
                AFTER ✓
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══ MEMBERSHIP ════════════════════════════════════════════ */}
      <section className="py-24 bg-[#0E0C09]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-6 h-[2px] bg-[#F5A623]" />
                <span className="text-[#F5A623] text-[10px] tracking-[0.3em] uppercase font-bold">Exclusive Access</span>
              </div>
              <h2 className="font-display font-black text-4xl md:text-5xl uppercase text-white mb-2">
                Membership
              </h2>
              <h2 className="font-display font-black text-4xl md:text-5xl uppercase text-[#F5A623] mb-6">
                Plans
              </h2>
              <p className="text-[#A8A39D] text-sm leading-relaxed mb-8">
                Priority booking, member pricing, and exclusive services. Three tiers designed for clients who expect the best — every time.
              </p>
              <Link to="/membership" className="inline-flex items-center gap-2 bg-[#F5A623] hover:bg-[#fbbf4a] text-[#1C1612] font-black text-xs uppercase tracking-widest px-8 py-3.5 rounded transition-all">
                Explore Plans <ArrowRight size={14} />
              </Link>
            </div>

            {/* Tier cards */}
            <div className="grid grid-cols-3 gap-px bg-[#F5A623]/10 rounded-2xl overflow-hidden border border-[#F5A623]/10">
              {[
                { tier: 'Bronze', bg: 'bg-[#1C1916]', badge: 'text-amber-500', perks: ['Member pricing', 'Priority booking', 'Promotions'] },
                { tier: 'Silver', bg: 'bg-[#232018]', badge: 'text-slate-300', perks: ['All Bronze', 'Higher priority', 'Discounts', 'Priority support'] },
                { tier: 'Gold', bg: 'bg-[#F5A623]', badge: 'text-[#1C1612]', dark: true, perks: ['All Silver', 'Urgent cleans', 'Exclusive services', 'Premium support'] },
              ].map(plan => (
                <div key={plan.tier} className={`${plan.bg} p-6`}>
                  <span className={`text-[10px] font-black uppercase tracking-wider mb-4 block ${plan.badge}`}>{plan.tier}</span>
                  <ul className="space-y-2">
                    {plan.perks.map(p => (
                      <li key={p} className={`flex items-start gap-1.5 text-[11px] leading-tight ${plan.dark ? 'text-[#1C1612]' : 'text-[#C5BEB5]'}`}>
                        <span className="shrink-0 mt-0.5"><CheckCircle2 size={10} className={plan.dark ? 'text-[#1C1612]' : 'text-[#F5A623]'} /></span>
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══ TESTIMONIALS ══════════════════════════════════════════ */}
      <section className="py-24 bg-[#141210]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-12">
            <div className="flex items-center justify-center gap-3 mb-3">
              <div className="w-6 h-[2px] bg-[#F5A623]" />
              <span className="text-[#F5A623] text-[10px] tracking-[0.3em] uppercase font-bold">Client Reviews</span>
              <div className="w-6 h-[2px] bg-[#F5A623]" />
            </div>
            <h2 className="font-display font-black text-4xl md:text-5xl uppercase text-white">
              What Clients <span className="text-[#F5A623]">Say</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            {TESTIMONIALS.map((t, i) => (
              <div
                key={t.name}
                className={`rounded-2xl p-7 ${i === 1 ? 'bg-[#F5A623]' : 'bg-[#1C1916] border border-[#F5A623]/10'}`}
              >
                <div className="flex gap-0.5 mb-4">
                  {[...Array(t.rating)].map((_, j) => (
                    <Star key={j} size={12} className={i === 1 ? 'fill-[#1C1612] text-[#1C1612]' : 'fill-[#F5A623] text-[#F5A623]'} />
                  ))}
                </div>
                <blockquote className={`font-serif italic text-sm leading-relaxed mb-5 ${i === 1 ? 'text-[#2A2010]' : 'text-[#D0C9B8]'}`}>
                  "{t.quote}"
                </blockquote>
                <div>
                  <div className={`text-xs font-black uppercase tracking-wide ${i === 1 ? 'text-[#1C1612]' : 'text-white'}`}>{t.name}</div>
                  <div className={`text-[10px] mt-0.5 ${i === 1 ? 'text-[#2A2010]' : 'text-[#8A847D]'}`}>{t.location}</div>
                  <div className={`text-[10px] mt-1 font-semibold ${i === 1 ? 'text-[#1C1612]' : 'text-[#F5A623]'}`}>{t.service}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ TEAM / CTA BANNER ═════════════════════════════════════ */}
      <section className="relative py-0 overflow-hidden">
        <img src={IMG.team} alt="Our cleaning team" className="w-full h-64 object-cover brightness-30" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center px-6">
            <h2 className="font-display font-black text-4xl md:text-5xl uppercase text-white mb-2">
              45+ Certified <span className="text-[#F5A623]">Professionals</span>
            </h2>
            <p className="text-[#C5BEB5] text-sm">Ready to transform your space — every single day.</p>
          </div>
        </div>
      </section>

      {/* ══ PARTNERSHIPS ══════════════════════════════════════════ */}
      <section className="py-24 bg-[#0E0C09]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-2 overflow-hidden rounded-2xl border border-[#F5A623]/15">
            <div className="relative">
              <img src={IMG.commercial} alt="Commercial cleaning" className="w-full h-full min-h-[300px] object-cover brightness-40" />
              <div className="absolute inset-0 flex flex-col justify-center px-10">
                <div className="font-display font-black text-5xl text-white uppercase leading-tight">B2B</div>
                <div className="font-display font-black text-5xl text-[#F5A623] uppercase leading-tight">Partner</div>
                <div className="font-display font-black text-5xl text-white uppercase leading-tight">Program</div>
              </div>
            </div>
            <div className="bg-[#1C1916] p-10 flex flex-col justify-center">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-6 h-[2px] bg-[#F5A623]" />
                <span className="text-[#F5A623] text-[10px] tracking-[0.3em] uppercase font-bold">For Businesses</span>
              </div>
              <p className="text-[#A8A39D] text-sm leading-relaxed mb-6">
                Construction companies, real estate firms, property managers, and hospitality businesses — our B2B program delivers dedicated account management and priority scheduling for high-volume partners.
              </p>
              <div className="space-y-2.5 mb-8">
                {['Construction & Development', 'Real Estate & Property Mgmt', 'Hospitality & Hotels', 'Corporate Offices', 'Interior Designers'].map(t => (
                  <div key={t} className="flex items-center gap-2 text-xs text-[#C5BEB5]">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#F5A623] shrink-0" />{t}
                  </div>
                ))}
              </div>
              <Link to="/partnerships" className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest bg-[#F5A623] hover:bg-[#fbbf4a] text-[#1C1612] px-6 py-3 rounded transition-all w-fit">
                Apply to Partner <ArrowRight size={13} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ══ FAQ ═══════════════════════════════════════════════════ */}
      <section className="py-24 bg-[#141210]">
        <div className="max-w-3xl mx-auto px-6">
          <div className="text-center mb-12">
            <div className="flex items-center justify-center gap-3 mb-3">
              <div className="w-6 h-[2px] bg-[#F5A623]" />
              <span className="text-[#F5A623] text-[10px] tracking-[0.3em] uppercase font-bold">FAQ</span>
              <div className="w-6 h-[2px] bg-[#F5A623]" />
            </div>
            <h2 className="font-display font-black text-4xl uppercase text-white">
              Common <span className="text-[#F5A623]">Questions</span>
            </h2>
          </div>
          <div className="space-y-2">
            {FAQS.map((faq, i) => (
              <div key={i} className={`rounded-xl border overflow-hidden transition-all ${openFaq === i ? 'border-[#F5A623]/40 bg-[#1C1916]' : 'border-[#F5A623]/10 bg-[#1C1916]'}`}>
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-[#231F1A] transition-colors"
                >
                  <span className="text-xs font-black uppercase tracking-wide text-white pr-4">{faq.q}</span>
                  {openFaq === i
                    ? <span className="shrink-0"><ChevronUp size={14} className="text-[#F5A623]" /></span>
                    : <span className="shrink-0"><ChevronDown size={14} className="text-[#8A847D]" /></span>}
                </button>
                {openFaq === i && (
                  <div className="px-6 pb-5 text-xs text-[#A8A39D] leading-relaxed border-t border-[#F5A623]/10 pt-4">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ FINAL CTA ═════════════════════════════════════════════ */}
      <section className="bg-[#F5A623]">
        <div className="max-w-7xl mx-auto px-6 py-16 flex flex-col md:flex-row items-center justify-between gap-8">
          <div>
            <h2 className="font-display font-black text-4xl md:text-5xl uppercase text-[#1C1612] leading-tight">
              Ready to Experience<br />the Difference?
            </h2>
            <p className="text-[#1C1612]/70 text-sm mt-3 max-w-md">
              Book your first service today and discover what premium cleaning truly means.
            </p>
          </div>
          <div className="flex flex-wrap gap-4 shrink-0">
            <Link
              to="/book"
              className="flex items-center gap-2 bg-[#1C1612] hover:bg-[#2A2018] text-[#F5A623] font-black text-xs uppercase tracking-widest px-8 py-4 rounded-lg transition-colors"
            >
              Book a Service <ArrowRight size={14} />
            </Link>
            <a
              href="tel:+14165550001"
              className="flex items-center gap-2 border-2 border-[#1C1612]/30 hover:border-[#1C1612] text-[#1C1612] text-xs font-black uppercase tracking-widest px-8 py-4 rounded-lg transition-colors"
            >
              <Phone size={13} />Call Us
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
