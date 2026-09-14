import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CheckCircle2, ArrowRight, Crown, Zap } from 'lucide-react';
import { useStore, useCurrentUser, type MembershipTier } from '../store';

const TIERS = [
  {
    id: 'bronze' as MembershipTier,
    name: 'Bronze',
    badge: 'bg-amber-600/20 text-amber-400 border-amber-600/30',
    card: 'border-amber-600/25 bg-gradient-to-br from-amber-900/30 to-amber-800/10',
    glow: '',
    perks: [
      'Member pricing on all services',
      'Priority booking access',
      'Exclusive member promotions',
      'Dedicated support line',
      'Monthly service reminders',
    ],
  },
  {
    id: 'silver' as MembershipTier,
    name: 'Silver',
    badge: 'bg-slate-500/20 text-slate-300 border-slate-400/30',
    card: 'border-slate-400/30 bg-gradient-to-br from-slate-700/30 to-slate-600/10',
    glow: '',
    perks: [
      'All Bronze benefits',
      'Higher booking priority',
      'Selected service discounts',
      'Priority support response',
      'Access to seasonal packages',
      'Bi-annual complimentary add-on',
    ],
  },
  {
    id: 'gold' as MembershipTier,
    name: 'Gold',
    badge: 'bg-gold-400/20 text-gold-300 border-gold-400/30',
    card: 'border-gold-400/35 bg-gradient-to-br from-gold-600/20 to-gold-500/5',
    glow: 'ring-1 ring-gold-400/20',
    popular: true,
    perks: [
      'All Silver benefits',
      'Highest booking priority',
      'Urgent cleaning request access',
      'Exclusive Gold-only services',
      'Premium concierge support',
      'Special member pricing',
      'Quarterly courtesy deep clean',
      'Dedicated account manager',
    ],
  },
];

export default function Membership() {
  const { dispatch } = useStore();
  const user = useCurrentUser();
  const navigate = useNavigate();
  const [applying, setApplying] = useState<MembershipTier | null>(null);
  const [success, setSuccess] = useState<MembershipTier | null>(null);

  function handleApply(tier: MembershipTier) {
    if (!user) {
      navigate('/login');
      return;
    }
    setApplying(tier);
    setTimeout(() => {
      dispatch({ type: 'UPDATE_USER_MEMBERSHIP', payload: { userId: user.id, tier, status: 'active' } });
      setApplying(null);
      setSuccess(tier);
    }, 1200);
  }

  return (
    <div className="pt-16 min-h-screen bg-navy-950">
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
                <span className={`inline-block text-xs font-semibold tracking-wider uppercase px-3 py-1 rounded-full border mb-6 ${tier.badge}`}>{tier.name}</span>
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
                    onClick={() => handleApply(tier.id)}
                    disabled={applying === tier.id}
                    className={`w-full flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-semibold transition-colors ${
                      tier.id === 'gold'
                        ? 'bg-gold-400 hover:bg-gold-300 text-navy-950'
                        : 'border border-gold-400/30 hover:border-gold-400/60 text-cream-100'
                    } ${applying === tier.id ? 'opacity-60 cursor-not-allowed' : ''}`}
                  >
                    {applying === tier.id ? 'Activating…' : `Join ${tier.name}`}
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
            <p className="text-cream-300 leading-relaxed text-sm">
              Gold members can submit urgent cleaning requests for same-day or next-day service. Our operations team reviews availability and contacts you directly. While we cannot guarantee availability, Gold members receive absolute priority on all urgent requests.
            </p>
          </div>
          <div className="bg-navy-700 border border-gold-400/15 rounded-xl p-6">
            <div className="space-y-4">
              {['Submit an urgent request through your portal', 'Operations team reviews availability within 30 minutes', 'We contact you to confirm time and details', 'Same-day or next-day service, subject to availability'].map((step, i) => (
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
