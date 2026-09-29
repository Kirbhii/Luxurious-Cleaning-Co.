import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, ArrowRight, Crown, Zap, X, CreditCard, User, Mail, Phone, MapPin, Building2 } from 'lucide-react';
import { useStore, useCurrentUser, type MembershipTier } from '../store';
import { useToast } from '../components/ToastContainer';
import ConfirmModal from '../components/ConfirmModal';
import AuthPromptModal from '../components/AuthPromptModal';
import { TIER_PERKS, TIER_PRICE, formatPeso } from '../lib/membership';
import { activateMembership, isUuid } from '../lib/supabase';
import LocationSelect, { EMPTY_LOCATION } from '../components/LocationSelect';
import type { LocationValue } from '../components/LocationSelect';

interface MembershipForm {
  fullName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  barangay: string;
  postalCode: string;
  cardNumber: string;
  cardExpiry: string;
  cardCvc: string;
  cardName: string;
  billingAddress: string;
  agreedToTerms: boolean;
}

const TIERS = [
  {
    id: 'bronze' as MembershipTier,
    name: 'Bronze',
    badge: 'bg-amber-600/20 text-amber-400 border-amber-600/30',
    card: 'border-amber-600/25 bg-gradient-to-br from-amber-900/30 to-amber-800/10',
    glow: '',
    perks: TIER_PERKS.bronze,
  },
  {
    id: 'silver' as MembershipTier,
    name: 'Silver',
    badge: 'bg-slate-500/20 text-slate-300 border-slate-400/30',
    card: 'border-slate-400/30 bg-gradient-to-br from-slate-700/30 to-slate-600/10',
    glow: '',
    perks: TIER_PERKS.silver,
  },
  {
    id: 'gold' as MembershipTier,
    name: 'Gold',
    badge: 'bg-gold-400/20 text-gold-300 border-gold-400/30',
    card: 'border-gold-400/35 bg-gradient-to-br from-gold-600/20 to-gold-500/5',
    glow: 'ring-1 ring-gold-400/20',
    popular: true,
    perks: TIER_PERKS.gold,
  },
];

export default function Membership() {
  const { dispatch } = useStore();
  const user = useCurrentUser();
  const toast = useToast();
  const [applying, setApplying] = useState<MembershipTier | null>(null);
  const [success, setSuccess] = useState<MembershipTier | null>(null);
  const [showForm, setShowForm] = useState<MembershipTier | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [authPromptOpen, setAuthPromptOpen] = useState(false);
  const [confirmTier, setConfirmTier] = useState<MembershipTier | null>(null);
  
  const [form, setForm] = useState<MembershipForm>({
    fullName: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    address: '',
    city: '',
    barangay: '',
    postalCode: '',
    cardNumber: '',
    cardExpiry: '',
    cardCvc: '',
    cardName: '',
    billingAddress: '',
    agreedToTerms: false,
  });
  const [errors, setErrors] = useState<Partial<Record<keyof MembershipForm, string>>>({});
  const [location, setLocation] = useState<LocationValue>(EMPTY_LOCATION);

  /** PSGC dropdowns sync the city/barangay fields (and clear their errors). */
  function handleLocation(v: LocationValue) {
    setLocation(v);
    setForm(f => ({ ...f, city: v.city, barangay: v.barangay }));
    setErrors(prev => {
      const next = { ...prev };
      delete next.city;
      delete next.barangay;
      return next;
    });
  }

  function setField(key: keyof MembershipForm, value: string | boolean) {
    let v = value;
    // Auto-format payment fields as the user types (mock formatting only)
    if (typeof v === 'string') {
      if (key === 'cardNumber') v = v.replace(/\D/g, '').slice(0, 19).replace(/(\d{4})(?=\d)/g, '$1 ');
      if (key === 'cardExpiry') {
        const d = v.replace(/\D/g, '').slice(0, 4);
        v = d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
      }
      if (key === 'cardCvc') v = v.replace(/\D/g, '').slice(0, 4);
    }
    const finalValue = v;
    setForm(f => ({ ...f, [key]: finalValue }));
    // Clear the error for this field as soon as the user fixes it
    setErrors(prev => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function validateForm(): boolean {
    const next: Partial<Record<keyof MembershipForm, string>> = {};

    if (!form.fullName.trim()) next.fullName = 'Full name is required.';
    if (!form.email.trim()) next.email = 'Email is required.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) next.email = 'Enter a valid email address.';
    if (!form.phone.trim()) next.phone = 'Phone is required.';
    else if (form.phone.replace(/\D/g, '').length < 7) next.phone = 'Enter a valid phone number.';
    if (!form.address.trim()) next.address = 'Street address is required.';
    if (!form.city.trim()) next.city = 'Please select a city / municipality.';
    if (!form.barangay.trim()) next.barangay = 'Please select a barangay.';
    if (!form.postalCode.trim()) next.postalCode = 'ZIP code is required.';

    const cardDigits = form.cardNumber.replace(/\D/g, '');
    if (!form.cardNumber.trim()) next.cardNumber = 'Card number is required.';
    else if (cardDigits.length < 12 || cardDigits.length > 19) next.cardNumber = 'Enter a valid card number.';
    if (!form.cardName.trim()) next.cardName = 'Cardholder name is required.';
    if (!form.cardExpiry.trim()) next.cardExpiry = 'Expiry date is required.';
    else if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(form.cardExpiry.trim())) next.cardExpiry = 'Use MM/YY format.';
    if (!form.cardCvc.trim()) next.cardCvc = 'CVC is required.';
    else if (!/^\d{3,4}$/.test(form.cardCvc.trim())) next.cardCvc = 'Enter a 3–4 digit CVC.';
    if (!form.agreedToTerms) next.agreedToTerms = 'You must agree to the terms to continue.';

    setErrors(next);

    if (Object.keys(next).length > 0) {
      const firstError = Object.values(next)[0] as string;
      toast.error('Missing Required Fields', firstError);
      return false;
    }
    return true;
  }

  function openApplicationForm(tier: MembershipTier) {
    if (!user) {
      setAuthPromptOpen(true);
      return;
    }
    setShowForm(tier);
    setErrors({});
    setLocation(EMPTY_LOCATION);
    // Pre-fill with user data
    setForm(f => ({
      ...f,
      fullName: user.name,
      email: user.email,
      phone: user.phone || '',
    }));
  }

  function handleSubmit(e: React.FormEvent, tier: MembershipTier) {
    e.preventDefault();

    // Strict validation — blank required fields block submission
    if (!validateForm()) {
      return;
    }

    setConfirmTier(tier);
  }

  function confirmMembershipSubmit(tier: MembershipTier) {
    setConfirmTier(null);
    setSubmitting(true);

    // Simulate API call
    setTimeout(async () => {
      dispatch({
        type: 'UPDATE_USER_MEMBERSHIP',
        payload: { userId: user!.id, tier, status: 'active' }
      });

      // Persist to the profile so the membership survives reloads.
      // It stays active until the user cancels from the customer portal.
      // membership_tier/status are server-authoritative (migration 007): the
      // client calls a SECURITY DEFINER function instead of writing the columns.
      if (isUuid(user!.id)) {
        const { error } = await activateMembership(tier);
        if (error) {
          console.error('[Membership] Profile sync failed, keeping local copy:', error.message);
          toast.error('Sync Warning', 'Membership is active on this device but profile sync failed — it may not persist after reload.');
        }
      }

      setSubmitting(false);
      setShowForm(null);
      setSuccess(tier);
      
      toast.success(
        `Welcome to ${tier.charAt(0).toUpperCase() + tier.slice(1)} Membership!`,
        'Your membership has been activated successfully.'
      );

      // Reset form
      setLocation(EMPTY_LOCATION);
      setForm({
        fullName: user!.name,
        email: user!.email,
        phone: user!.phone || '',
        address: '',
        city: '',
        barangay: '',
        postalCode: '',
        cardNumber: '',
        cardExpiry: '',
        cardCvc: '',
        cardName: '',
        billingAddress: '',
        agreedToTerms: false,
      });
    }, 2000);
  }

  return (
    <div className="pt-16 min-h-screen bg-navy-950">
      <AuthPromptModal open={authPromptOpen} onClose={() => setAuthPromptOpen(false)} redirectAfterLogin="/membership" />
      {confirmTier && (
        <ConfirmModal
          title={`Activate ${confirmTier.charAt(0).toUpperCase() + confirmTier.slice(1)} membership?`}
          message={`${formatPeso(TIER_PRICE[confirmTier])}/month mock rate (no real charge). Your membership will be activated, stay active until you cancel it, and member benefits will apply to your account.`}
          confirmLabel="Activate"
          onConfirm={() => confirmMembershipSubmit(confirmTier)}
          onCancel={() => setConfirmTier(null)}
        />
      )}
      {/* Membership Application Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-[100] bg-navy-950/90 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 sm:p-6">
          <div className="bg-navy-800 border border-gold-400/20 rounded-2xl shadow-2xl max-w-2xl w-full m-auto animate-scale-in overflow-hidden flex flex-col max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-3rem)]">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gold-400/10 shrink-0 bg-navy-800">
              <div>
                <h3 className="font-serif text-2xl text-cream-100">
                  {showForm.charAt(0).toUpperCase() + showForm.slice(1)} Membership Application
                </h3>
                <p className="text-sm text-cream-300 mt-1">Complete your membership registration</p>
              </div>
              <button 
                onClick={() => { setShowForm(null); setErrors({}); }}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-navy-700 transition-colors"
              >
                <X size={18} className="text-cream-300" />
              </button>
            </div>

            {/* Form — scrollable body so the whole modal always fits the screen */}
            <form onSubmit={(e) => handleSubmit(e, showForm)} noValidate className="p-6 space-y-6 overflow-y-auto grow">
              {/* Personal Information */}
              <div>
                <h4 className="text-sm font-semibold text-cream-100 mb-4 flex items-center gap-2">
                  <User size={16} className="text-gold-400" />
                  Personal Information
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="col-span-1 sm:col-span-2">
                    <label className="block text-xs text-cream-300 mb-1.5">Full Name *</label>
                    <input
                      required
                      type="text"
                      value={form.fullName}
                      onChange={e => setField('fullName', e.target.value)}
                      className={`w-full bg-navy-700 border rounded-lg px-4 py-2.5 text-sm text-cream-100 focus:outline-none ${errors.fullName ? 'border-red-400/70 focus:border-red-400' : 'border-gold-400/15 focus:border-gold-400/40'}`}
                    />
                    {errors.fullName && <p className="text-red-400 text-xs mt-1">{errors.fullName}</p>}
                  </div>
                  <div>
                    <label className="block text-xs text-cream-300 mb-1.5">Email *</label>
                    <input
                      required
                      type="email"
                      value={form.email}
                      onChange={e => setField('email', e.target.value)}
                      className={`w-full bg-navy-700 border rounded-lg px-4 py-2.5 text-sm text-cream-100 focus:outline-none ${errors.email ? 'border-red-400/70 focus:border-red-400' : 'border-gold-400/15 focus:border-gold-400/40'}`}
                    />
                    {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email}</p>}
                  </div>
                  <div>
                    <label className="block text-xs text-cream-300 mb-1.5">Phone *</label>
                    <input
                      required
                      type="tel"
                      value={form.phone}
                      onChange={e => setField('phone', e.target.value)}
                      placeholder="0919 002 4136"
                      className={`w-full bg-navy-700 border rounded-lg px-4 py-2.5 text-sm text-cream-100 focus:outline-none ${errors.phone ? 'border-red-400/70 focus:border-red-400' : 'border-gold-400/15 focus:border-gold-400/40'}`}
                    />
                    {errors.phone && <p className="text-red-400 text-xs mt-1">{errors.phone}</p>}
                  </div>
                </div>
              </div>

              {/* Address Information */}
              <div>
                <h4 className="text-sm font-semibold text-cream-100 mb-4 flex items-center gap-2">
                  <MapPin size={16} className="text-gold-400" />
                  Service Address
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="col-span-1 sm:col-span-2">
                    <label className="block text-xs text-cream-300 mb-1.5">Street Address *</label>
                    <input
                      required
                      type="text"
                      value={form.address}
                      onChange={e => setField('address', e.target.value)}
                      placeholder="123 Main Street, Unit 456"
                      className={`w-full bg-navy-700 border rounded-lg px-4 py-2.5 text-sm text-cream-100 focus:outline-none ${errors.address ? 'border-red-400/70 focus:border-red-400' : 'border-gold-400/15 focus:border-gold-400/40'}`}
                    />
                    {errors.address && <p className="text-red-400 text-xs mt-1">{errors.address}</p>}
                  </div>
                  <div>
                    <label className="block text-xs text-cream-300 mb-1.5">ZIP Code *</label>
                    <input
                      required
                      type="text"
                      value={form.postalCode}
                      onChange={e => setField('postalCode', e.target.value)}
                      placeholder="1500"
                      className={`w-full bg-navy-700 border rounded-lg px-4 py-2.5 text-sm text-cream-100 focus:outline-none ${errors.postalCode ? 'border-red-400/70 focus:border-red-400' : 'border-gold-400/15 focus:border-gold-400/40'}`}
                    />
                    {errors.postalCode && <p className="text-red-400 text-xs mt-1">{errors.postalCode}</p>}
                  </div>
                </div>
                <div className="mt-4">
                  <LocationSelect
                    value={location}
                    onChange={handleLocation}
                    required
                    tone="navy700"
                    errors={{ city: errors.city, barangay: errors.barangay }}
                  />
                </div>
              </div>

              {/* Payment Information */}
              <div>
                <h4 className="text-sm font-semibold text-cream-100 mb-4 flex items-center gap-2">
                  <CreditCard size={16} className="text-gold-400" />
                  Payment Information
                </h4>
                <div className="bg-blue-400/5 border border-blue-400/20 rounded-lg px-4 py-3 mb-4">
                  <p className="text-xs text-blue-300">
                    <strong>Note:</strong> This is a mock form for demonstration. No actual payment will be processed.
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="col-span-1 sm:col-span-2">
                    <label className="block text-xs text-cream-300 mb-1.5">Card Number *</label>
                    <input
                      required
                      type="text"
                      value={form.cardNumber}
                      onChange={e => setField('cardNumber', e.target.value)}
                      placeholder="4242 4242 4242 4242"
                      maxLength={23}
                      className={`w-full bg-navy-700 border rounded-lg px-4 py-2.5 text-sm text-cream-100 focus:outline-none ${errors.cardNumber ? 'border-red-400/70 focus:border-red-400' : 'border-gold-400/15 focus:border-gold-400/40'}`}
                    />
                    {errors.cardNumber && <p className="text-red-400 text-xs mt-1">{errors.cardNumber}</p>}
                  </div>
                  <div className="col-span-1 sm:col-span-2">
                    <label className="block text-xs text-cream-300 mb-1.5">Cardholder Name *</label>
                    <input
                      required
                      type="text"
                      value={form.cardName}
                      onChange={e => setField('cardName', e.target.value)}
                      placeholder="John Doe"
                      className={`w-full bg-navy-700 border rounded-lg px-4 py-2.5 text-sm text-cream-100 focus:outline-none ${errors.cardName ? 'border-red-400/70 focus:border-red-400' : 'border-gold-400/15 focus:border-gold-400/40'}`}
                    />
                    {errors.cardName && <p className="text-red-400 text-xs mt-1">{errors.cardName}</p>}
                  </div>
                  <div>
                    <label className="block text-xs text-cream-300 mb-1.5">Expiry Date *</label>
                    <input
                      required
                      type="text"
                      value={form.cardExpiry}
                      onChange={e => setField('cardExpiry', e.target.value)}
                      placeholder="MM/YY"
                      maxLength={5}
                      className={`w-full bg-navy-700 border rounded-lg px-4 py-2.5 text-sm text-cream-100 focus:outline-none ${errors.cardExpiry ? 'border-red-400/70 focus:border-red-400' : 'border-gold-400/15 focus:border-gold-400/40'}`}
                    />
                    {errors.cardExpiry && <p className="text-red-400 text-xs mt-1">{errors.cardExpiry}</p>}
                  </div>
                  <div>
                    <label className="block text-xs text-cream-300 mb-1.5">CVC *</label>
                    <input
                      required
                      type="text"
                      value={form.cardCvc}
                      onChange={e => setField('cardCvc', e.target.value)}
                      placeholder="123"
                      maxLength={4}
                      className={`w-full bg-navy-700 border rounded-lg px-4 py-2.5 text-sm text-cream-100 focus:outline-none ${errors.cardCvc ? 'border-red-400/70 focus:border-red-400' : 'border-gold-400/15 focus:border-gold-400/40'}`}
                    />
                    {errors.cardCvc && <p className="text-red-400 text-xs mt-1">{errors.cardCvc}</p>}
                  </div>
                </div>
              </div>

              {/* Terms and Conditions */}
              <div className="pt-2">
                <div className="flex items-start gap-3">
                  <input
                    required
                    type="checkbox"
                    id="terms"
                    checked={form.agreedToTerms}
                    onChange={e => setField('agreedToTerms', e.target.checked)}
                    className="mt-1 w-4 h-4 rounded border-gold-400/30 bg-navy-700 text-gold-400 focus:ring-gold-400/40"
                  />
                  <label htmlFor="terms" className="text-xs text-cream-300 leading-relaxed">
                    I agree to the membership terms and conditions, including automatic monthly billing and the cancellation policy. I understand this is a mock registration for demonstration purposes. *
                  </label>
                </div>
                {errors.agreedToTerms && <p className="text-red-400 text-xs mt-1.5">{errors.agreedToTerms}</p>}
              </div>

              {/* Submit Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowForm(null); setErrors({}); }}
                  className="flex-1 px-4 py-3 rounded-lg border border-gold-400/20 text-cream-200 hover:bg-navy-700 transition-colors text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-gold-400 hover:bg-gold-300 text-navy-950 transition-colors text-sm font-semibold disabled:opacity-60"
                >
                  {submitting ? 'Processing...' : <>Complete Registration <ArrowRight size={14} /></>}
                </button>
              </div>
            </form>
          </div>
          </div>
        </div>
      )}
      {/* Header */}
      <section className="py-20 bg-navy-900 border-b border-gold-400/10">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <div className="text-xs text-gold-400 tracking-[0.2em] uppercase font-medium mb-3">Exclusive Access</div>
          <h1 className="font-serif text-5xl md:text-6xl text-cream-100 mb-5">Membership</h1>
          <p className="text-cream-300 text-lg max-w-xl mx-auto leading-relaxed">
            Join our membership program for priority booking, member pricing, and exclusive services designed for clients who expect more.
          </p>
        </div>
      </section>

      {/* Current status */}
      {user && user.membershipStatus === 'active' && user.membershipTier && (
        <section className="max-w-7xl mx-auto px-6 mt-10">
          <div className="bg-gold-400/10 border border-gold-400/25 rounded-xl px-6 py-4 flex items-center gap-4">
            <Crown size={20} className="text-gold-400" />
            <div>
              <span className="text-cream-100 font-medium text-sm">You are an active </span>
              <span className="capitalize text-gold-400 font-semibold text-sm">{user.membershipTier}</span>
              <span className="text-cream-100 font-medium text-sm"> member.</span>
            </div>
          </div>
        </section>
      )}

      {success && (
        <section className="max-w-7xl mx-auto px-6 mt-10">
          <div className="bg-emerald-400/10 border border-emerald-400/25 rounded-xl px-6 py-4 flex items-center gap-4">
            <CheckCircle2 size={20} className="text-emerald-400" />
            <div className="text-sm text-cream-100">
              <span className="font-semibold">Welcome to </span>
              <span className="capitalize font-semibold text-gold-400">{success} Membership!</span>
              <span> Your membership is now active.</span>
            </div>
          </div>
        </section>
      )}

      {/* Tiers */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-3 gap-7">
            {TIERS.map(tier => (
              <div key={tier.id} className={`relative border rounded-2xl p-8 ${tier.card} ${tier.glow}`}>
                {tier.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gold-400 text-navy-950 text-xs font-bold tracking-wider uppercase px-4 py-1 rounded-full">
                    Most Popular
                  </div>
                )}
                <span className={`inline-block text-xs font-semibold tracking-wider uppercase px-3 py-1 rounded-full border mb-4 ${tier.badge}`}>{tier.name}</span>
                <div className="mb-6">
                  <span className="font-serif text-4xl text-cream-100">{formatPeso(TIER_PRICE[tier.id])}</span>
                  <span className="text-sm text-cream-300"> / month</span>
                  <div className="text-[11px] text-cream-300/70 mt-0.5">Mock rate — no real charge</div>
                </div>
                <ul className="space-y-3 mb-8">
                  {tier.perks.map(perk => (
                    <li key={perk} className="flex items-start gap-2.5 text-sm text-cream-200">
                      <span className="shrink-0 mt-0.5"><CheckCircle2 size={14} className="text-gold-400" /></span>
                      {perk}
                    </li>
                  ))}
                </ul>
                {user?.membershipTier === tier.id && user.membershipStatus === 'active' ? (
                  <div className="flex items-center gap-2 text-sm text-emerald-400 font-medium">
                    <CheckCircle2 size={15} />Active Plan
                  </div>
                ) : (
                  <button
                    onClick={() => openApplicationForm(tier.id)}
                    disabled={applying === tier.id}
                    className={`w-full flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-semibold transition-colors ${
                      tier.id === 'gold'
                        ? 'bg-gold-400 hover:bg-gold-300 text-navy-950'
                        : 'border border-gold-400/30 hover:border-gold-400/60 text-cream-100'
                    } ${applying === tier.id ? 'opacity-60 cursor-not-allowed' : ''}`}
                  >
                    {applying === tier.id ? 'Activating…' : `Apply for ${tier.name}`}
                    {applying !== tier.id && <ArrowRight size={14} />}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Urgent Cleaning */}
      <section className="py-16 bg-navy-800 border-t border-gold-400/10">
        <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-2 gap-10 items-center">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Zap size={16} className="text-gold-400" />
              <span className="text-xs text-gold-400 tracking-[0.2em] uppercase font-medium">Gold Members Only</span>
            </div>
            <h2 className="font-serif text-3xl text-cream-100 mb-4">Urgent Cleaning Requests</h2>
            <p className="text-cream-300 leading-relaxed text-sm mb-6">
              Gold members get an <strong className="text-cream-100">Urgent request toggle</strong> right inside the booking flow. Flag a booking as urgent and it jumps to the front of the operations queue with a red Urgent badge admins see first. Same-day or next-day service, subject to availability.
            </p>
            <Link to="/book" className="inline-flex items-center gap-2 bg-gold-400 hover:bg-gold-300 text-navy-950 text-sm font-semibold px-6 py-3 rounded-lg transition-colors">
              Book an Urgent Cleaning <ArrowRight size={14} />
            </Link>
          </div>
          <div className="bg-navy-700 border border-gold-400/15 rounded-xl p-6">
            <div className="space-y-4">
              {['Book any service and tick Urgent request (Gold members only)', 'Your booking enters the queue flagged URGENT', 'Operations team reviews availability first — ahead of all standard bookings', 'We contact you to confirm time and details'].map((step, i) => (
                <div key={step} className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-gold-400/15 border border-gold-400/30 flex items-center justify-center shrink-0 text-xs text-gold-400 font-semibold">{i + 1}</div>
                  <span className="text-sm text-cream-200">{step}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <p className="text-cream-300 text-sm mb-4">Want to start with a one-time service before joining?</p>
          <Link to="/book" className="inline-flex items-center gap-2 border border-gold-400/30 hover:border-gold-400/60 text-cream-100 text-sm px-6 py-3 rounded-lg transition-colors">
            Book a Service <ArrowRight size={14} />
          </Link>
        </div>
      </section>
    </div>
  );
}
