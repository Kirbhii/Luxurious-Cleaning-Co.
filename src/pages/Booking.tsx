import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { ArrowRight, ArrowLeft, CheckCircle2, Copy, CalendarDays } from 'lucide-react';
import { useStore, useCurrentUser, genId, genBookingId } from '../store';
import type { Booking } from '../store';

const SERVICES = [
  'Residential Cleaning', 'Deep Cleaning', 'Move-In / Move-Out Cleaning',
  'Post-Construction Cleaning', 'Commercial Cleaning', 'Condo Cleaning',
  'Office Cleaning', 'Specialized Cleaning',
];

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

  const [step, setStep] = useState<Step>('service');
  const [bookingRef, setBookingRef] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [form, setForm] = useState({
    service: searchParams.get('service') || '',
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    address: '',
    city: '',
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

  function set(key: string, val: string) {
    setForm(f => ({ ...f, [key]: val }));
  }

  function nextStep() {
    const next = STEPS[stepIndex + 1];
    if (next) setStep(next);
  }

  function prevStep() {
    const prev = STEPS[stepIndex - 1];
    if (prev) setStep(prev);
  }

  function canProceed() {
    if (step === 'service') return !!form.service;
    if (step === 'details') return !!(form.name && form.email && form.phone && form.address && form.city && form.propertyType && form.date);
    return true;
  }

  function handleSubmit() {
    const id = genBookingId();
    const booking: Booking = {
      id,
      customerId: user?.id || 'guest',
      customerName: form.name,
      customerEmail: form.email,
      customerPhone: form.phone,
      service: form.service,
      status: 'pending',
      date: form.date,
      time: form.time,
      address: form.address,
      city: form.city,
      propertyType: form.propertyType,
      bedrooms: parseInt(form.bedrooms),
      bathrooms: parseInt(form.bathrooms),
      size: form.size,
      frequency: form.frequency,
      specialRequests: form.specialRequests,
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
        note: 'Your booking has been received and is pending review.',
        timestamp: new Date().toISOString(),
        actor: 'System',
      }],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    dispatch({ type: 'ADD_BOOKING', payload: booking });
    if (user) {
      dispatch({
        type: 'ADD_NOTIFICATION',
        payload: {
          id: genId('n'),
          userId: user.id,
          title: `Booking Received — ${id}`,
          message: `Your ${form.service} booking for ${form.date} has been submitted. Reference: ${id}`,
          read: false,
          link: '/portal/customer',
          createdAt: new Date().toISOString(),
        },
      });
    }
    setBookingRef(id);
  }

  function copyRef() {
    if (bookingRef) {
      navigator.clipboard.writeText(bookingRef);
      setCopied(true);
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
              <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />Status: <span className="text-amber-400 font-medium">Pending Review</span>
            </div>
            <p className="text-xs text-cream-300">We will confirm your booking within a few hours and assign a cleaner.</p>
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

      <div className="max-w-3xl mx-auto px-6 py-10 min-h-[42rem]">
        {/* Step 1: Service */}
        {step === 'service' && (
          <div>
            <h2 className="font-serif text-2xl text-cream-100 mb-6">Select a Service</h2>
            <div className="grid md:grid-cols-2 gap-3 mb-8">
              {SERVICES.map(s => (
                <button
                  key={s}
                  onClick={() => set('service', s)}
                  className={`text-left p-5 rounded-xl border transition-all ${
                    form.service === s
                      ? 'bg-gold-400/10 border-gold-400/50 ring-1 ring-gold-400/30'
                      : 'bg-navy-800 border-gold-400/10 hover:border-gold-400/30'
                  }`}
                >
                  <div className={`text-sm font-medium ${form.service === s ? 'text-gold-400' : 'text-cream-100'}`}>{s}</div>
                </button>
              ))}
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
              <div className="grid md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs text-cream-300 mb-1.5">Property Address *</label>
                  <input required value={form.address} onChange={e => set('address', e.target.value)} className="w-full bg-navy-800 border border-gold-400/15 rounded-lg px-4 py-2.5 text-sm text-cream-100 focus:outline-none focus:border-gold-400/40" placeholder="123 Main St, Unit 4" />
                </div>
                <div>
                  <label className="block text-xs text-cream-300 mb-1.5">City *</label>
                  <input required value={form.city} onChange={e => set('city', e.target.value)} className="w-full bg-navy-800 border border-gold-400/15 rounded-lg px-4 py-2.5 text-sm text-cream-100 focus:outline-none focus:border-gold-400/40" placeholder="Toronto, ON" />
                </div>
              </div>
              <div className="grid md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs text-cream-300 mb-1.5">Property Type *</label>
                  <select required value={form.propertyType} onChange={e => set('propertyType', e.target.value)} className="w-full bg-navy-800 border border-gold-400/15 rounded-lg px-4 py-2.5 text-sm text-cream-100 focus:outline-none focus:border-gold-400/40">
                    <option value="">Select</option>
                    {PROPERTY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
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
                { label: 'Date & Time', value: `${new Date(form.date + 'T00:00:00').toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })} at ${parseInt(form.time) > 12 ? `${parseInt(form.time) - 12}:00 PM` : `${parseInt(form.time)}:00 AM`}` },
                { label: 'Address', value: `${form.address}, ${form.city}` },
                { label: 'Property', value: `${form.propertyType} · ${form.bedrooms} bed / ${form.bathrooms} bath${form.size ? ` · ${form.size}` : ''}` },
                { label: 'Frequency', value: form.frequency },
                { label: 'Fragrance', value: form.fragrance },
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
