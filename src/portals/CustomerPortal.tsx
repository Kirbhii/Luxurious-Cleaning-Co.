import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  CalendarCheck, Clock, CheckCircle2, XCircle, Bell, ArrowRight, ArrowLeft,
  ChevronDown, ChevronUp, Camera, User as UserIcon, Crown, LogOut, Save, Trash2,
  GraduationCap, Briefcase,
} from 'lucide-react';
import { useStore, useCurrentUser, STATUS_LABELS, STATUS_COLORS, saveNotification } from '../store';
import { useToast } from '../components/ToastContainer';
import type { Booking } from '../store';
import ConfirmModal from '../components/ConfirmModal';
import { deleteBookingRow, updateProfile, cancelMembership as cancelMembershipDb, isUuid } from '../lib/supabase';
import { TIER_PERKS, TIER_SUPPORT, TIER_CREDITS, TIER_DISCOUNT, PRIORITY_LABELS, PRIORITY_COLORS } from '../lib/membership';

const STATUS_ORDER = [
  { key: 'pending', label: 'Pending' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'cleaner_assigned', label: 'Assigned' },
  { key: 'en_route', label: 'En Route' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'completed', label: 'Completed' },
];

function ProgressTimeline({ booking }: { booking: Booking }) {
  const activeIdx = STATUS_ORDER.findIndex(s => s.key === booking.status);
  if (['cancelled', 'rescheduled', 'awaiting_quote', 'awaiting_review', 'rejected'].includes(booking.status)) return null;

  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-1">
      {STATUS_ORDER.map((s, i) => (
        <div key={s.key} className="flex items-center gap-1">
          <div className={`flex flex-col items-center min-w-[60px]`}>
            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center text-[9px] font-bold transition-all ${
              i < activeIdx ? 'bg-gold-400 border-gold-400 text-navy-950'
              : i === activeIdx ? 'bg-gold-400/20 border-gold-400 text-gold-400'
              : 'bg-transparent border-cream-300/20 text-cream-300/40'
            }`}>
              {i < activeIdx ? '✓' : i + 1}
            </div>
            <span className={`text-[9px] mt-1 text-center leading-tight ${i <= activeIdx ? 'text-cream-200' : 'text-cream-300/40'}`}>{s.label}</span>
          </div>
          {i < STATUS_ORDER.length - 1 && (
            <div className={`h-px w-6 mb-4 ${i < activeIdx ? 'bg-gold-400' : 'bg-cream-300/15'}`} />
          )}
        </div>
      ))}
    </div>
  );
}

function BookingCard({ booking, cleanerName, onDelete }: { booking: Booking; cleanerName: string | null; onDelete?: () => void }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-navy-800 border border-gold-400/10 rounded-xl overflow-hidden">
      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="font-serif text-cream-100 font-medium">{booking.service}</span>
              <span className="text-xs text-cream-300/60">#{booking.id}</span>
            </div>
            <div className="text-xs text-cream-300">{booking.address}, {booking.city}</div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${STATUS_COLORS[booking.status]}`}>
              {STATUS_LABELS[booking.status]}
            </span>
            {(booking.priority ?? 'normal') !== 'normal' && (
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${PRIORITY_COLORS[booking.priority ?? 'normal']}`}>
                {PRIORITY_LABELS[booking.priority ?? 'normal']}
              </span>
            )}
            {(booking.discountPercent ?? 0) > 0 && (
              <span className="text-xs font-medium px-2.5 py-1 rounded-full border text-gold-400 bg-gold-400/10 border-gold-400/25">
                {booking.discountPercent}% member rate
              </span>
            )}
            {onDelete && <button onClick={onDelete} className="p-1.5 text-red-400 hover:text-red-300 rounded-md hover:bg-red-400/10" title="Delete booking"><Trash2 size={14} /></button>}
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs text-cream-300 mb-4">
          <span>{new Date(booking.date + 'T00:00:00').toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
          <span>·</span>
          <span>{booking.time}</span>
          {cleanerName && <><span>·</span><span className="text-cream-200">Cleaner: {cleanerName}</span></>}
        </div>
        <ProgressTimeline booking={booking} />
      </div>

      {/* Expand toggle */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-3 border-t border-gold-400/10 text-xs text-cream-300 hover:bg-navy-700 transition-colors"
      >
        <span>{expanded ? 'Hide details' : 'View details & photos'}</span>
        {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
      </button>

      {expanded && (
        <div className="px-5 pb-5 border-t border-gold-400/5">
          {/* Photos */}
          {(booking.beforePhotos.length > 0 || booking.progressPhotos.length > 0 || booking.afterPhotos.length > 0) && (
            <div className="mt-4 space-y-4">
              {[
                { label: 'Before Photos', photos: booking.beforePhotos },
                { label: 'Progress Photos', photos: booking.progressPhotos },
                { label: 'After Photos', photos: booking.afterPhotos },
              ].filter(g => g.photos.length > 0).map(group => (
                <div key={group.label}>
                  <div className="text-xs text-cream-300/70 uppercase tracking-wider mb-2">{group.label}</div>
                  <div className="flex gap-2 overflow-x-auto">
                    {group.photos.map((url, i) => (
                      <img key={i} src={url} alt={group.label} className="w-28 h-20 object-cover rounded-lg shrink-0 border border-gold-400/10" />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Cleaner notes */}
          {booking.cleanerNotes && (
            <div className="mt-4 bg-navy-700 rounded-lg p-3">
              <div className="text-xs text-cream-300/70 uppercase tracking-wider mb-1">Cleaner Notes</div>
              <div className="text-sm text-cream-200">{booking.cleanerNotes}</div>
            </div>
          )}

          {/* Timeline */}
          {booking.timeline.length > 0 && (
            <div className="mt-4">
              <div className="text-xs text-cream-300/70 uppercase tracking-wider mb-3">Activity Timeline</div>
              <div className="space-y-2">
                {booking.timeline.map(event => (
                  <div key={event.id} className="flex gap-3 text-sm">
                    <div className="w-1.5 h-1.5 rounded-full bg-gold-400 mt-1.5 shrink-0" />
                    <div>
                      <span className="text-cream-100 font-medium">{event.event}</span>
                      {event.note && <span className="text-cream-300"> — {event.note}</span>}
                      <div className="text-xs text-cream-300/60">{new Date(event.timestamp).toLocaleString()}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function CustomerPortal() {
  const { state, dispatch } = useStore();
  const user = useCurrentUser()!;
  const navigate = useNavigate();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<'bookings' | 'applications' | 'notifications' | 'membership' | 'profile'>('bookings');
  const [bookingFilter, setBookingFilter] = useState<'all' | 'pending' | 'completed' | 'cancelled'>('all');
  const [profileForm, setProfileForm] = useState({ name: user.name, email: user.email, phone: user.phone });
  const [profileMessage, setProfileMessage] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [confirmation, setConfirmation] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    onConfirm: () => void;
  } | null>(null);

  const myBookings = state.bookings.filter(b => b.customerId === user.id);
  const myTrainingApps = state.trainingApplications.filter(a => a.userId === user.id);
  const myPartnerApp = state.partnerApplications.find(p => p.userId === user.id) || null;
  const applicationsCount = myTrainingApps.length + (myPartnerApp ? 1 : 0);
  const myNotifications = state.notifications.filter(n => n.userId === user.id);
  const unreadCount = myNotifications.filter(n => !n.read).length;

  const ACTIVE_STATUSES = ['pending', 'awaiting_review', 'awaiting_quote', 'confirmed', 'cleaner_assigned', 'en_route', 'in_progress'];
  const filteredBookings = myBookings.filter(b => {
    if (bookingFilter === 'all') return true;
    if (bookingFilter === 'pending') return ACTIVE_STATUSES.includes(b.status);
    return b.status === bookingFilter;
  });
  const upcoming = filteredBookings.filter(b => ACTIVE_STATUSES.includes(b.status));
  const completed = filteredBookings.filter(b => b.status === 'completed');
  const cancelled = filteredBookings.filter(b => b.status === 'cancelled');
  // Any status not covered above (e.g. rejected, rescheduled) must still render — never hide a booking.
  const other = filteredBookings.filter(b => ![...ACTIVE_STATUSES, 'completed', 'cancelled'].includes(b.status));

  function getCleanerName(cleanerId: string | null) {
    if (!cleanerId) return null;
    return state.users.find(u => u.id === cleanerId)?.name || null;
  }

  function handleLogout() {
    dispatch({ type: 'LOGOUT' });
    navigate('/login');
  }

  function requestCancelMembership() {
    setConfirmation({
      title: 'Cancel subscription?',
      message: `Your ${user.membershipTier} membership and all member benefits (member rate, priority queue${user.membershipTier === 'gold' ? ', urgent requests, Gold-only services' : ''}) will end immediately.`,
      confirmLabel: 'Cancel Subscription',
      onConfirm: () => { cancelMembership(); setConfirmation(null); },
    });
  }

  async function cancelMembership() {
    dispatch({ type: 'UPDATE_USER_MEMBERSHIP', payload: { userId: user.id, tier: null, status: 'none' } });
    if (isUuid(user.id)) {
      // membership_tier/status are server-authoritative (see migration 007).
      const { error } = await cancelMembershipDb();
      if (error) console.error('[Customer] Membership cancel DB sync failed:', error.message);
    }
    await saveNotification(dispatch, {
      userId: user.id,
      title: 'Membership Cancelled',
      message: 'Your membership subscription has been cancelled. Member benefits no longer apply to new bookings.',
      link: '/membership',
    });
    toast.success('Subscription Cancelled', 'Your membership has been cancelled.');
  }

  function requestLogout() {
    setConfirmation({
      title: 'Log out?',
      message: 'You will be signed out of your account and redirected to the login page.',
      confirmLabel: 'Log Out',
      onConfirm: () => { handleLogout(); setConfirmation(null); },
    });
  }

  async function deleteBooking(bookingId: string) {
    // Persist first, then mirror locally. Only drop the booking from the UI once
    // the database has actually deleted it — otherwise a blocked delete (RLS)
    // left the row in place while the card vanished and a success toast fired,
    // and the booking reappeared on the next reload.
    const { error } = await deleteBookingRow(bookingId);
    if (error) {
      console.error('[Customer] Booking delete DB sync failed:', error.message);
      toast.error('Could Not Delete Booking', error.message);
      return;
    }
    dispatch({ type: 'DELETE_BOOKING', payload: bookingId });
    toast.success('Booking Deleted', 'The booking has been removed from your account.');
  }

  function requestDeleteBooking(bookingId: string) {
    setConfirmation({
      title: 'Delete booking?',
      message: 'Are you sure you want to delete this booking? This action cannot be undone.',
      confirmLabel: 'Delete',
      onConfirm: () => { deleteBooking(bookingId); setConfirmation(null); },
    });
  }

  function handleProfileSave(e: React.FormEvent) {
    e.preventDefault();
    setProfileMessage('');
    if (!profileForm.name.trim()) {
      const errorMsg = 'Name is required.';
      setProfileMessage(errorMsg);
      toast.error('Validation Error', errorMsg);
      return;
    }
    setConfirmation({
      title: 'Save profile changes?',
      message: 'Your name and phone number will be updated.',
      confirmLabel: 'Save',
      onConfirm: async () => {
        setConfirmation(null);
        const name = profileForm.name.trim();
        const phone = profileForm.phone.trim();

        // Persist FIRST, then mirror into local state. The previous version only
        // dispatched to the store, so the UI reported success while the database
        // was never touched — the change silently vanished on the next reload.
        setProfileSaving(true);
        const { error } = await updateProfile(user.id, { name, phone });
        setProfileSaving(false);

        if (error) {
          setProfileMessage('Could not save your changes. Please try again.');
          toast.error('Save Failed', error.message);
          return;
        }

        // Email is not editable here (the profiles trigger pins it and the column
        // is not granted for UPDATE), so pass the existing value through unchanged.
        dispatch({
          type: 'UPDATE_USER_PROFILE',
          payload: { userId: user.id, name, email: user.email, phone },
        });
        setProfileMessage('Profile updated successfully.');
        toast.success('Profile Updated!', 'Your information has been saved.');
      },
    });
  }

  return (
    <div className="min-h-screen bg-navy-950">
      {confirmation && <ConfirmModal {...confirmation} onCancel={() => setConfirmation(null)} />}
      {/* Header */}
      <div className="bg-navy-900 border-b border-gold-400/10 pt-16">
        <div className="max-w-7xl mx-auto px-6 py-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs text-gold-400 tracking-[0.2em] uppercase font-medium mb-1">Customer Portal</div>
            <h1 className="font-serif text-3xl text-cream-100">Welcome, {user.name.split(' ')[0]}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link to="/" className="inline-flex items-center gap-2 rounded-lg border border-gold-400/30 bg-gold-400/10 px-4 py-2.5 text-sm font-semibold text-gold-400 transition-colors hover:border-gold-400/50 hover:bg-gold-400/20">
              <ArrowLeft size={14} />
              Back to Home
            </Link>
            <Link to="/book" className="flex items-center gap-2 bg-gold-400 hover:bg-gold-300 text-navy-950 text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors">
              + New Booking <ArrowRight size={13} />
            </Link>
            <button
              onClick={requestLogout}
              className="inline-flex items-center gap-2 rounded-lg border border-red-400/30 bg-red-400/10 px-4 py-2.5 text-sm font-semibold text-red-300 transition-colors hover:border-red-300/50 hover:bg-red-400/20 hover:text-red-200"
            >
              <LogOut size={14} />
              Log out
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="max-w-7xl mx-auto px-6 pb-0 grid grid-cols-2 md:grid-cols-4 gap-4 mb-0">
          {[
            { label: 'Total Bookings', value: myBookings.length, icon: CalendarCheck },
            { label: 'Upcoming', value: upcoming.length, icon: Clock },
            { label: 'Completed', value: completed.length, icon: CheckCircle2 },
            { label: 'Unread Alerts', value: unreadCount, icon: Bell },
          ].map(stat => (
            <div key={stat.label} className="bg-navy-800 border border-gold-400/10 rounded-xl p-4 flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-lg bg-gold-400/10 flex items-center justify-center shrink-0">
                <stat.icon size={15} className="text-gold-400" />
              </div>
              <div>
                <div className="text-xl font-semibold text-cream-100">{stat.value}</div>
                <div className="text-xs text-cream-300">{stat.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex gap-1 border-b border-gold-400/10">
            {[
              { key: 'bookings', label: 'Bookings', count: myBookings.length },
              { key: 'applications', label: 'My Applications', count: applicationsCount },
              { key: 'notifications', label: 'Notifications', count: unreadCount },
              { key: 'membership', label: 'Membership' },
                { key: 'profile', label: 'Profile' },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as typeof activeTab)}
                className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                  activeTab === tab.key
                    ? 'border-gold-400 text-gold-400'
                    : 'border-transparent text-cream-300 hover:text-cream-100'
                }`}
              >
                {tab.label}
                {tab.count !== undefined && tab.count > 0 && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${activeTab === tab.key ? 'bg-gold-400/20 text-gold-400' : 'bg-navy-700 text-cream-300'}`}>{tab.count}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 min-h-[36rem]">
        {activeTab === 'bookings' && (
          <div>
            <div className="flex flex-wrap gap-2 mb-6">
              {(['all', 'pending', 'completed', 'cancelled'] as const).map(filter => (
                <button key={filter} onClick={() => setBookingFilter(filter)} className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${bookingFilter === filter ? 'bg-gold-400 text-navy-950' : 'border border-gold-400/20 text-cream-300 hover:border-gold-400/50'}`}>
                  {filter}
                </button>
              ))}
            </div>
            {upcoming.length > 0 && (
              <div className="mb-8">
                <div className="text-xs text-gold-400 uppercase tracking-wider font-medium mb-4">Upcoming & Active</div>
                <div className="space-y-4">
                  {upcoming.map(b => <BookingCard key={b.id} booking={b} cleanerName={getCleanerName(b.cleanerId)} onDelete={['pending', 'awaiting_review', 'cancelled'].includes(b.status) ? () => requestDeleteBooking(b.id) : undefined} />)}
                </div>
              </div>
            )}
            {completed.length > 0 && (
              <div className="mb-8">
                <div className="text-xs text-cream-300/60 uppercase tracking-wider font-medium mb-4">Completed</div>
                <div className="space-y-4">
                  {completed.map(b => <BookingCard key={b.id} booking={b} cleanerName={getCleanerName(b.cleanerId)} />)}
                </div>
              </div>
            )}
            {cancelled.length > 0 && (
              <div>
                <div className="text-xs text-cream-300/60 uppercase tracking-wider font-medium mb-4">Cancelled</div>
                <div className="space-y-4">
                  {cancelled.map(b => <BookingCard key={b.id} booking={b} cleanerName={getCleanerName(b.cleanerId)} onDelete={() => requestDeleteBooking(b.id)} />)}
                </div>
              </div>
            )}
            {other.length > 0 && (
              <div className="mt-8">
                <div className="text-xs text-cream-300/60 uppercase tracking-wider font-medium mb-4">Other Updates</div>
                <div className="space-y-4">
                  {other.map(b => <BookingCard key={b.id} booking={b} cleanerName={getCleanerName(b.cleanerId)} />)}
                </div>
              </div>
            )}
            {filteredBookings.length === 0 && (
              <div className="text-center py-16">
                <CalendarCheck size={32} className="text-cream-300/30 mx-auto mb-3" />
                <div className="text-cream-300 text-sm mb-4">No bookings yet.</div>
                <Link to="/book" className="inline-flex items-center gap-2 bg-gold-400 hover:bg-gold-300 text-navy-950 text-sm font-semibold px-6 py-2.5 rounded-lg transition-colors">
                  Book Your First Service <ArrowRight size={14} />
                </Link>
              </div>
            )}
          </div>
        )}

        {activeTab === 'applications' && (
          <div className="max-w-3xl space-y-8">
            {/* Training applications */}
            <div>
              <div className="text-xs text-gold-400 uppercase tracking-wider font-medium mb-4 flex items-center gap-2">
                <GraduationCap size={13} /> Training Applications
              </div>
              {myTrainingApps.length === 0 ? (
                <div className="bg-navy-800 border border-gold-400/10 rounded-xl p-6 text-center">
                  <div className="text-cream-300 text-sm mb-4">You have not applied for any training program yet.</div>
                  <Link to="/training" className="inline-flex items-center gap-2 bg-gold-400 hover:bg-gold-300 text-navy-950 text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors">
                    View Training Programs <ArrowRight size={14} />
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {myTrainingApps.map(app => {
                    const program = state.trainingPrograms.find(p => p.id === app.programId);
                    return (
                      <div key={app.id} className="bg-navy-800 border border-gold-400/10 rounded-xl p-5">
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div>
                            <h3 className="font-serif text-lg text-cream-100">{program?.name || 'Training Program'}</h3>
                            <div className="text-xs text-cream-300 mt-1">
                              {program ? `${program.duration} · ${program.schedule}` : `Applied ${new Date(app.createdAt).toLocaleDateString()}`}
                            </div>
                          </div>
                          <span className={`text-xs font-medium px-2.5 py-1 rounded-full border capitalize shrink-0 ${
                            app.status === 'accepted' || app.status === 'completed' ? 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20'
                            : app.status === 'rejected' ? 'text-red-400 bg-red-400/10 border-red-400/20'
                            : app.status === 'under_review' ? 'text-amber-400 bg-amber-400/10 border-amber-400/20'
                            : app.status === 'scheduled' ? 'text-violet-400 bg-violet-400/10 border-violet-400/20'
                            : 'text-blue-400 bg-blue-400/10 border-blue-400/20'
                          }`}>
                            {app.status.replace('_', ' ')}
                          </span>
                        </div>
                        {program && (
                          <p className="text-sm text-cream-300 leading-relaxed mb-2">{program.description}</p>
                        )}
                        <div className="text-xs text-cream-300/60">Applied: {new Date(app.createdAt).toLocaleDateString()}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Partnership application */}
            <div>
              <div className="text-xs text-gold-400 uppercase tracking-wider font-medium mb-4 flex items-center gap-2">
                <Briefcase size={13} /> Partnership Application
              </div>
              {!myPartnerApp ? (
                <div className="bg-navy-800 border border-gold-400/10 rounded-xl p-6 text-center">
                  <div className="text-cream-300 text-sm mb-4">You have not submitted a partnership application yet.</div>
                  <Link to="/partnerships" className="inline-flex items-center gap-2 bg-gold-400 hover:bg-gold-300 text-navy-950 text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors">
                    Apply for Partnership <ArrowRight size={14} />
                  </Link>
                </div>
              ) : (
                <div className="bg-navy-800 border border-gold-400/10 rounded-xl p-5">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <h3 className="font-serif text-lg text-cream-100">{myPartnerApp.companyName}</h3>
                      <div className="text-xs text-cream-300 mt-1">{myPartnerApp.industry} · {myPartnerApp.contactPerson}</div>
                    </div>
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full border capitalize shrink-0 ${
                      myPartnerApp.status === 'approved' ? 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20'
                      : myPartnerApp.status === 'rejected' ? 'text-red-400 bg-red-400/10 border-red-400/20'
                      : myPartnerApp.status === 'under_review' ? 'text-amber-400 bg-amber-400/10 border-amber-400/20'
                      : 'text-blue-400 bg-blue-400/10 border-blue-400/20'
                    }`}>
                      {myPartnerApp.status.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-sm text-cream-300 leading-relaxed mb-2">{myPartnerApp.proposal}</p>
                  <div className="text-xs text-cream-300 mb-1">Services: {myPartnerApp.servicesRequired} · Volume: {myPartnerApp.estimatedVolume}</div>
                  <div className="text-xs text-cream-300/60">Applied: {new Date(myPartnerApp.createdAt).toLocaleDateString()}</div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'notifications' && (
          <div className="max-w-2xl">
            {myNotifications.length === 0 ? (
              <div className="text-center py-16">
                <Bell size={32} className="text-cream-300/30 mx-auto mb-3" />
                <div className="text-cream-300 text-sm">No notifications yet.</div>
              </div>
            ) : (
              <div className="space-y-3">
                {myNotifications.map(n => (
                  <div key={n.id} className={`bg-navy-800 border rounded-xl px-5 py-4 ${!n.read ? 'border-gold-400/25 bg-gold-400/5' : 'border-gold-400/10'}`}>
                    <div className="flex items-start gap-3">
                      {!n.read && <div className="w-1.5 h-1.5 bg-gold-400 rounded-full mt-1.5 shrink-0" />}
                      <div className={!n.read ? '' : 'pl-4'}>
                        <div className="text-sm font-medium text-cream-100 mb-0.5">{n.title}</div>
                        <div className="text-sm text-cream-300">{n.message}</div>
                        <div className="text-xs text-cream-300/60 mt-2">{new Date(n.createdAt).toLocaleString()}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'membership' && (
          <div className="max-w-2xl">
            {user.membershipStatus === 'active' && user.membershipTier ? (
              <div className="bg-navy-800 border border-gold-400/25 rounded-2xl p-8">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-14 h-14 rounded-full bg-gold-400/15 border border-gold-400/30 flex items-center justify-center">
                    <Crown size={24} className="text-gold-400" />
                  </div>
                  <div>
                    <div className="font-serif text-2xl text-cream-100 capitalize">{user.membershipTier} Member</div>
                    <div className="text-xs text-emerald-400 font-medium mt-0.5">Active · {TIER_DISCOUNT[user.membershipTier]}% member rate on every booking</div>
                  </div>
                </div>
                {/* Your benefits — every item below is live in the system */}
                <div className="text-xs text-gold-400 tracking-[0.2em] uppercase font-medium mb-3">Your benefits</div>
                <ul className="space-y-2.5 mb-6">
                  {TIER_PERKS[user.membershipTier].map(perk => (
                    <li key={perk} className="flex items-start gap-2.5 text-sm text-cream-200">
                      <CheckCircle2 size={14} className="text-gold-400 shrink-0 mt-0.5" />
                      {perk}
                    </li>
                  ))}
                </ul>
                <div className="grid sm:grid-cols-2 gap-3 mb-6">
                  <div className="bg-navy-700 border border-gold-400/15 rounded-xl p-4">
                    <div className="text-xs text-cream-300/70 uppercase tracking-wider mb-1">{TIER_SUPPORT[user.membershipTier].label}</div>
                    <div className="text-sm font-semibold text-cream-100">{TIER_SUPPORT[user.membershipTier].contact}</div>
                  </div>
                  <div className="bg-navy-700 border border-gold-400/15 rounded-xl p-4">
                    <div className="text-xs text-cream-300/70 uppercase tracking-wider mb-1">Benefit credits</div>
                    {TIER_CREDITS[user.membershipTier].map(c => (
                      <div key={c} className="text-sm text-cream-100">· {c}</div>
                    ))}
                    <div className="text-xs text-cream-300/70 mt-1">Redeem via support or your portal bookings.</div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Link to="/book" className="inline-flex items-center gap-2 bg-gold-400 hover:bg-gold-300 text-navy-950 text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors">
                    Book with Member Rate <ArrowRight size={14} />
                  </Link>
                  <Link to="/membership" className="text-sm text-gold-400 hover:text-gold-300 flex items-center gap-1 transition-colors">
                    View membership details <ArrowRight size={13} />
                  </Link>
                  <button
                    onClick={requestCancelMembership}
                    className="text-sm text-red-400 hover:text-red-300 border border-red-400/25 hover:border-red-400/50 px-4 py-2 rounded-lg transition-colors"
                  >
                    Cancel subscription
                  </button>
                </div>
                <p className="text-[11px] text-cream-300/60 mt-3">Your membership stays active until you cancel it here.</p>
              </div>
            ) : (
              <div className="bg-navy-800 border border-gold-400/10 rounded-2xl p-8 text-center">
                <Crown size={32} className="text-cream-300/30 mx-auto mb-4" />
                <h3 className="font-serif text-xl text-cream-100 mb-3">No Active Membership</h3>
                <p className="text-cream-300 text-sm mb-6">Join our membership program for priority booking, exclusive pricing, and premium benefits.</p>
                <Link to="/membership" className="inline-flex items-center gap-2 bg-gold-400 hover:bg-gold-300 text-navy-950 text-sm font-semibold px-6 py-3 rounded-lg transition-colors">
                  Explore Membership <ArrowRight size={14} />
                </Link>
              </div>
            )}
          </div>
        )}

        {activeTab === 'profile' && (
          <div className="max-w-2xl">
            <div className="bg-navy-800 border border-gold-400/10 rounded-2xl p-6 md:p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-gold-400/10 flex items-center justify-center">
                  <UserIcon size={18} className="text-gold-400" />
                </div>
                <div>
                  <h2 className="font-serif text-2xl text-cream-100">Personal Information</h2>
                  <p className="text-xs text-cream-300 mt-1">Update the details used for your account and bookings.</p>
                </div>
              </div>
              <form onSubmit={handleProfileSave} className="space-y-4">
                {[
                  { key: 'name', label: 'Full name', type: 'text', locked: false },
                  { key: 'email', label: 'Email address', type: 'email', locked: true },
                  { key: 'phone', label: 'Phone number', type: 'tel', locked: false },
                ].map(field => (
                  <label key={field.key} className="block">
                    <span className="block text-xs font-medium text-cream-300 mb-1.5">
                      {field.label}
                      {field.locked && <span className="ml-2 text-cream-300/50">(cannot be changed here)</span>}
                    </span>
                    <input
                      type={field.type}
                      value={profileForm[field.key as keyof typeof profileForm]}
                      onChange={e => setProfileForm(form => ({ ...form, [field.key]: e.target.value }))}
                      readOnly={field.locked}
                      aria-readonly={field.locked}
                      className={`w-full bg-navy-700 border border-gold-400/15 rounded-lg px-4 py-2.5 text-sm text-cream-100 placeholder-cream-300/40 focus:outline-none focus:border-gold-400/50${field.locked ? ' opacity-50 cursor-not-allowed' : ''}`}
                    />
                  </label>
                ))}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <span className={`text-xs ${profileMessage.includes('successfully') ? 'text-emerald-400' : 'text-red-400'}`}>
                    {profileMessage}
                  </span>
                  <button type="submit" disabled={profileSaving} className="inline-flex items-center gap-2 bg-gold-400 hover:bg-gold-300 text-navy-950 text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors disabled:opacity-60">
                    <Save size={14} /> {profileSaving ? 'Saving…' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
