import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  CalendarCheck, Clock, CheckCircle2, XCircle, Bell, ArrowRight,
  ChevronDown, ChevronUp, Camera, User as UserIcon, Crown, LogOut, Save, Trash2,
} from 'lucide-react';
import { useStore, useCurrentUser, STATUS_LABELS, STATUS_COLORS } from '../store';
import type { Booking } from '../store';

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
  if (['cancelled', 'rescheduled', 'awaiting_quote'].includes(booking.status)) return null;

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
  const [activeTab, setActiveTab] = useState<'bookings' | 'notifications' | 'membership' | 'profile'>('bookings');
  const [bookingFilter, setBookingFilter] = useState<'all' | 'pending' | 'completed' | 'cancelled'>('all');
  const [profileForm, setProfileForm] = useState({ name: user.name, email: user.email, phone: user.phone });
  const [profileMessage, setProfileMessage] = useState('');

  const myBookings = state.bookings.filter(b => b.customerId === user.id);
  const myNotifications = state.notifications.filter(n => n.userId === user.id);
  const unreadCount = myNotifications.filter(n => !n.read).length;

  const filteredBookings = myBookings.filter(b => bookingFilter === 'all' || b.status === bookingFilter);
  const upcoming = filteredBookings.filter(b => ['pending', 'confirmed', 'cleaner_assigned', 'en_route', 'in_progress', 'awaiting_quote'].includes(b.status));
  const completed = filteredBookings.filter(b => b.status === 'completed');
  const cancelled = filteredBookings.filter(b => b.status === 'cancelled');

  function getCleanerName(cleanerId: string | null) {
    if (!cleanerId) return null;
    return state.users.find(u => u.id === cleanerId)?.name || null;
  }

  function handleLogout() {
    dispatch({ type: 'LOGOUT' });
    navigate('/login');
  }

  function deleteBooking(bookingId: string) {
    if (window.confirm('Delete this booking permanently?')) {
      dispatch({ type: 'DELETE_BOOKING', payload: bookingId });
    }
  }

  function handleProfileSave(e: React.FormEvent) {
    e.preventDefault();
    setProfileMessage('');
    const duplicateEmail = state.users.some(account => account.id !== user.id && account.email.toLowerCase() === profileForm.email.trim().toLowerCase());
    if (!profileForm.name.trim() || !profileForm.email.trim()) {
      setProfileMessage('Name and email are required.');
      return;
    }
    if (duplicateEmail) {
      setProfileMessage('That email is already in use.');
      return;
    }
    dispatch({
      type: 'UPDATE_USER_PROFILE',
      payload: {
        userId: user.id,
        name: profileForm.name.trim(),
        email: profileForm.email.trim(),
        phone: profileForm.phone.trim(),
      },
    });
    setProfileMessage('Profile updated successfully.');
  }

  return (
    <div className="min-h-screen bg-navy-950">
      {/* Header */}
      <div className="bg-navy-900 border-b border-gold-400/10 pt-16">
        <div className="max-w-7xl mx-auto px-6 py-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs text-gold-400 tracking-[0.2em] uppercase font-medium mb-1">Customer Portal</div>
            <h1 className="font-serif text-3xl text-cream-100">Welcome, {user.name.split(' ')[0]}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link to="/book" className="flex items-center gap-2 bg-gold-400 hover:bg-gold-300 text-navy-950 text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors">
              + New Booking <ArrowRight size={13} />
            </Link>
            <button
              onClick={handleLogout}
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

      <div className="max-w-7xl mx-auto px-6 py-8">
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
                  {upcoming.map(b => <BookingCard key={b.id} booking={b} cleanerName={getCleanerName(b.cleanerId)} onDelete={['pending', 'cancelled'].includes(b.status) ? () => deleteBooking(b.id) : undefined} />)}
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
                  {cancelled.map(b => <BookingCard key={b.id} booking={b} cleanerName={getCleanerName(b.cleanerId)} onDelete={() => deleteBooking(b.id)} />)}
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
                    <div className="text-xs text-emerald-400 font-medium mt-0.5">Active</div>
                  </div>
                </div>
                <div className="text-sm text-cream-300 mb-6">
                  Your {user.membershipTier} membership is active. Enjoy priority booking and exclusive member benefits.
                </div>
                <Link to="/membership" className="text-sm text-gold-400 hover:text-gold-300 flex items-center gap-1 transition-colors">
                  View membership details <ArrowRight size={13} />
                </Link>
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
                  { key: 'name', label: 'Full name', type: 'text' },
                  { key: 'email', label: 'Email address', type: 'email' },
                  { key: 'phone', label: 'Phone number', type: 'tel' },
                ].map(field => (
                  <label key={field.key} className="block">
                    <span className="block text-xs font-medium text-cream-300 mb-1.5">{field.label}</span>
                    <input
                      type={field.type}
                      value={profileForm[field.key as keyof typeof profileForm]}
                      onChange={e => setProfileForm(form => ({ ...form, [field.key]: e.target.value }))}
                      className="w-full bg-navy-700 border border-gold-400/15 rounded-lg px-4 py-2.5 text-sm text-cream-100 placeholder-cream-300/40 focus:outline-none focus:border-gold-400/50"
                    />
                  </label>
                ))}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <span className={`text-xs ${profileMessage.includes('successfully') ? 'text-emerald-400' : 'text-red-400'}`}>
                    {profileMessage}
                  </span>
                  <button type="submit" className="inline-flex items-center gap-2 bg-gold-400 hover:bg-gold-300 text-navy-950 text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors">
                    <Save size={14} /> Save Changes
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
