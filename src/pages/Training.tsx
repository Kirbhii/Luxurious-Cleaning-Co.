import { useState } from 'react';
import { CheckCircle2, ArrowRight, Clock, Users, BookOpen } from 'lucide-react';
import { useStore, useCurrentUser, genId } from '../store';
import type { TrainingProgram, TrainingApplication } from '../store';

export default function Training() {
  const { state, dispatch } = useStore();
  const user = useCurrentUser();
  const [selectedProgram, setSelectedProgram] = useState<TrainingProgram | null>(null);
  const [applyForm, setApplyForm] = useState({ name: user?.name || '', email: user?.email || '', phone: user?.phone || '', experience: '' });
  const [submitting, setSubmitting] = useState(false);
  const [successId, setSuccessId] = useState<string | null>(null);

  const userApplications = state.trainingApplications.filter(a => a.userId === user?.id);

  function hasApplied(programId: string) {
    return userApplications.some(a => a.programId === programId);
  }

  function handleApply(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedProgram) return;
    setSubmitting(true);
    setTimeout(() => {
      const app: TrainingApplication = {
        id: genId('ta'),
        programId: selectedProgram.id,
        userId: user?.id || null,
        name: applyForm.name,
        email: applyForm.email,
        phone: applyForm.phone,
        experience: applyForm.experience,
        status: 'submitted',
        createdAt: new Date().toISOString(),
      };
      dispatch({ type: 'APPLY_TRAINING', payload: app });
      if (user) {
        dispatch({
          type: 'ADD_NOTIFICATION',
          payload: {
            id: genId('n'),
            userId: user.id,
            title: 'Training Application Submitted',
            message: `Your application for "${selectedProgram.name}" has been received.`,
            read: false,
            link: '/portal/customer',
            createdAt: new Date().toISOString(),
          },
        });
      }
      setSuccessId(selectedProgram.id);
      setSelectedProgram(null);
      setSubmitting(false);
    }, 1200);
  }

  return (
    <div className="pt-16 min-h-screen bg-navy-950">
      <section className="py-20 bg-navy-900 border-b border-gold-400/10">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-xs text-gold-400 tracking-[0.2em] uppercase font-medium mb-3">Professional Development</div>
          <h1 className="font-serif text-5xl md:text-6xl text-cream-100 mb-5">Training Programs</h1>
          <p className="text-cream-300 text-lg max-w-xl leading-relaxed">
            Industry-leading training programs for aspiring and professional cleaners — built on the same standards our own team follows.
          </p>
        </div>
      </section>

      <section className="py-16">
        <div className="max-w-7xl mx-auto px-6">
          {successId && (
            <div className="bg-emerald-400/10 border border-emerald-400/25 rounded-xl px-5 py-4 flex items-center gap-3 mb-8">
              <CheckCircle2 size={18} className="text-emerald-400" />
              <span className="text-sm text-cream-100">Application submitted successfully. We will review it and contact you shortly.</span>
            </div>
          )}

          <div className="space-y-6">
            {state.trainingPrograms.map(program => (
              <div key={program.id} className="bg-navy-800 border border-gold-400/10 rounded-2xl p-8">
                <div className="grid lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2">
                    <div className="flex items-start justify-between mb-3">
                      <h2 className="font-serif text-2xl text-cream-100">{program.name}</h2>
                      {program.price !== null && (
                        <span className="text-gold-400 font-semibold text-lg ml-4">
                          ${program.price}
                        </span>
                      )}
                      {program.price === null && (
                        <span className="text-emerald-400 font-semibold text-sm ml-4 mt-1">Free</span>
                      )}
                    </div>
                    <p className="text-cream-300 text-sm leading-relaxed mb-5">{program.description}</p>
                    <div className="grid md:grid-cols-2 gap-4 mb-5">
                      <div>
                        <div className="text-xs text-gold-400 uppercase tracking-wider font-medium mb-2">Training Objectives</div>
                        <ul className="space-y-1.5">
                          {program.objectives.map(obj => (
                            <li key={obj} className="flex items-start gap-2 text-sm text-cream-200">
                              <span className="shrink-0 mt-0.5"><CheckCircle2 size={12} className="text-gold-400" /></span>{obj}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-sm text-cream-200">
                          <Clock size={13} className="text-gold-400" />
                          <span className="text-cream-300 text-xs">Duration:</span> {program.duration}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-cream-200">
                          <BookOpen size={13} className="text-gold-400" />
                          <span className="text-cream-300 text-xs">Schedule:</span> {program.schedule}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-cream-200">
                          <Users size={13} className="text-gold-400" />
                          <span className="text-cream-300 text-xs">Available:</span> {program.slotsAvailable} / {program.slots} slots
                        </div>
                        <div className="text-sm text-cream-200">
                          <span className="text-cream-300 text-xs">Requirements: </span>{program.requirements}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col justify-between">
                    <div className="bg-navy-700 rounded-xl p-5 mb-4">
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`w-2 h-2 rounded-full ${program.slotsAvailable > 0 ? 'bg-emerald-400' : 'bg-red-400'}`} />
                        <span className={`text-xs font-medium ${program.slotsAvailable > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {program.slotsAvailable > 0 ? `${program.slotsAvailable} spots available` : 'Fully booked'}
                        </span>
                      </div>
                      <div className="w-full bg-navy-600 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-gold-400 h-full rounded-full"
                          style={{ width: `${((program.slots - program.slotsAvailable) / program.slots) * 100}%` }}
                        />
                      </div>
                    </div>

                    {hasApplied(program.id) || successId === program.id ? (
                      <div className="flex items-center gap-2 text-sm text-emerald-400 font-medium px-1">
                        <CheckCircle2 size={15} />Application submitted
                      </div>
                    ) : program.slotsAvailable > 0 ? (
                      <button
                        onClick={() => setSelectedProgram(program)}
                        className="flex items-center justify-center gap-2 bg-gold-400 hover:bg-gold-300 text-navy-950 text-sm font-semibold py-3 rounded-lg transition-colors"
                      >
                        Apply Now <ArrowRight size={14} />
                      </button>
                    ) : (
                      <button disabled className="py-3 rounded-lg text-sm text-cream-300 bg-navy-700 cursor-not-allowed">
                        Fully Booked
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Application Modal */}
      {selectedProgram && (
        <div className="fixed inset-0 bg-navy-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-navy-800 border border-gold-400/20 rounded-2xl w-full max-w-lg p-8">
            <h2 className="font-serif text-2xl text-cream-100 mb-1">Apply for Training</h2>
            <p className="text-sm text-cream-300 mb-6">{selectedProgram.name}</p>
            <form onSubmit={handleApply} className="space-y-4">
              <div>
                <label className="block text-xs text-cream-300 mb-1.5">Full Name *</label>
                <input required value={applyForm.name} onChange={e => setApplyForm(f => ({ ...f, name: e.target.value }))} className="w-full bg-navy-700 border border-gold-400/15 rounded-lg px-4 py-2.5 text-sm text-cream-100 focus:outline-none focus:border-gold-400/40" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-cream-300 mb-1.5">Email *</label>
                  <input required type="email" value={applyForm.email} onChange={e => setApplyForm(f => ({ ...f, email: e.target.value }))} className="w-full bg-navy-700 border border-gold-400/15 rounded-lg px-4 py-2.5 text-sm text-cream-100 focus:outline-none focus:border-gold-400/40" />
                </div>
                <div>
                  <label className="block text-xs text-cream-300 mb-1.5">Phone *</label>
                  <input required value={applyForm.phone} onChange={e => setApplyForm(f => ({ ...f, phone: e.target.value }))} className="w-full bg-navy-700 border border-gold-400/15 rounded-lg px-4 py-2.5 text-sm text-cream-100 focus:outline-none focus:border-gold-400/40" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-cream-300 mb-1.5">Relevant Experience</label>
                <textarea rows={3} value={applyForm.experience} onChange={e => setApplyForm(f => ({ ...f, experience: e.target.value }))} className="w-full bg-navy-700 border border-gold-400/15 rounded-lg px-4 py-2.5 text-sm text-cream-100 focus:outline-none focus:border-gold-400/40 resize-none" placeholder="Describe any relevant cleaning or professional experience..." />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setSelectedProgram(null)} className="flex-1 border border-gold-400/20 text-cream-200 text-sm py-3 rounded-lg hover:border-gold-400/40 transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={submitting} className="flex-1 flex items-center justify-center gap-2 bg-gold-400 hover:bg-gold-300 text-navy-950 text-sm font-semibold py-3 rounded-lg transition-colors disabled:opacity-60">
                  {submitting ? 'Submitting…' : <>Submit <ArrowRight size={14} /></>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
