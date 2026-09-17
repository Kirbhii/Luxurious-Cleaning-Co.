import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Camera, FileText, ChevronDown, ChevronUp, LogOut } from 'lucide-react';
import { useStore, useCurrentUser, STATUS_LABELS, STATUS_COLORS, genId } from '../store';
import type { Booking, BookingStatus } from '../store';
import ConfirmModal from '../components/ConfirmModal';

const SAMPLE_PHOTOS = [
  'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&h=400&fit=crop&auto=format',
  'https://images.unsplash.com/photo-1556020685-ae41abfc9365?w=600&h=400&fit=crop&auto=format',
  'https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?w=600&h=400&fit=crop&auto=format',
  'https://images.unsplash.com/photo-1484154218962-a197022b5858?w=600&h=400&fit=crop&auto=format',
];

const STATUS_TRANSITIONS: Record<BookingStatus, BookingStatus | null> = {
  confirmed: 'en_route',
  cleaner_assigned: 'en_route',
  en_route: 'in_progress',
  in_progress: 'completed',
  pending: null,
  completed: null,
  cancelled: null,
  rescheduled: null,
  awaiting_quote: null,
};

const NEXT_LABELS: Record<string, string> = {
  en_route: 'Mark as En Route',
  in_progress: 'Mark as In Progress',
  completed: 'Mark as Completed',
};

function JobCard({ booking, customerName, customerEmail, customerPhone }: { booking: Booking; customerName: string; customerEmail?: string; customerPhone?: string }) {
  const { dispatch } = useStore();
  const [expanded, setExpanded] = useState(false);
  const [note, setNote] = useState(booking.cleanerNotes);
  const [photoType, setPhotoType] = useState<'before' | 'progress' | 'after'>('progress');
  const [saving, setSaving] = useState(false);
  const [confirmation, setConfirmation] = useState<{ title: string; message: string; confirmLabel: string; onConfirm: () => void } | null>(null);

  const nextStatus = STATUS_TRANSITIONS[booking.status];

  function updateStatus(newStatus: BookingStatus) {
    setSaving(true);
    setTimeout(() => {
      const event = {
        id: genId('tl'),
        event: STATUS_LABELS[newStatus],
        note: `Status updated to ${STATUS_LABELS[newStatus]}.`,
        timestamp: new Date().toISOString(),
        actor: 'Cleaner',
      };
      const updated: Booking = {
        ...booking,
        status: newStatus,
        timeline: [...booking.timeline, event],
        updatedAt: new Date().toISOString(),
      };
      dispatch({ type: 'UPDATE_BOOKING', payload: updated });
      // Notify customer
      dispatch({
        type: 'ADD_NOTIFICATION',
        payload: {
          id: genId('n'),
          userId: booking.customerId,
          title: `Booking Update — ${booking.id}`,
          message: `Your booking status has been updated to: ${STATUS_LABELS[newStatus]}`,
          read: false,
          link: '/portal/customer',
          createdAt: new Date().toISOString(),
        },
      });
      setSaving(false);
    }, 800);
  }

  function requestStatusUpdate(newStatus: BookingStatus) {
    setConfirmation({
      title: 'Update job status?',
      message: `This will mark the job as ${STATUS_LABELS[newStatus]}.`,
      confirmLabel: 'Update',
      onConfirm: () => { updateStatus(newStatus); setConfirmation(null); },
    });
  }

  function saveNotes() {
    setSaving(true);
    setTimeout(() => {
      dispatch({ type: 'UPDATE_BOOKING', payload: { ...booking, cleanerNotes: note, updatedAt: new Date().toISOString() } });
      setSaving(false);
    }, 500);
  }

  function requestSaveNotes() {
    setConfirmation({
      title: 'Save notes?',
      message: 'Your notes will be added to this booking for the customer and admin to review.',
      confirmLabel: 'Save',
      onConfirm: () => { saveNotes(); setConfirmation(null); },
    });
  }

  function uploadPhoto() {
    setSaving(true);
    setTimeout(() => {
      const photoUrl = SAMPLE_PHOTOS[Math.floor(Math.random() * SAMPLE_PHOTOS.length)];
      const updated: Booking = {
        ...booking,
        beforePhotos: photoType === 'before' ? [...booking.beforePhotos, photoUrl] : booking.beforePhotos,
        progressPhotos: photoType === 'progress' ? [...booking.progressPhotos, photoUrl] : booking.progressPhotos,
        afterPhotos: photoType === 'after' ? [...booking.afterPhotos, photoUrl] : booking.afterPhotos,
        timeline: [...booking.timeline, {
          id: genId('tl'),
          event: `${photoType.charAt(0).toUpperCase() + photoType.slice(1)} Photo Uploaded`,
          note: `A new ${photoType} photo has been added to this booking.`,
          timestamp: new Date().toISOString(),
          actor: 'Cleaner',
        }],
        updatedAt: new Date().toISOString(),
      };
      dispatch({ type: 'UPDATE_BOOKING', payload: updated });
      dispatch({
        type: 'ADD_NOTIFICATION',
        payload: {
          id: genId('n'),
          userId: booking.customerId,
          title: `New Photo Update — ${booking.id}`,
          message: `Your cleaning team has uploaded a new ${photoType} photo for Booking #${booking.id}.`,
          read: false,
          link: '/portal/customer',
          createdAt: new Date().toISOString(),
        },
      });
      setSaving(false);
    }, 800);
  }

  function requestUploadPhoto() {
    setConfirmation({
      title: 'Upload photo?',
      message: `Add this ${photoType} photo update to the booking?`,
      confirmLabel: 'Upload',
      onConfirm: () => { uploadPhoto(); setConfirmation(null); },
    });
  }

  return (
    <div className="bg-navy-800 border border-gold-400/10 rounded-xl overflow-hidden">
      {confirmation && <ConfirmModal {...confirmation} onCancel={() => setConfirmation(null)} />}
      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="font-serif text-lg text-cream-100 mb-0.5">{booking.service}</div>
            <div className="text-xs text-cream-300">#{booking.id} · {customerName}</div>
            {(booking.customerEmail || customerEmail || booking.customerPhone || customerPhone) && (
              <div className="text-xs text-cream-300/70 mt-1">{booking.customerEmail || customerEmail || 'No email'} · {booking.customerPhone || customerPhone || 'No phone'}</div>
            )}
          </div>
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${STATUS_COLORS[booking.status]}`}>
            {STATUS_LABELS[booking.status]}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm mb-4">
          <div>
            <div className="text-xs text-cream-300/70 mb-0.5">Date & Time</div>
            <div className="text-cream-100">{new Date(booking.date + 'T00:00:00').toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })} · {booking.time}</div>
          </div>
          <div>
            <div className="text-xs text-cream-300/70 mb-0.5">Property</div>
            <div className="text-cream-100">{booking.propertyType} · {booking.bedrooms}b/{booking.bathrooms}b</div>
          </div>
          <div className="col-span-2">
            <div className="text-xs text-cream-300/70 mb-0.5">Address</div>
            <div className="text-cream-100">{booking.address}, {booking.city}</div>
          </div>
          {booking.accessInstructions && (
            <div className="col-span-2">
              <div className="text-xs text-cream-300/70 mb-0.5">Access Instructions</div>
              <div className="text-cream-100 text-xs bg-navy-700 rounded-lg px-3 py-2">{booking.accessInstructions}</div>
            </div>
          )}
          {booking.specialRequests && (
            <div className="col-span-2">
              <div className="text-xs text-cream-300/70 mb-0.5">Special Requests</div>
              <div className="text-cream-100 text-xs bg-navy-700 rounded-lg px-3 py-2">{booking.specialRequests}</div>
            </div>
          )}
        </div>

        {nextStatus && (
          <button
            onClick={() => requestStatusUpdate(nextStatus)}
            disabled={saving}
            className="w-full bg-gold-400 hover:bg-gold-300 text-navy-950 text-sm font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-60"
          >
            {saving ? 'Updating…' : NEXT_LABELS[nextStatus] || `Update to ${STATUS_LABELS[nextStatus]}`}
          </button>
        )}
        {booking.status === 'completed' && (
          <div className="flex items-center gap-2 text-sm text-emerald-400 font-medium justify-center py-2">
            <CheckCircle2 size={15} />Job Completed
          </div>
        )}
      </div>

      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-3 border-t border-gold-400/10 text-xs text-cream-300 hover:bg-navy-700 transition-colors"
      >
        <span>Photos & Notes</span>
        {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
      </button>

      {expanded && (
        <div className="px-5 pb-6 space-y-5 border-t border-gold-400/5">
          {/* Photos */}
          <div className="mt-4">
            <div className="text-xs text-cream-300/70 uppercase tracking-wider mb-3">Photo Upload</div>
            <div className="flex items-center gap-3 mb-3">
              {(['before', 'progress', 'after'] as const).map(type => (
                <button
                  key={type}
                  onClick={() => setPhotoType(type)}
                  className={`text-xs px-3 py-1.5 rounded-lg capitalize font-medium transition-colors ${
                    photoType === type ? 'bg-gold-400 text-navy-950' : 'bg-navy-700 text-cream-300 hover:text-cream-100'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
            <button
                onClick={requestUploadPhoto}
              disabled={saving}
              className="flex items-center gap-2 border border-gold-400/25 hover:border-gold-400/50 text-cream-200 text-sm px-4 py-2.5 rounded-lg transition-colors disabled:opacity-60"
            >
              <Camera size={14} className="text-gold-400" />
              {saving ? 'Uploading…' : `Upload ${photoType} photo`}
            </button>
            <div className="text-xs text-cream-300/50 mt-1">Demo: uploads a sample photo</div>

            {/* Show existing */}
            {(booking.beforePhotos.length + booking.progressPhotos.length + booking.afterPhotos.length > 0) && (
              <div className="mt-3 flex gap-2 overflow-x-auto">
                {[...booking.beforePhotos, ...booking.progressPhotos, ...booking.afterPhotos].map((url, i) => (
                  <img key={i} src={url} alt="Uploaded" className="w-20 h-14 object-cover rounded-lg shrink-0 border border-gold-400/15" />
                ))}
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <div className="text-xs text-cream-300/70 uppercase tracking-wider mb-2">Cleaning Notes</div>
            <textarea
              rows={3}
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Add notes about the cleaning progress, areas addressed, etc..."
              className="w-full bg-navy-700 border border-gold-400/15 rounded-lg px-4 py-2.5 text-sm text-cream-100 placeholder-cream-300/40 focus:outline-none focus:border-gold-400/40 resize-none"
            />
            <button
              onClick={requestSaveNotes}
              disabled={saving}
              className="flex items-center gap-2 mt-2 text-sm bg-navy-700 hover:bg-navy-600 border border-gold-400/20 text-cream-200 px-4 py-2 rounded-lg transition-colors disabled:opacity-60"
            >
              <FileText size={13} className="text-gold-400" />
              {saving ? 'Saving…' : 'Save Notes'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CleanerPortal() {
  const { state, dispatch } = useStore();
  const user = useCurrentUser()!;
  const navigate = useNavigate();
  const [tab, setTab] = useState<'active' | 'completed'>('active');

  const assignedBookings = state.bookings.filter(b => b.cleanerId === user.id);
  const active = assignedBookings.filter(b => !['completed', 'cancelled'].includes(b.status));
  const completed = assignedBookings.filter(b => b.status === 'completed');
  const myNotifications = state.notifications.filter(n => n.userId === user.id && !n.read);

  function getCustomerName(customerId: string) {
    return state.users.find(u => u.id === customerId)?.name || 'Customer';
  }

  function handleLogout() {
    dispatch({ type: 'LOGOUT' });
    navigate('/login');
  }

  return (
    <div className="min-h-screen bg-navy-950">
      <div className="bg-navy-900 border-b border-gold-400/10 pt-16">
        <div className="max-w-5xl mx-auto px-6 py-6">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <div className="text-xs text-gold-400 tracking-[0.2em] uppercase font-medium mb-1">Cleaner Portal</div>
              <h1 className="font-serif text-3xl text-cream-100">Welcome, {user.name.split(' ')[0]}</h1>
            </div>
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-2 rounded-lg border border-red-400/30 bg-red-400/10 px-4 py-2.5 text-sm font-semibold text-red-300 transition-colors hover:border-red-300/50 hover:bg-red-400/20 hover:text-red-200"
            >
              <LogOut size={14} />
              Log out
            </button>
          </div>
          <div className="grid grid-cols-3 gap-4 mb-4">
            {[
              { label: 'Active Jobs', value: active.length },
              { label: 'Completed', value: completed.length },
              { label: 'Notifications', value: myNotifications.length },
            ].map(s => (
              <div key={s.label} className="bg-navy-800 border border-gold-400/10 rounded-xl px-4 py-3">
                <div className="text-xl font-semibold text-cream-100">{s.value}</div>
                <div className="text-xs text-cream-300">{s.label}</div>
              </div>
            ))}
          </div>
          <div className="flex gap-1 border-b border-gold-400/10">
            {[{ key: 'active', label: 'Active Jobs' }, { key: 'completed', label: 'Completed' }].map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key as typeof tab)}
                className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${tab === t.key ? 'border-gold-400 text-gold-400' : 'border-transparent text-cream-300 hover:text-cream-100'}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 min-h-[36rem]">
        <div className="space-y-5">
          {tab === 'active' ? (
            active.length === 0 ? (
              <div className="text-center py-16 text-cream-300">No active jobs assigned.</div>
            ) : (
              active.map(b => {
                const customer = state.users.find(u => u.id === b.customerId);
                return <JobCard key={b.id} booking={b} customerName={b.customerName || customer?.name || 'Customer'} customerEmail={customer?.email} customerPhone={customer?.phone} />;
              })
            )
          ) : (
            completed.length === 0 ? (
              <div className="text-center py-16 text-cream-300">No completed jobs yet.</div>
            ) : (
              completed.map(b => {
                const customer = state.users.find(u => u.id === b.customerId);
                return <JobCard key={b.id} booking={b} customerName={b.customerName || customer?.name || 'Customer'} customerEmail={customer?.email} customerPhone={customer?.phone} />;
              })
            )
          )}
        </div>
      </div>
    </div>
  );
}
