import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { ArrowRight, ArrowLeft, CheckCircle2, Copy, CalendarDays, Crown, Lock, Zap } from 'lucide-react';
import { useStore, useCurrentUser, genId, genBookingId, saveNotification } from '../store';
import { useToast } from '../components/ToastContainer';
import AuthPromptModal from '../components/AuthPromptModal';
import LocationSelect, { EMPTY_LOCATION } from '../components/LocationSelect';
import type { LocationValue } from '../components/LocationSelect';
import { insertBookingRow, isUuid } from '../lib/supabase';
import { TIER_DISCOUNT, TIER_NAMES, GOLD_ONLY_SERVICES, priorityForTier, SERVICE_CATALOG, serviceInfo, memberPrice, formatPeso } from '../lib/membership';
import type { Booking } from '../store';

const PROPERTY_TYPES = ['Condo', 'House', 'Townhouse', 'Apartment', 'Office', 'Commercial', 'Other'];
const FREQUENCIES = ['One-time', 'Weekly', 'Bi-weekly', 'Monthly', 'Custom'];
const FRAGRANCES = ['Lavender', 'Citrus', 'Fresh Linen', 'Eucalyptus', 'Unscented'];

const SERVICE_FIELDS: Record<string, string[]> = {
  'Post-Construction Cleaning': ['propertyType', 'size', 'specialRequests'],
  'Office Cleaning': ['propertyType', 'size', 'specialRequests'],
  'Commercial Cleaning': ['propertyType', 'size', 'specialRequests'],
};

type Step = 'service' | 'details' | 'preferences' | 'confirm';
const STEPS: Step[] = ['service', 'details', 'preferences', 'confirm'];
const STEP_LABELS = ['Select Service', 'Property Details', 'Preferences', 'Review & Confirm'];

export default function Booking() {
  const [searchParams] = useSearchParams();
  const { dispatch } = useStore();
  const user = useCurrentUser();
  const navigate = useNavigate();
  const toast = useToast();

  const [step, setStep] = useState<Step>('service');
  const [bookingRef, setBookingRef] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [authPromptOpen, setAuthPromptOpen] = useState(false);
  const [urgent, setUrgent] = useState(false);

  // Membership benefit wiring — only active members get rates, queue priority,
  // and (Gold) urgent requests + exclusive services.
  const memberTier = user?.membershipStatus === 'active' ? user.membershipTier ?? null : null;
  const memberDiscount = memberTier ? TIER_DISCOUNT[memberTier] : 0;
  const isGold = memberTier === 'gold';

  const [form, setForm] = useState({
    service: searchParams.get('service') || '',
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    address: '',
    city: '',
    barangay: '',
    propertyType: '',
    bedrooms: '2',
    bathrooms: '1',
    size: '',
    date: '',
    time: '09:00',
    frequency: 'One-time',
    specialRequests: '',
    fragrance: 'Lavender',
    allergies: '',
    accessInstructions: '',
  });

  const stepIndex = STEPS.indexOf(step);
  const formTopRef = useRef<HTMLDivElement>(null);

  // Each step starts at the top of the form instead of inheriting
  // the previous step's scroll position (fixed navbar offset included).
  useEffect(() => {
    formTopRef.current?.scrollIntoView({ block: 'start', behavior: 'auto' });
  }, [step]);
  const isGoldOnlyService = GOLD_ONLY_SERVICES.includes(form.service);
  const canBookGoldService = !isGoldOnlyService || isGold;

  function set(key: string, val: string) {
    setForm(f => ({ ...f, [key]: val }));
  }

  /** Picking a service auto-fills the matching property type (still editable). */
  function selectService(name: string) {
    const info = serviceInfo(name);
    setForm(f => ({ ...f, service: name, propertyType: info ? info.propertyType : f.propertyType }));
  }

  const [location, setLocation] = useState<LocationValue>(EMPTY_LOCATION);

  /** PSGC dropdowns sync the city/barangay booking fields. */
  function handleLocation(v: LocationValue) {
    setLocation(v);
    setForm(f => ({ ...f, city: v.city, barangay: v.barangay }));
  }

  function nextStep() {
    if (!user) {
      setAuthPromptOpen(true);
      return;
    }
    const next = STEPS[stepIndex + 1];
    if (next) setStep(next);
  }

  function prevStep() {
    const prev = STEPS[stepIndex - 1];
    if (prev) setStep(prev);
  }

  function canProceed() {
    if (step === 'service') return !!form.service && canBookGoldService;
    if (step === 'details') return !!(form.name && form.email && form.phone && form.address && form.city && form.barangay && form.propertyType && form.date);
    return true;
  }

  async function handleSubmit() {
    if (!user) {
      setAuthPromptOpen(true);
      return;
    }
    const id = genBookingId();
    const wantsUrgent = isGold && urgent;
    const booking: Booking = {
      id,
      customerId: user?.id || 'guest',
      customerName: form.name,
      customerEmail: form.email,
      customerPhone: form.phone,
      service: form.service,
      status: 'awaiting_review',
      date: form.date,
      time: form.time,
      address: form.barangay ? `${form.address}, Brgy. ${form.barangay}` : form.address,
      city: form.city,
      propertyType: form.propertyType,
      bedrooms: parseInt(form.bedrooms),
      bathrooms: parseInt(form.bathrooms),
      size: form.size,
      frequency: form.frequency,
      specialRequests: wantsUrgent ? `[URGENT REQUEST] ${form.specialRequests}`.trim() : form.specialRequests,
      fragrance: form.fragrance,
      allergies: form.allergies,
      accessInstructions: form.accessInstructions,
      cleanerId: null,
      cleanerNotes: '',
      beforePhotos: [],
      progressPhotos: [],
      afterPhotos: [],
      timeline: [{
        id: genId('tl'),
        event: 'Booking Submitted',
        note: `Your booking has been received and is pending review.${memberTier ? ` ${TIER_NAMES[memberTier]} member rate (${memberDiscount}% off) applied.` : ''}${wantsUrgent ? ' Flagged as URGENT — operations team will respond first.' : ''}`,
        timestamp: new Date().toISOString(),
        actor: 'System',
      }],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      priority: priorityForTier(memberTier, wantsUrgent),
      memberTier,
      discountPercent: memberDiscount,
    };
    // Persist to the database (best-effort) — falls back to local-only.
    if (isUuid(user?.id)) {
      const { error } = await insertBookingRow({ ...booking, customerId: user!.id });
      if (error) {
        console.error('[Booking] Database insert failed, keeping local copy:', error.message);
        toast.error(
          'Booking Saved Locally Only',
          `Could not save to the database (${error.message}). Your booking is kept on this device — please contact support with reference ${id}.`
        );
      }
    }
    dispatch({ type: 'ADD_BOOKING', payload: booking });
    if (user) {
      await saveNotification(dispatch, {
        userId: user.id,
        title: `Booking Received — ${id}`,
        message: `Your ${form.service} booking for ${form.date} has been submitted. Reference: ${id}.${wantsUrgent ? ' Flagged as URGENT.' : ''}${memberTier ? ` ${memberDiscount}% member rate applied.` : ''}`,
        link: '/portal/customer',
      });
    }
    
    // Show success toast
    toast.success(
      'Booking Confirmed!',
      `Your ${form.service} appointment for ${form.date} has been submitted.${wantsUrgent ? ' Urgent request flagged.' : ''}`
    );
    
    setBookingRef(id);
  }

  function copyRef() {
    if (bookingRef) {
      navigator.clipboard.writeText(bookingRef);
      setCopied(true);
      toast.success('Copied!', 'Booking reference copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    }
  }

  if (bookingRef) {
    return (
      <div className="pt-16 min-h-screen bg-navy-950 flex items-center justify-center px-6">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-400/10 border border-emerald-400/30 flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 size={28} className="text-emerald-400" />
          </div>
          <h1 className="font-serif text-3xl text-cream-100 mb-3">Booking Submitted</h1>
          <p className="text-cream-300 text-sm mb-6">
            Your {form.service} booking for <strong className="text-cream-100">{new Date(form.date + 'T00:00:00').toLocaleDateString('en-CA', { month: 'long', day: 'numeric', year: 'numeric' })}</strong> has been received.
          </p>
          <div className="bg-navy-800 border border-gold-400/20 rounded-xl px-6 py-5 mb-6">
            <div className="text-xs text-cream-300/70 uppercase tracking-wider mb-1">Booking Reference</div>
            <div className="flex items-center justify-center gap-3">
              <span className="font-serif text-2xl text-gold-400 font-semibold">{bookingRef}</span>
              <button onClick={copyRef} className="text-cream-300 hover:text-cream-100 transition-colors">
                <Copy size={14} />
              </button>
            </div>
            {copied && <div className="text-xs text-emerald-400 mt-1">Copied!</div>}
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs text-cream-300 justify-center">
              <div className="w-1.5 h-1.5 rounded-full bg-yellow-400" />Status: <span className="text-yellow-400 font-medium">Awaiting Review</span>
            </div>
            <p className="text-xs text-cream-300">Our team will review your booking request and get back to you shortly.</p>
          </div>
          <div className="flex gap-3 mt-8 justify-center">
            {user ? (
              <Link to="/portal/customer" className="flex items-center gap-2 bg-gold-400 hover:bg-gold-300 text-navy-950 text-sm font-semibold px-6 py-2.5 rounded-lg transition-colors">
                View in Portal <ArrowRight size={14} />
              </Link>
            ) : (
              <Link to="/login" className="flex items-center gap-2 bg-gold-400 hover:bg-gold-300 text-navy-950 text-sm font-semibold px-6 py-2.5 rounded-lg transition-colors">
                Create Account to Track <ArrowRight size={14} />
              </Link>
            )}
            <Link to="/" className="border border-gold-400/25 text-cream-100 text-sm px-6 py-2.5 rounded-lg hover:border-gold-400/50 transition-colors">
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-16 min-h-screen bg-navy-950">
      <AuthPromptModal open={authPromptOpen} onClose={() => setAuthPromptOpen(false)} redirectAfterLogin="/book" />
      <section className="py-12 bg-navy-900 border-b border-gold-400/10">
        <div className="max-w-3xl mx-auto px-6">
          <div className="text-xs text-gold-400 tracking-[0.2em] uppercase font-medium mb-2">Online Booking</div>
          <h1 className="font-serif text-4xl text-cream-100">Book a Service</h1>
        </div>
      </section>

      {/* Progress */}
      <div className="bg-navy-800 border-b border-gold-400/10">
        <div className="max-w-3xl mx-auto px-6 py-4">
          <div className="flex items-center gap-2">
            {STEPS.map((s, i) => (
              <div key={s} className="flex items-center gap-2 flex-1">
                <div className={`flex items-center gap-2 ${i <= stepIndex ? 'text-gold-400' : 'text-cream-300/40'}`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${
                    i < stepIndex ? 'bg-gold-400 text-navy-950'
                    : i === stepIndex ? 'bg-gold-400/20 border border-gold-400 text-gold-400'
                    : 'bg-navy-700 border border-cream-300/20 text-cream-300/40'
                  }`}>
                    {i < stepIndex ? <CheckCircle2 size={12} /> : i + 1}
                  </div>
                  <span className="hidden md:block text-xs font-medium">{STEP_LABELS[i]}</span>
                </div>
                {i < STEPS.length - 1 && <div className={`flex-1 h-px mx-1 ${i < stepIndex ? 'bg-gold-400/40' : 'bg-cream-300/10'}`} />}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div ref={formTopRef} className="max-w-3xl mx-auto px-6 py-10 min-h-[42rem] scroll-mt-20">
        {/* Step 1: Service */}
        {step === 'service' && (
          <div>
            <h2 className="font-serif text-2xl text-cream-100 mb-6">Select a Service</h2>
            {memberTier && (
              <div className="flex items-center gap-2 bg-gold-400/10 border border-gold-400/25 rounded-xl px-4 py-3 mb-5 text-sm">
                <Crown size={15} className="text-gold-400 shrink-0" />
                <span className="text-cream-200">
                  <strong className="text-gold-400">{TIER_NAMES[memberTier]} member</strong> — {memberDiscount}% member rate auto-applied + priority queue.
                </span>
              </div>
            )}
            <div className="grid md:grid-cols-2 gap-3 mb-8">
              {SERVICE_CATALOG.map(info => {
                const locked = !!info.goldOnly && !isGold;
                const selected = form.service === info.name;
                const price = memberTier ? memberPrice(info.price, memberTier) : info.price;
                return (
                  <button
                    key={info.name}
                    disabled={locked}
                    onClick={() => selectService(info.name)}
                    className={`text-left p-5 rounded-xl border transition-all ${
                      locked
                        ? 'bg-navy-800/60 border-gold-400/10 opacity-60 cursor-not-allowed'
                        : selected
                        ? 'bg-gold-400/10 border-gold-400/50 ring-1 ring-gold-400/30'
                        : 'bg-navy-800 border-gold-400/10 hover:border-gold-400/30'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className={`flex items-center gap-2 text-sm font-medium ${selected && !locked ? 'text-gold-400' : 'text-cream-100'}`}>
                        {locked && <Lock size={13} className="text-gold-400 shrink-0" />}
                        {info.name}
                      </div>
                      <div className="text-xs font-semibold text-gold-400 whitespace-nowrap">
                        {memberTier && price !== info.price ? (
                          <><span className="text-cream-300/60 line-through font-normal mr-1">{formatPeso(info.price)}</span>{formatPeso(price)}</>
                        ) : (
                          <>from {formatPeso(info.price)}</>
                        )}
                      </div>
                    </div>
                    <div className="text-xs text-cream-300 mt-1.5 leading-relaxed">{info.description}</div>
                    <div className="text-[11px] mt-1.5">
                      {locked ? (
                        <span className="inline-flex items-center gap-1 text-gold-400"><Crown size={11} /> Gold-exclusive — Gold membership required</span>
                      ) : info.goldOnly ? (
                        <span className="inline-flex items-center gap-1 text-gold-400"><Crown size={11} /> Gold-exclusive service</span>
                      ) : (
                        <span className="text-cream-300/60">Best for: {info.propertyType} properties</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 2: Details */}
        {step === 'details' && (
          <div>
            <h2 className="font-serif text-2xl text-cream-100 mb-6">Property & Contact Details</h2>
            <div className="space-y-4">
              {user && (
                <div className="bg-gold-400/10 border border-gold-400/25 rounded-xl p-4">
                  <div className="text-xs text-gold-400 uppercase tracking-wider font-medium mb-2">Personal Information</div>
                  <div className="grid sm:grid-cols-3 gap-3 text-sm">
                    <div><div className="text-xs text-cream-300/70">Name</div><div className="text-cream-100">{form.name}</div></div>
                    <div><div className="text-xs text-cream-300/70">Email</div><div className="text-cream-100 break-words">{form.email}</div></div>
                    <div><div className="text-xs text-cream-300/70">Phone</div><div className="text-cream-100">{form.phone}</div></div>
                  </div>
                  <div className="text-xs text-cream-300/70 mt-3">These details are taken from your profile and shared with the cleaning team for this booking.</div>
                </div>
              )}
              {!user && (
                <div className="grid md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs text-cream-300 mb-1.5">Your Name *</label>
                    <input required value={form.name} onChange={e => set('name', e.target.value)} className="w-full bg-navy-800 border border-gold-400/15 rounded-lg px-4 py-2.5 text-sm text-cream-100 focus:outline-none focus:border-gold-400/40" />
                  </div>
                  <div>
                    <label className="block text-xs text-cream-300 mb-1.5">Email *</label>
                    <input required type="email" value={form.email} onChange={e => set('email', e.target.value)} className="w-full bg-navy-800 border border-gold-400/15 rounded-lg px-4 py-2.5 text-sm text-cream-100 focus:outline-none focus:border-gold-400/40" />
                  </div>
                  <div>
                    <label className="block text-xs text-cream-300 mb-1.5">Phone *</label>
                    <input required value={form.phone} onChange={e => set('phone', e.target.value)} className="w-full bg-navy-800 border border-gold-400/15 rounded-lg px-4 py-2.5 text-sm text-cream-100 focus:outline-none focus:border-gold-400/40" />
                  </div>
                </div>
              )}
              <div>
                <label className="block text-xs text-cream-300 mb-1.5">Street / Building Address *</label>
                <input required value={form.address} onChange={e => set('address', e.target.value)} className="w-full bg-navy-800 border border-gold-400/15 rounded-lg px-4 py-2.5 text-sm text-cream-100 focus:outline-none focus:border-gold-400/40" placeholder="123 Main St, Unit 4" />
              </div>
              <LocationSelect value={location} onChange={handleLocation} required tone="navy800" />
              <div className="grid md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs text-cream-300 mb-1.5">Property Type *</label>
                  <select required value={form.propertyType} onChange={e => set('propertyType', e.target.value)} className="w-full bg-navy-800 border border-gold-400/15 rounded-lg px-4 py-2.5 text-sm text-cream-100 focus:outline-none focus:border-gold-400/40">
                    <option value="">Select</option>
                    {PROPERTY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <p className="text-[11px] text-cream-300/50 mt-1">Auto-selected from service — change if needed.</p>
                </div>
                <div>
                  <label className="block text-xs text-cream-300 mb-1.5">Bedrooms</label>
                  <select value={form.bedrooms} onChange={e => set('bedrooms', e.target.value)} className="w-full bg-navy-800 border border-gold-400/15 rounded-lg px-4 py-2.5 text-sm text-cream-100 focus:outline-none focus:border-gold-400/40">
                    {['1', '2', '3', '4', '5', '5+'].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-cream-300 mb-1.5">Bathrooms</label>
                  <select value={form.bathrooms} onChange={e => set('bathrooms', e.target.value)} className="w-full bg-navy-800 border border-gold-400/15 rounded-lg px-4 py-2.5 text-sm text-cream-100 focus:outline-none focus:border-gold-400/40">
                    {['1', '2', '3', '4', '5+'].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-cream-300 mb-1.5">Approx. Size</label>
                  <input value={form.size} onChange={e => set('size', e.target.value)} placeholder="e.g. 1,200 sq ft" className="w-full bg-navy-800 border border-gold-400/15 rounded-lg px-4 py-2.5 text-sm text-cream-100 focus:outline-none focus:border-gold-400/40" />
                </div>
              </div>
              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <label className="flex items-center gap-1.5 text-xs text-cream-300 mb-1.5">
                    <CalendarDays size={13} className="text-gold-400" />
                    Preferred Date *
                  </label>
                  <input required type="date" min={new Date().toISOString().split('T')[0]} value={form.date} onChange={e => set('date', e.target.value)} className="w-full bg-navy-800 border border-gold-400/15 rounded-lg px-4 py-2.5 text-sm text-cream-100 focus:outline-none focus:border-gold-400/40" />
                </div>
                <div>
                  <label className="block text-xs text-cream-300 mb-1.5">Preferred Time</label>
                  <select value={form.time} onChange={e => set('time', e.target.value)} className="w-full bg-navy-800 border border-gold-400/15 rounded-lg px-4 py-2.5 text-sm text-cream-100 focus:outline-none focus:border-gold-400/40">
                    {['07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00'].map(t => (
                      <option key={t} value={t}>{parseInt(t) > 12 ? `${parseInt(t) - 12}:00 PM` : `${parseInt(t)}:00 AM`}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-cream-300 mb-1.5">Frequency</label>
                  <select value={form.frequency} onChange={e => set('frequency', e.target.value)} className="w-full bg-navy-800 border border-gold-400/15 rounded-lg px-4 py-2.5 text-sm text-cream-100 focus:outline-none focus:border-gold-400/40">
                    {FREQUENCIES.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
              </div>
              {isGold && (
                <button
                  type="button"
                  onClick={() => setUrgent(u => !u)}
                  className={`w-full flex items-start gap-3 text-left rounded-xl border p-4 transition-all ${
                    urgent ? 'bg-red-400/10 border-red-400/50 ring-1 ring-red-400/30' : 'bg-navy-800 border-gold-400/15 hover:border-gold-400/40'
                  }`}
                >
                  <span className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${urgent ? 'bg-red-400 border-red-400 text-navy-950' : 'border-gold-400/30 text-transparent'}`}>
                    <CheckCircle2 size={13} />
                  </span>
                  <span>
                    <span className="flex items-center gap-1.5 text-sm font-semibold text-cream-100">
                      <Zap size={13} className="text-red-400" /> Urgent request — same-day / next-day
                    </span>
                    <span className="block text-xs text-cream-300 mt-1">
                      Gold benefit: your booking jumps to the front of the operations queue. Subject to availability — the team responds first to urgent requests.
                    </span>
                  </span>
                </button>
              )}
              {memberTier && (
                <div className="text-xs text-cream-300 bg-gold-400/5 border border-gold-400/15 rounded-lg px-4 py-2.5">
                  <strong className="text-gold-400">{TIER_NAMES[memberTier]} member rate ({memberDiscount}% off)</strong> will be auto-applied to this booking.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 3: Preferences */}
        {step === 'preferences' && (
          <div>
            <h2 className="font-serif text-2xl text-cream-100 mb-6">Preferences & Special Instructions</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-cream-300 mb-1.5">Specific Areas Requiring Attention</label>
                <textarea rows={3} value={form.specialRequests} onChange={e => set('specialRequests', e.target.value)} placeholder="e.g. Focus on kitchen appliances, grout in bathrooms, ceiling fans..." className="w-full bg-navy-800 border border-gold-400/15 rounded-lg px-4 py-2.5 text-sm text-cream-100 focus:outline-none focus:border-gold-400/40 resize-none" />
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-cream-300 mb-1.5">Fragrance Preference</label>
                  <select value={form.fragrance} onChange={e => set('fragrance', e.target.value)} className="w-full bg-navy-800 border border-gold-400/15 rounded-lg px-4 py-2.5 text-sm text-cream-100 focus:outline-none focus:border-gold-400/40">
                    {FRAGRANCES.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-cream-300 mb-1.5">Allergies / Sensitivities</label>
                  <input value={form.allergies} onChange={e => set('allergies', e.target.value)} placeholder="e.g. Nut-based products, strong fragrances" className="w-full bg-navy-800 border border-gold-400/15 rounded-lg px-4 py-2.5 text-sm text-cream-100 focus:outline-none focus:border-gold-400/40" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-cream-300 mb-1.5">Access / Parking Instructions</label>
                <textarea rows={2} value={form.accessInstructions} onChange={e => set('accessInstructions', e.target.value)} placeholder="e.g. Concierge will provide key. Unit 1204. Visitor parking available in P1." className="w-full bg-navy-800 border border-gold-400/15 rounded-lg px-4 py-2.5 text-sm text-cream-100 focus:outline-none focus:border-gold-400/40 resize-none" />
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Review */}
        {step === 'confirm' && (
          <div>
            <h2 className="font-serif text-2xl text-cream-100 mb-6">Review & Confirm</h2>
            <div className="bg-navy-800 border border-gold-400/15 rounded-xl p-6 mb-6 space-y-4">
              {[
                { label: 'Service', value: form.service },
                { label: 'Estimated price', value: (() => {
                  const info = serviceInfo(form.service);
                  if (!info) return 'To be quoted';
                  const final = memberTier ? memberPrice(info.price, memberTier) : info.price;
                  return memberTier && final !== info.price
                    ? `${formatPeso(info.price)} → ${formatPeso(final)} (${TIER_NAMES[memberTier]} ${memberDiscount}% off, mock rate)`
                    : `${formatPeso(final)} starting (mock rate)`;
                })() },
                { label: 'Date & Time', value: `${new Date(form.date + 'T00:00:00').toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })} at ${parseInt(form.time) > 12 ? `${parseInt(form.time) - 12}:00 PM` : `${parseInt(form.time)}:00 AM`}` },
                { label: 'Address', value: `${form.address}, ${form.city}` },
                { label: 'Property', value: `${form.propertyType} · ${form.bedrooms} bed / ${form.bathrooms} bath${form.size ? ` · ${form.size}` : ''}` },
                { label: 'Frequency', value: form.frequency },
                { label: 'Fragrance', value: form.fragrance },
                ...(memberTier ? [{ label: 'Member rate', value: `${TIER_NAMES[memberTier]} — ${memberDiscount}% off auto-applied`} ] : []),
                ...(isGold && urgent ? [{ label: 'Request type', value: 'URGENT — same-day / next-day (subject to availability)' }] : []),
                ...(form.allergies ? [{ label: 'Allergies', value: form.allergies }] : []),
                ...(form.specialRequests ? [{ label: 'Special Requests', value: form.specialRequests }] : []),
                ...(form.accessInstructions ? [{ label: 'Access', value: form.accessInstructions }] : []),
              ].map(row => (
                <div key={row.label} className="flex gap-4">
                  <div className="text-xs text-cream-300/70 w-28 shrink-0 mt-0.5">{row.label}</div>
                  <div className="text-sm text-cream-100">{row.value}</div>
                </div>
              ))}
            </div>
            {!user && (
              <div className="bg-navy-700 border border-gold-400/15 rounded-xl p-4 mb-5 text-sm text-cream-200">
                <strong className="text-gold-400">Tip:</strong> <Link to="/login" className="text-gold-400 underline">Create an account</Link> to track your booking status in real-time with photo updates.
              </div>
            )}
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8">
          {stepIndex > 0 ? (
            <button onClick={prevStep} className="flex items-center gap-2 text-sm text-cream-200 hover:text-cream-50 border border-gold-400/20 hover:border-gold-400/40 px-5 py-2.5 rounded-lg transition-colors">
              <ArrowLeft size={14} />Back
            </button>
          ) : <div />}

          {step === 'confirm' ? (
            <button
              onClick={handleSubmit}
              className="flex items-center gap-2 bg-gold-400 hover:bg-gold-300 text-navy-950 font-semibold px-8 py-3 rounded-lg transition-colors"
            >
              Confirm Booking <CheckCircle2 size={15} />
            </button>
          ) : (
            <button
              onClick={nextStep}
              disabled={!canProceed()}
              className="flex items-center gap-2 bg-gold-400 hover:bg-gold-300 text-navy-950 font-semibold px-8 py-3 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Continue <ArrowRight size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
