import { useState } from 'react';
import { CheckCircle2, ArrowRight, Building2, Users, TrendingUp } from 'lucide-react';
import { useStore, useCurrentUser, genId } from '../store';
import type { PartnerApplication } from '../store';

const PARTNER_TYPES = [
  'Construction Companies', 'Real Estate Companies', 'Property Developers',
  'Property Managers', 'Interior Design Firms', 'Fragrance Companies',
  'Hospitality Businesses', 'Corporate Clients',
];

const INDUSTRIES = [
  'Construction', 'Real Estate', 'Property Management', 'Interior Design',
  'Hospitality', 'Fragrance / Lifestyle', 'Corporate / Office', 'Other',
];

export default function Partnerships() {
  const { state, dispatch } = useStore();
  const user = useCurrentUser();
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const existingApp = user ? state.partnerApplications.find(p => p.userId === user.id) : null;

  const [form, setForm] = useState({
    companyName: '',
    industry: '',
    contactPerson: user?.name || '',
    position: '',
    email: user?.email || '',
    phone: user?.phone || '',
    website: '',
    address: '',
    servicesRequired: '',
    estimatedVolume: '',
    proposal: '',
    additionalInfo: '',
  });

  function set(key: string, val: string) {
    setForm(f => ({ ...f, [key]: val }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      const app: PartnerApplication = {
        id: genId('pa'),
        userId: user?.id || null,
        ...form,
        status: 'submitted',
        createdAt: new Date().toISOString(),
      };
      dispatch({ type: 'SUBMIT_PARTNER_APP', payload: app });
      if (user) {
        dispatch({
          type: 'ADD_NOTIFICATION',
          payload: {
            id: genId('n'),
            userId: user.id,
            title: 'Partnership Application Received',
            message: `Your partnership application for ${form.companyName} has been submitted. We will review it within 3-5 business days.`,
            read: false,
            link: '/portal/partner',
            createdAt: new Date().toISOString(),
          },
        });
      }
      setLoading(false);
      setSubmitted(true);
    }, 1500);
  }

  return (
    <div className="pt-16 min-h-screen bg-navy-950">
      {/* Header */}
      <section className="py-20 bg-navy-900 border-b border-gold-400/10">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-xs text-gold-400 tracking-[0.2em] uppercase font-medium mb-3">B2B</div>
          <h1 className="font-serif text-5xl md:text-6xl text-cream-100 mb-5">Partnerships</h1>
          <p className="text-cream-300 text-lg max-w-xl leading-relaxed">
            A dedicated B2B program for companies that need reliable, high-quality cleaning at scale — with dedicated account management and a streamlined project submission portal.
          </p>
        </div>
      </section>

      {/* Who we partner with */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-3 gap-8 mb-14">
            {[
              { icon: Building2, title: 'Construction & Development', desc: 'Post-construction cleaning for residential towers, commercial builds, and renovation projects at any scale.' },
              { icon: Users, title: 'Real Estate & Property', desc: 'Move-in/move-out, tenant turnover, and ongoing building maintenance for real estate and property management companies.' },
              { icon: TrendingUp, title: 'Corporate & Hospitality', desc: 'Regular commercial cleaning programs for offices, hotels, boutiques, and corporate environments.' },
            ].map(item => (
              <div key={item.title} className="bg-navy-800 border border-gold-400/10 rounded-xl p-7">
                <div className="w-10 h-10 rounded-lg bg-gold-400/10 border border-gold-400/20 flex items-center justify-center mb-5">
                  <item.icon size={16} className="text-gold-400" />
                </div>
                <h3 className="font-serif text-xl text-cream-100 mb-3">{item.title}</h3>
                <p className="text-sm text-cream-300 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>

          <div className="bg-navy-800 border border-gold-400/10 rounded-2xl p-8 mb-12">
            <h3 className="font-serif text-2xl text-cream-100 mb-5">We Work With</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {PARTNER_TYPES.map(type => (
                <div key={type} className="flex items-center gap-2 text-sm text-cream-200">
                  <span className="shrink-0"><CheckCircle2 size={13} className="text-gold-400" /></span>
                  {type}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Application form */}
      <section className="py-10 pb-24">
        <div className="max-w-3xl mx-auto px-6">
          {existingApp ? (
            <div className="bg-navy-800 border border-gold-400/15 rounded-2xl p-10 text-center">
              <CheckCircle2 size={40} className="text-gold-400 mx-auto mb-4" />
              <h2 className="font-serif text-2xl text-cream-100 mb-3">Application Submitted</h2>
              <p className="text-cream-300 text-sm mb-2">
                Your application for <strong className="text-cream-100">{existingApp.companyName}</strong> is currently <span className="capitalize text-gold-400 font-medium">{existingApp.status.replace('_', ' ')}</span>.
              </p>
              <p className="text-cream-300 text-sm">We will contact you within 3–5 business days.</p>
            </div>
          ) : submitted ? (
            <div className="bg-navy-800 border border-emerald-400/25 rounded-2xl p-10 text-center">
              <CheckCircle2 size={40} className="text-emerald-400 mx-auto mb-4" />
              <h2 className="font-serif text-2xl text-cream-100 mb-3">Application Received</h2>
              <p className="text-cream-300 text-sm">Thank you for applying. Our partnerships team will review your application and respond within 3–5 business days.</p>
            </div>
          ) : (
            <>
              <div className="mb-8">
                <h2 className="font-serif text-3xl text-cream-100 mb-2">Partnership Application</h2>
                <p className="text-cream-300 text-sm">Complete the form below and our team will reach out.</p>
              </div>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-cream-300 mb-1.5">Company Name *</label>
                    <input required value={form.companyName} onChange={e => set('companyName', e.target.value)} className="w-full bg-navy-800 border border-gold-400/15 rounded-lg px-4 py-2.5 text-sm text-cream-100 placeholder-cream-300/40 focus:outline-none focus:border-gold-400/40" placeholder="Apex Construction Group" />
                  </div>
                  <div>
                    <label className="block text-xs text-cream-300 mb-1.5">Industry *</label>
                    <select required value={form.industry} onChange={e => set('industry', e.target.value)} className="w-full bg-navy-800 border border-gold-400/15 rounded-lg px-4 py-2.5 text-sm text-cream-100 focus:outline-none focus:border-gold-400/40">
                      <option value="">Select industry</option>
                      {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-cream-300 mb-1.5">Contact Person *</label>
                    <input required value={form.contactPerson} onChange={e => set('contactPerson', e.target.value)} className="w-full bg-navy-800 border border-gold-400/15 rounded-lg px-4 py-2.5 text-sm text-cream-100 placeholder-cream-300/40 focus:outline-none focus:border-gold-400/40" />
                  </div>
                  <div>
                    <label className="block text-xs text-cream-300 mb-1.5">Position / Title *</label>
                    <input required value={form.position} onChange={e => set('position', e.target.value)} className="w-full bg-navy-800 border border-gold-400/15 rounded-lg px-4 py-2.5 text-sm text-cream-100 placeholder-cream-300/40 focus:outline-none focus:border-gold-400/40" />
                  </div>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-cream-300 mb-1.5">Business Email *</label>
                    <input required type="email" value={form.email} onChange={e => set('email', e.target.value)} className="w-full bg-navy-800 border border-gold-400/15 rounded-lg px-4 py-2.5 text-sm text-cream-100 placeholder-cream-300/40 focus:outline-none focus:border-gold-400/40" />
                  </div>
                  <div>
                    <label className="block text-xs text-cream-300 mb-1.5">Phone *</label>
                    <input required value={form.phone} onChange={e => set('phone', e.target.value)} className="w-full bg-navy-800 border border-gold-400/15 rounded-lg px-4 py-2.5 text-sm text-cream-100 placeholder-cream-300/40 focus:outline-none focus:border-gold-400/40" />
                  </div>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-cream-300 mb-1.5">Website</label>
                    <input value={form.website} onChange={e => set('website', e.target.value)} className="w-full bg-navy-800 border border-gold-400/15 rounded-lg px-4 py-2.5 text-sm text-cream-100 placeholder-cream-300/40 focus:outline-none focus:border-gold-400/40" placeholder="https://" />
                  </div>
                  <div>
                    <label className="block text-xs text-cream-300 mb-1.5">Company Address *</label>
                    <input required value={form.address} onChange={e => set('address', e.target.value)} className="w-full bg-navy-800 border border-gold-400/15 rounded-lg px-4 py-2.5 text-sm text-cream-100 placeholder-cream-300/40 focus:outline-none focus:border-gold-400/40" />
                  </div>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-cream-300 mb-1.5">Services Required *</label>
                    <input required value={form.servicesRequired} onChange={e => set('servicesRequired', e.target.value)} className="w-full bg-navy-800 border border-gold-400/15 rounded-lg px-4 py-2.5 text-sm text-cream-100 placeholder-cream-300/40 focus:outline-none focus:border-gold-400/40" placeholder="e.g. Post-Construction, Commercial" />
                  </div>
                  <div>
                    <label className="block text-xs text-cream-300 mb-1.5">Estimated Volume *</label>
                    <input required value={form.estimatedVolume} onChange={e => set('estimatedVolume', e.target.value)} className="w-full bg-navy-800 border border-gold-400/15 rounded-lg px-4 py-2.5 text-sm text-cream-100 placeholder-cream-300/40 focus:outline-none focus:border-gold-400/40" placeholder="e.g. 10 projects/year" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-cream-300 mb-1.5">Partnership Proposal *</label>
                  <textarea required rows={4} value={form.proposal} onChange={e => set('proposal', e.target.value)} className="w-full bg-navy-800 border border-gold-400/15 rounded-lg px-4 py-2.5 text-sm text-cream-100 placeholder-cream-300/40 focus:outline-none focus:border-gold-400/40 resize-none" placeholder="Describe your company and the partnership opportunity..." />
                </div>
                <div>
                  <label className="block text-xs text-cream-300 mb-1.5">Additional Information</label>
                  <textarea rows={3} value={form.additionalInfo} onChange={e => set('additionalInfo', e.target.value)} className="w-full bg-navy-800 border border-gold-400/15 rounded-lg px-4 py-2.5 text-sm text-cream-100 placeholder-cream-300/40 focus:outline-none focus:border-gold-400/40 resize-none" />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 bg-gold-400 hover:bg-gold-300 text-navy-950 font-semibold py-3.5 rounded-lg transition-colors disabled:opacity-60"
                >
                  {loading ? 'Submitting…' : <>Submit Application <ArrowRight size={15} /></>}
                </button>
              </form>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
