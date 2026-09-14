import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CheckCircle2, ArrowRight, PlusCircle, Briefcase, Bell, LogOut } from 'lucide-react';
import { useStore, useCurrentUser, genId } from '../store';
import type { PartnerProject } from '../store';

const PROJECT_STATUS_LABELS: Record<string, string> = {
  lead_submitted: 'Lead Submitted',
  received: 'Received',
  contacted: 'Contacted',
  quote: 'Quote Sent',
  approved: 'Approved',
  scheduled: 'Scheduled',
  cleaning: 'Cleaning',
  completed: 'Completed',
};

const PROJECT_STATUS_COLORS: Record<string, string> = {
  lead_submitted: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
  received: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
  contacted: 'text-sky-400 bg-sky-400/10 border-sky-400/20',
  quote: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
  approved: 'text-violet-400 bg-violet-400/10 border-violet-400/20',
  scheduled: 'text-indigo-400 bg-indigo-400/10 border-indigo-400/20',
  cleaning: 'text-purple-400 bg-purple-400/10 border-purple-400/20',
  completed: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
};

const PROJECT_PIPELINE = ['lead_submitted', 'received', 'contacted', 'quote', 'approved', 'scheduled', 'cleaning', 'completed'];

export default function PartnerPortal() {
  const { state, dispatch } = useStore();
  const user = useCurrentUser()!;
  const navigate = useNavigate();
  const [tab, setTab] = useState<'overview' | 'projects' | 'submit' | 'notifications'>('overview');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const myApp = state.partnerApplications.find(p => p.userId === user.id);
  const myProjects = myApp ? state.partnerProjects.filter(p => p.partnerId === myApp.id) : [];
  const myNotifications = state.notifications.filter(n => n.userId === user.id);
  const unread = myNotifications.filter(n => !n.read).length;

  const [form, setForm] = useState({
    name: '',
    address: '',
    size: '',
    units: '',
    turnoverDate: '',
    preferredDate: '',
    requirements: '',
    additionalInfo: '',
  });

  function set(key: string, val: string) {
    setForm(f => ({ ...f, [key]: val }));
  }

  function handleLogout() {
    dispatch({ type: 'LOGOUT' });
    navigate('/login');
  }

  function handleSubmitProject(e: React.FormEvent) {
    e.preventDefault();
    if (!myApp) return;
    setSubmitting(true);
    setTimeout(() => {
      const project: PartnerProject = {
        id: genId('pp'),
        partnerId: myApp.id,
        ...form,
        status: 'lead_submitted',
        createdAt: new Date().toISOString(),
      };
      dispatch({ type: 'ADD_PARTNER_PROJECT', payload: project });
      dispatch({
        type: 'ADD_NOTIFICATION',
        payload: {
          id: genId('n'),
          userId: user.id,
          title: 'Project Submitted',
          message: `Your project "${form.name}" has been submitted and is under review.`,
          read: false,
          link: '/portal/partner',
          createdAt: new Date().toISOString(),
        },
      });
      setSubmitting(false);
      setSubmitted(true);
      setForm({ name: '', address: '', size: '', units: '', turnoverDate: '', preferredDate: '', requirements: '', additionalInfo: '' });
      setTab('projects');
    }, 1000);
  }

  if (!myApp) {
    return (
      <div className="min-h-screen bg-navy-950 pt-16 flex items-center justify-center px-6">
        <div className="max-w-md text-center">
          <Briefcase size={40} className="text-cream-300/30 mx-auto mb-4" />
          <h2 className="font-serif text-2xl text-cream-100 mb-3">No Partnership Application</h2>
          <p className="text-cream-300 text-sm mb-6">You haven't submitted a partnership application yet.</p>
          <Link to="/partnerships" className="inline-flex items-center gap-2 bg-gold-400 hover:bg-gold-300 text-navy-950 font-semibold px-6 py-3 rounded-lg transition-colors text-sm">
            Apply Now <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-navy-950">
      <div className="bg-navy-900 border-b border-gold-400/10 pt-16">
        <div className="max-w-6xl mx-auto px-6 py-6">
          <div className="text-xs text-gold-400 tracking-[0.2em] uppercase font-medium mb-1">Partner Portal</div>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="font-serif text-3xl text-cream-100">{myApp.companyName}</h1>
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full border ${
                  myApp.status === 'approved' ? 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20'
                  : myApp.status === 'under_review' ? 'text-amber-400 bg-amber-400/10 border-amber-400/20'
                  : myApp.status === 'rejected' ? 'text-red-400 bg-red-400/10 border-red-400/20'
                  : 'text-blue-400 bg-blue-400/10 border-blue-400/20'
                }`}>
                  Partnership: {myApp.status === 'approved' ? 'Approved' : myApp.status === 'under_review' ? 'Under Review' : 'Submitted'}
                </span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {myApp.status === 'approved' && (
                <button
                  onClick={() => setTab('submit')}
                  className="flex items-center gap-2 bg-gold-400 hover:bg-gold-300 text-navy-950 text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors"
                >
                  <PlusCircle size={14} />Submit Project
                </button>
              )}
              <button
                onClick={handleLogout}
                className="inline-flex items-center gap-2 rounded-lg border border-red-400/30 bg-red-400/10 px-4 py-2.5 text-sm font-semibold text-red-300 transition-colors hover:border-red-300/50 hover:bg-red-400/20 hover:text-red-200"
              >
                <LogOut size={14} />
                Log out
              </button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 mt-5 mb-4">
            {[
              { label: 'Total Projects', value: myProjects.length },
              { label: 'Active', value: myProjects.filter(p => !['completed'].includes(p.status)).length },
              { label: 'Completed', value: myProjects.filter(p => p.status === 'completed').length },
            ].map(s => (
              <div key={s.label} className="bg-navy-800 border border-gold-400/10 rounded-xl px-4 py-3">
                <div className="text-xl font-semibold text-cream-100">{s.value}</div>
                <div className="text-xs text-cream-300">{s.label}</div>
              </div>
            ))}
          </div>

          <div className="flex gap-1 border-b border-gold-400/10">
            {[
              { key: 'overview', label: 'Overview' },
              { key: 'projects', label: 'Projects', count: myProjects.length },
              { key: 'submit', label: 'Submit Project' },
              { key: 'notifications', label: 'Notifications', count: unread },
            ].map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key as typeof tab)}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${tab === t.key ? 'border-gold-400 text-gold-400' : 'border-transparent text-cream-300 hover:text-cream-100'}`}
              >
                {t.label}
                {t.count !== undefined && t.count > 0 && (
                  <span className="text-xs px-1.5 py-0.5 rounded-full bg-navy-700 text-cream-300">{t.count}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {tab === 'overview' && (
          <div className="space-y-6">
            <div className="bg-navy-800 border border-gold-400/15 rounded-xl p-6">
              <h3 className="font-serif text-xl text-cream-100 mb-4">Partnership Information</h3>
              <div className="grid md:grid-cols-2 gap-4">
                {[
                  { label: 'Company', value: myApp.companyName },
                  { label: 'Industry', value: myApp.industry },
                  { label: 'Contact', value: `${myApp.contactPerson} · ${myApp.position}` },
                  { label: 'Email', value: myApp.email },
                  { label: 'Phone', value: myApp.phone },
                  { label: 'Services', value: myApp.servicesRequired },
                  { label: 'Volume', value: myApp.estimatedVolume },
                ].map(row => (
                  <div key={row.label}>
                    <div className="text-xs text-cream-300/70 mb-0.5">{row.label}</div>
                    <div className="text-sm text-cream-100">{row.value}</div>
                  </div>
                ))}
              </div>
            </div>
            {myApp.status === 'approved' && (
              <div className="bg-emerald-400/5 border border-emerald-400/20 rounded-xl p-5">
                <div className="flex items-center gap-3 mb-3">
                  <CheckCircle2 size={18} className="text-emerald-400" />
                  <h3 className="text-sm font-semibold text-cream-100">Partnership Approved</h3>
                </div>
                <p className="text-sm text-cream-300">
                  Your partnership is active. You can submit cleaning projects through the "Submit Project" tab. Our team will review each submission and reach out with a quote and schedule.
                </p>
              </div>
            )}
          </div>
        )}

        {tab === 'projects' && (
          <div>
            {submitted && (
              <div className="bg-emerald-400/10 border border-emerald-400/25 rounded-xl px-5 py-3 flex items-center gap-3 mb-5 text-sm text-cream-100">
                <CheckCircle2 size={16} className="text-emerald-400" />Project submitted successfully.
              </div>
            )}
            {myProjects.length === 0 ? (
              <div className="text-center py-16">
                <Briefcase size={32} className="text-cream-300/30 mx-auto mb-3" />
                <div className="text-cream-300 text-sm mb-4">No projects submitted yet.</div>
                <button onClick={() => setTab('submit')} className="inline-flex items-center gap-2 bg-gold-400 hover:bg-gold-300 text-navy-950 text-sm font-semibold px-6 py-2.5 rounded-lg transition-colors">
                  Submit First Project <ArrowRight size={14} />
                </button>
              </div>
            ) : (
              <div className="space-y-5">
                {myProjects.map(project => {
                  const activeIdx = PROJECT_PIPELINE.indexOf(project.status);
                  return (
                    <div key={project.id} className="bg-navy-800 border border-gold-400/10 rounded-xl p-6">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="font-serif text-lg text-cream-100">{project.name}</h3>
                          <div className="text-xs text-cream-300">{project.address}</div>
                        </div>
                        <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${PROJECT_STATUS_COLORS[project.status]}`}>
                          {PROJECT_STATUS_LABELS[project.status]}
                        </span>
                      </div>
                      <div className="grid md:grid-cols-3 gap-3 text-sm mb-4">
                        {[
                          { label: 'Size', value: project.size },
                          { label: 'Units', value: project.units },
                          { label: 'Preferred Date', value: project.preferredDate },
                        ].map(row => (
                          <div key={row.label}>
                            <div className="text-xs text-cream-300/70">{row.label}</div>
                            <div className="text-cream-100">{row.value}</div>
                          </div>
                        ))}
                      </div>
                      {/* Pipeline */}
                      <div className="flex items-center gap-1 overflow-x-auto">
                        {PROJECT_PIPELINE.map((s, i) => (
                          <div key={s} className="flex items-center gap-1">
                            <div className={`text-[9px] px-2 py-0.5 rounded-full whitespace-nowrap ${
                              i < activeIdx ? 'bg-gold-400/20 text-gold-400'
                              : i === activeIdx ? 'bg-gold-400 text-navy-950 font-semibold'
                              : 'bg-navy-700 text-cream-300/40'
                            }`}>
                              {PROJECT_STATUS_LABELS[s]}
                            </div>
                            {i < PROJECT_PIPELINE.length - 1 && <div className={`w-3 h-px ${i < activeIdx ? 'bg-gold-400/40' : 'bg-cream-300/10'}`} />}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {tab === 'submit' && (
          <div className="max-w-2xl">
            {myApp.status !== 'approved' ? (
              <div className="text-center py-10 text-cream-300">Your partnership must be approved before submitting projects.</div>
            ) : (
              <>
                <h2 className="font-serif text-2xl text-cream-100 mb-6">Submit a New Project</h2>
                <form onSubmit={handleSubmitProject} className="space-y-4">
                  <div>
                    <label className="block text-xs text-cream-300 mb-1.5">Project Name *</label>
                    <input required value={form.name} onChange={e => set('name', e.target.value)} className="w-full bg-navy-800 border border-gold-400/15 rounded-lg px-4 py-2.5 text-sm text-cream-100 focus:outline-none focus:border-gold-400/40" placeholder="e.g. Harbour Point Tower A" />
                  </div>
                  <div>
                    <label className="block text-xs text-cream-300 mb-1.5">Project Address *</label>
                    <input required value={form.address} onChange={e => set('address', e.target.value)} className="w-full bg-navy-800 border border-gold-400/15 rounded-lg px-4 py-2.5 text-sm text-cream-100 focus:outline-none focus:border-gold-400/40" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-cream-300 mb-1.5">Project Size *</label>
                      <input required value={form.size} onChange={e => set('size', e.target.value)} className="w-full bg-navy-800 border border-gold-400/15 rounded-lg px-4 py-2.5 text-sm text-cream-100 focus:outline-none focus:border-gold-400/40" placeholder="e.g. 45,000 sq ft" />
                    </div>
                    <div>
                      <label className="block text-xs text-cream-300 mb-1.5">Units / Floors</label>
                      <input value={form.units} onChange={e => set('units', e.target.value)} className="w-full bg-navy-800 border border-gold-400/15 rounded-lg px-4 py-2.5 text-sm text-cream-100 focus:outline-none focus:border-gold-400/40" placeholder="e.g. 120 units, 32 floors" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-cream-300 mb-1.5">Expected Turnover Date</label>
                      <input type="date" value={form.turnoverDate} onChange={e => set('turnoverDate', e.target.value)} className="w-full bg-navy-800 border border-gold-400/15 rounded-lg px-4 py-2.5 text-sm text-cream-100 focus:outline-none focus:border-gold-400/40" />
                    </div>
                    <div>
                      <label className="block text-xs text-cream-300 mb-1.5">Preferred Cleaning Date *</label>
                      <input required type="date" value={form.preferredDate} onChange={e => set('preferredDate', e.target.value)} className="w-full bg-navy-800 border border-gold-400/15 rounded-lg px-4 py-2.5 text-sm text-cream-100 focus:outline-none focus:border-gold-400/40" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-cream-300 mb-1.5">Cleaning Requirements *</label>
                    <textarea required rows={4} value={form.requirements} onChange={e => set('requirements', e.target.value)} className="w-full bg-navy-800 border border-gold-400/15 rounded-lg px-4 py-2.5 text-sm text-cream-100 focus:outline-none focus:border-gold-400/40 resize-none" placeholder="Describe the scope of cleaning required..." />
                  </div>
                  <div>
                    <label className="block text-xs text-cream-300 mb-1.5">Additional Instructions</label>
                    <textarea rows={2} value={form.additionalInfo} onChange={e => set('additionalInfo', e.target.value)} className="w-full bg-navy-800 border border-gold-400/15 rounded-lg px-4 py-2.5 text-sm text-cream-100 focus:outline-none focus:border-gold-400/40 resize-none" />
                  </div>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full flex items-center justify-center gap-2 bg-gold-400 hover:bg-gold-300 text-navy-950 font-semibold py-3.5 rounded-lg transition-colors disabled:opacity-60"
                  >
                    {submitting ? 'Submitting…' : <>Submit Project <ArrowRight size={15} /></>}
                  </button>
                </form>
              </>
            )}
          </div>
        )}

        {tab === 'notifications' && (
          <div className="max-w-2xl space-y-3">
            {myNotifications.length === 0 ? (
              <div className="text-center py-16 text-cream-300">No notifications.</div>
            ) : myNotifications.map(n => (
              <div key={n.id} className={`bg-navy-800 border rounded-xl px-5 py-4 ${!n.read ? 'border-gold-400/25 bg-gold-400/5' : 'border-gold-400/10'}`}>
                <div className="text-sm font-medium text-cream-100 mb-0.5">{n.title}</div>
                <div className="text-sm text-cream-300">{n.message}</div>
                <div className="text-xs text-cream-300/60 mt-2">{new Date(n.createdAt).toLocaleString()}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
