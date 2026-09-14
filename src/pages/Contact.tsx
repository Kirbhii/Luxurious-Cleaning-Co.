import { useState } from 'react';
import { Phone, Mail, MapPin, Clock, CheckCircle2, ArrowRight } from 'lucide-react';
import { useStore, useCurrentUser, genId } from '../store';

export default function Contact() {
  const { dispatch } = useStore();
  const user = useCurrentUser();
  const [form, setForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    subject: '',
    message: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  function set(key: string, val: string) {
    setForm(f => ({ ...f, [key]: val }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setTimeout(() => {
      dispatch({
        type: 'SUBMIT_CONTACT',
        payload: {
          id: genId('msg'),
          ...form,
          createdAt: new Date().toISOString(),
          read: false,
        },
      });
      setSubmitting(false);
      setSubmitted(true);
    }, 1000);
  }

  return (
    <div className="pt-16 min-h-screen bg-navy-950">
      <section className="py-20 bg-navy-900 border-b border-gold-400/10">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-xs text-gold-400 tracking-[0.2em] uppercase font-medium mb-3">Reach Out</div>
          <h1 className="font-serif text-5xl md:text-6xl text-cream-100 mb-5">Contact Us</h1>
          <p className="text-cream-300 text-lg max-w-xl leading-relaxed">
            Whether you have a question, a custom request, or want to discuss a partnership, our team is ready to help.
          </p>
        </div>
      </section>

      <section className="py-16">
        <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-5 gap-12">
          {/* Contact info */}
          <div className="lg:col-span-2 space-y-6">
            {[
              { icon: Phone, label: 'Phone', value: '+1 416-555-LUXE', sub: 'Mon–Sat, 8am–7pm EST' },
              { icon: Mail, label: 'Email', value: 'hello@luxuriouscleaning.ca', sub: 'We respond within 24 hours' },
              { icon: MapPin, label: 'Service Area', value: 'Greater Toronto Area', sub: 'Toronto, Mississauga, Vaughan & more' },
              { icon: Clock, label: 'Hours', value: 'Mon–Sat: 8am–7pm', sub: 'Sunday: By appointment' },
            ].map(item => (
              <div key={item.label} className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-gold-400/10 border border-gold-400/20 flex items-center justify-center shrink-0">
                  <item.icon size={15} className="text-gold-400" />
                </div>
                <div>
                  <div className="text-xs text-cream-300/70 uppercase tracking-wider mb-0.5">{item.label}</div>
                  <div className="text-sm font-medium text-cream-100">{item.value}</div>
                  <div className="text-xs text-cream-300">{item.sub}</div>
                </div>
              </div>
            ))}

            <div className="bg-navy-800 border border-gold-400/10 rounded-xl p-6 mt-4">
              <h3 className="font-serif text-lg text-cream-100 mb-3">Ready to Book?</h3>
              <p className="text-sm text-cream-300 mb-4">Skip the message and book your service directly.</p>
              <a href="/book" className="flex items-center gap-2 bg-gold-400 hover:bg-gold-300 text-navy-950 text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors w-fit">
                Book Now <ArrowRight size={14} />
              </a>
            </div>
          </div>

          {/* Form */}
          <div className="lg:col-span-3">
            {submitted ? (
              <div className="bg-navy-800 border border-emerald-400/25 rounded-2xl p-12 text-center">
                <CheckCircle2 size={48} className="text-emerald-400 mx-auto mb-5" />
                <h2 className="font-serif text-2xl text-cream-100 mb-3">Message Received</h2>
                <p className="text-cream-300 text-sm">Thank you for reaching out. Our team will respond within 24 hours.</p>
              </div>
            ) : (
              <div className="bg-navy-800 border border-gold-400/10 rounded-2xl p-8">
                <h2 className="font-serif text-2xl text-cream-100 mb-6">Send a Message</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-cream-300 mb-1.5">Your Name *</label>
                      <input required value={form.name} onChange={e => set('name', e.target.value)} className="w-full bg-navy-700 border border-gold-400/15 rounded-lg px-4 py-2.5 text-sm text-cream-100 placeholder-cream-300/40 focus:outline-none focus:border-gold-400/40" />
                    </div>
                    <div>
                      <label className="block text-xs text-cream-300 mb-1.5">Email *</label>
                      <input required type="email" value={form.email} onChange={e => set('email', e.target.value)} className="w-full bg-navy-700 border border-gold-400/15 rounded-lg px-4 py-2.5 text-sm text-cream-100 placeholder-cream-300/40 focus:outline-none focus:border-gold-400/40" />
                    </div>
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-cream-300 mb-1.5">Phone</label>
                      <input value={form.phone} onChange={e => set('phone', e.target.value)} className="w-full bg-navy-700 border border-gold-400/15 rounded-lg px-4 py-2.5 text-sm text-cream-100 placeholder-cream-300/40 focus:outline-none focus:border-gold-400/40" />
                    </div>
                    <div>
                      <label className="block text-xs text-cream-300 mb-1.5">Subject *</label>
                      <input required value={form.subject} onChange={e => set('subject', e.target.value)} className="w-full bg-navy-700 border border-gold-400/15 rounded-lg px-4 py-2.5 text-sm text-cream-100 placeholder-cream-300/40 focus:outline-none focus:border-gold-400/40" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-cream-300 mb-1.5">Message *</label>
                    <textarea required rows={6} value={form.message} onChange={e => set('message', e.target.value)} className="w-full bg-navy-700 border border-gold-400/15 rounded-lg px-4 py-2.5 text-sm text-cream-100 placeholder-cream-300/40 focus:outline-none focus:border-gold-400/40 resize-none" />
                  </div>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full flex items-center justify-center gap-2 bg-gold-400 hover:bg-gold-300 text-navy-950 font-semibold py-3.5 rounded-lg transition-colors disabled:opacity-60"
                  >
                    {submitting ? 'Sending…' : <>Send Message <ArrowRight size={15} /></>}
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
