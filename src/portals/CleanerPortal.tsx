import { useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { CheckCircle2, Images, FileText, ChevronDown, ChevronUp, ArrowLeft, LogOut, Trash2 } from 'lucide-react';
import { useStore, useCurrentUser, STATUS_LABELS, STATUS_COLORS, genId, saveNotification } from '../store';
import type { Booking, BookingStatus } from '../store';
import ConfirmModal from '../components/ConfirmModal';
import ThemeToggle from '../components/ThemeToggle';
import PinPromptModal from '../components/PinPromptModal';
import PinSettings, { PinGuidance } from '../components/PinSettings';
import MfaSettings, { MfaGuidance } from '../components/MfaSettings';
import BookingPhoto from '../components/BookingPhoto';
import {
  signOut,
  updateBookingRow,
  uploadBookingPhoto,
  deleteBookingPhoto,
  bookingPhotoStamp,
  isStoragePath,
} from '../lib/supabase';
import { compressImage } from '../lib/image';
import { useToast } from '../components/ToastContainer';

/** "14:32" for a photo taken today, "Oct 27" for anything older.
 *  24-hour and no year: this sits on a 96px thumbnail, and "02:40 PM" or
 *  "Oct 27, 11:33 AM" runs off the edge of it. */
function formatStamp(at: Date): string {
  const sameDay = at.toDateString() === new Date().toDateString();
  return at.toLocaleString('en-PH', sameDay
    ? { hour: '2-digit', minute: '2-digit', hour12: false }
    : { month: 'short', day: 'numeric' });
}

const STATUS_TRANSITIONS: Record<BookingStatus, BookingStatus | null> = {
  awaiting_review: null,
  rejected: null,
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
  const toast = useToast();
  const [expanded, setExpanded] = useState(false);
  const [note, setNote] = useState(booking.cleanerNotes);
  const [photoType, setPhotoType] = useState<'before' | 'progress' | 'after'>('progress');
  const [saving, setSaving] = useState(false);
  const [confirmation, setConfirmation] = useState<{ title: string; message: string; confirmLabel: string; onConfirm: () => void } | null>(null);
  // PIN-gated variant of `confirmation`. Only "Mark as Completed" uses it — see
  // requestStatusUpdate below and PIN_PLAN.md §2.
  const [pinGate, setPinGate] = useState<{ title: string; message: string; confirmLabel: string; onConfirm: () => void } | null>(null);

  // One hidden input is enough. On a phone the picker already offers "Take
  // photo" beside the gallery, so a second button carrying capture="environment"
  // only takes the choice away from the user.
  const photoInput = useRef<HTMLInputElement>(null);

  const nextStatus = STATUS_TRANSITIONS[booking.status];

  function updateStatus(newStatus: BookingStatus) {
    setSaving(true);
    setTimeout(async () => {
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

      // Show the change at once, but do not call it saved until the database
      // agrees. This write used to be fire-and-forget with the error going to
      // the console, so a rejected update left the screen showing a status the
      // server had never accepted.
      dispatch({ type: 'UPDATE_BOOKING', payload: updated });

      const { error } = await updateBookingRow(booking.id, { status: newStatus });
      if (error) {
        // Put the old value back rather than leaving the screen lying.
        dispatch({ type: 'UPDATE_BOOKING', payload: booking });
        toast.error('Status not saved', error.message);
        setSaving(false);
        return;
      }

      // Tell the customer only once the change is real.
      void saveNotification(dispatch, {
        userId: booking.customerId,
        title: `Booking Update — ${booking.id}`,
        message: `Your booking status has been updated to: ${STATUS_LABELS[newStatus]}`,
        link: '/portal/customer',
      });
      setSaving(false);
    }, 800);
  }

  function requestStatusUpdate(newStatus: BookingStatus) {
    const request = {
      title: 'Update job status?',
      message: `This will mark the job as ${STATUS_LABELS[newStatus]}.`,
      confirmLabel: 'Update',
      onConfirm: () => { updateStatus(newStatus); setConfirmation(null); setPinGate(null); },
    };

    // PIN-gated ONLY for 'completed'. It is the irreversible claim that the work
    // is done, the customer is notified immediately, and it cannot be quietly
    // undone. en_route / in_progress are reversible and high-frequency, so
    // gating them would only teach staff to share their PIN (PIN_PLAN.md §2).
    if (newStatus === 'completed') {
      setPinGate({
        ...request,
        title: 'Mark this job complete?',
        message: `This tells the customer their ${booking.service} is finished. Because it cannot be quietly undone, we ask for your PIN.`,
        confirmLabel: 'Complete Job',
      });
    } else {
      setConfirmation(request);
    }
  }

  function saveNotes() {
    setSaving(true);
    setTimeout(async () => {
      dispatch({ type: 'UPDATE_BOOKING', payload: { ...booking, cleanerNotes: note, updatedAt: new Date().toISOString() } });

      const { error } = await updateBookingRow(booking.id, { cleaner_notes: note });
      if (error) {
        // The textarea keeps `note`, so the typed text is not lost — only the
        // claim that it was stored is withdrawn.
        dispatch({ type: 'UPDATE_BOOKING', payload: booking });
        toast.error('Notes not saved', error.message);
        setSaving(false);
        return;
      }
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

  function uploadPhoto(file: File) {
    setSaving(true);
    (async () => {
      // Resize first, then upload, then write the path onto the booking. The
      // local state is only changed after the row is saved — a photo that is
      // on screen but not in the database is a lie the cleaner would act on.
      const blob = await compressImage(file);
      const { path } = await uploadBookingPhoto(blob, booking.id, photoType);

      const updated: Booking = {
        ...booking,
        beforePhotos: photoType === 'before' ? [...booking.beforePhotos, path] : booking.beforePhotos,
        progressPhotos: photoType === 'progress' ? [...booking.progressPhotos, path] : booking.progressPhotos,
        afterPhotos: photoType === 'after' ? [...booking.afterPhotos, path] : booking.afterPhotos,
        timeline: [...booking.timeline, {
          id: genId('tl'),
          event: `${photoType.charAt(0).toUpperCase() + photoType.slice(1)} Photo Uploaded`,
          note: `A new ${photoType} photo has been added to this booking.`,
          timestamp: new Date().toISOString(),
          actor: 'Cleaner',
        }],
        updatedAt: new Date().toISOString(),
      };

      const { error } = await updateBookingRow(booking.id, {
        before_photos: updated.beforePhotos,
        progress_photos: updated.progressPhotos,
        after_photos: updated.afterPhotos,
      });
      if (error) {
        toast.error('Photo not saved', error.message);
        return;
      }

      dispatch({ type: 'UPDATE_BOOKING', payload: updated });

      // Tell the customer only once the photo is actually stored.
      void saveNotification(dispatch, {
        userId: booking.customerId,
        title: `New Photo Update — ${booking.id}`,
        message: `Your cleaning team has uploaded a new ${photoType} photo for Booking #${booking.id}.`,
        link: '/portal/customer',
      });
    })()
      .catch((err: unknown) => {
        toast.error('Photo not uploaded', err instanceof Error ? err.message : 'Please try again.');
      })
      .finally(() => setSaving(false));
  }

  async function handlePhotoPicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Clear the input first: picking the SAME photo twice must still fire
    // onChange, and it will not while the value is unchanged.
    e.target.value = '';
    if (!file) return;
    uploadPhoto(file);
  }

  function requestDeletePhoto(value: string) {
    const stamp = bookingPhotoStamp(value);
    setConfirmation({
      title: 'Delete this photo?',
      message: `The ${stamp ? `${stamp.kind} ` : ''}photo will be removed from this booking for good. This cannot be undone.`,
      confirmLabel: 'Delete',
      onConfirm: () => { void deletePhoto(value); setConfirmation(null); },
    });
  }

  async function deletePhoto(value: string) {
    setSaving(true);
    try {
      // Object first. If the row were cleared first and this failed, the photo
      // would be gone from the screen but still sitting in the bucket forever,
      // with nothing left pointing at it to find it again.
      if (isStoragePath(value)) {
        const { error } = await deleteBookingPhoto(value);
        if (error) throw new Error(error.message);
      }

      const updated: Booking = {
        ...booking,
        beforePhotos: booking.beforePhotos.filter(v => v !== value),
        progressPhotos: booking.progressPhotos.filter(v => v !== value),
        afterPhotos: booking.afterPhotos.filter(v => v !== value),
        timeline: [...booking.timeline, {
          id: genId('tl'),
          event: 'Photo Removed',
          note: 'An uploaded photo was removed from this booking.',
          timestamp: new Date().toISOString(),
          actor: 'Cleaner',
        }],
        updatedAt: new Date().toISOString(),
      };

      const { error } = await updateBookingRow(booking.id, {
        before_photos: updated.beforePhotos,
        progress_photos: updated.progressPhotos,
        after_photos: updated.afterPhotos,
      });
      if (error) throw new Error(error.message);

      dispatch({ type: 'UPDATE_BOOKING', payload: updated });
    } catch (err) {
      toast.error('Photo not deleted', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-navy-800 border border-gold-400/10 rounded-xl overflow-hidden">
      {confirmation && <ConfirmModal {...confirmation} onCancel={() => setConfirmation(null)} />}
      {pinGate && <PinPromptModal {...pinGate} onCancel={() => setPinGate(null)} />}
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
              type="button"
              onClick={() => photoInput.current?.click()}
              disabled={saving}
              className="flex items-center gap-2 border border-gold-400/25 hover:border-gold-400/50 text-cream-200 text-sm px-4 py-2.5 rounded-lg transition-colors disabled:opacity-60"
            >
              <Images size={14} className="text-gold-400" />
              {saving ? 'Uploading…' : 'Upload photo'}
            </button>

            <input
              ref={photoInput}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoPicked}
            />

            <div className="text-xs text-cream-300/50 mt-1">
              On a phone you can take a photo straight from there too. Pictures are shrunk before sending, so it works on mobile data.
            </div>

            {/* Show existing */}
            {(booking.beforePhotos.length + booking.progressPhotos.length + booking.afterPhotos.length > 0) && (
              // py-2, not just pb-1: overflow-x-auto makes overflow-y auto too,
              // and the button hangs 6px above the top edge — without the top
              // padding the scroll row shaves the top of every circle off.
              <div className="mt-3 flex gap-3 overflow-x-auto py-2">
                {[...booking.beforePhotos, ...booking.progressPhotos, ...booking.afterPhotos].map((value, i) => {
                  const stamp = bookingPhotoStamp(value);
                  return (
                    // The box owns the size, not the <img>: index.css has an
                    // unlayered `img { height: auto }` that outranks every h-*
                    // utility, so a portrait phone photo would render taller
                    // than the skeleton that stood in for it and the strip
                    // would jump as each one loaded.
                    <div key={`${value}-${i}`} className="relative h-[72px] w-24 shrink-0">
                      <BookingPhoto
                        value={value}
                        alt="Uploaded"
                        className="absolute inset-0 h-full w-full object-cover rounded-lg border border-gold-400/15"
                      />
                      {/* The time is read out of the stored path, so it is the
                          upload time and cannot drift from the record. */}
                      <span className="absolute bottom-1 left-1 max-w-[calc(100%-0.5rem)] truncate rounded bg-black/65 px-1 py-0.5 text-[9px] font-medium leading-none text-white">
                        {stamp ? `${stamp.kind} · ${formatStamp(stamp.at)}` : 'photo'}
                      </span>
                      <button
                        type="button"
                        onClick={() => requestDeletePhoto(value)}
                        disabled={saving}
                        aria-label={`Delete this ${stamp ? stamp.kind : ''} photo`}
                        // Neutral until you go for it, then red. A red dot on
                        // every thumbnail shouts at a screen whose main job is
                        // looking at the photos. after:-inset-2 grows the touch
                        // area to ~40px without growing the icon.
                        className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full border border-white/15 bg-navy-950/75 text-cream-200 shadow backdrop-blur-sm transition-colors hover:border-red-400/60 hover:bg-red-600 hover:text-white disabled:opacity-60 after:absolute after:-inset-2 after:content-['']"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  );
                })}
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
  const [tab, setTab] = useState<'active' | 'completed' | 'security'>('active');
  const [confirmation, setConfirmation] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    onConfirm: () => void;
  } | null>(null);

  const assignedBookings = state.bookings.filter(b => b.cleanerId === user.id);
  const active = assignedBookings.filter(b => !['completed', 'cancelled'].includes(b.status));
  const completed = assignedBookings.filter(b => b.status === 'completed');
  const myNotifications = state.notifications.filter(n => n.userId === user.id && !n.read);

  function getCustomerName(customerId: string) {
    return state.users.find(u => u.id === customerId)?.name || 'Customer';
  }

  async function handleLogout() {
    // Clear the Supabase session, not just the local state.
    //
    // A local-only logout left the stored session intact. SIGNED_OUT therefore
    // never fired, so the store's resolved-user id was never reset — and the
    // NEXT login published nothing: the password was accepted, "Welcome back!"
    // appeared, and the user was left on /login with no portal and no OTP.
    // A reload would also have signed them straight back in.
    await signOut();
    dispatch({ type: 'LOGOUT' });
    navigate('/login');
  }

  function requestLogout() {
    setConfirmation({
      title: 'Log out?',
      message: 'You will be signed out of your account and redirected to the login page.',
      confirmLabel: 'Log Out',
      onConfirm: () => { handleLogout(); setConfirmation(null); },
    });
  }

  return (
    <div className="min-h-screen bg-navy-950 portal-surface">
      {confirmation && <ConfirmModal {...confirmation} onCancel={() => setConfirmation(null)} />}
      <div className="bg-navy-900 border-b border-gold-400/10 pt-16">
        <div className="max-w-5xl mx-auto px-6 py-6">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <div className="text-xs text-gold-400 tracking-[0.2em] uppercase font-medium mb-1">Cleaner Portal</div>
              <h1 className="font-serif text-3xl text-cream-100">Welcome, {user.name.split(' ')[0]}</h1>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {/* Theme switch, beside the other header actions. */}
              <ThemeToggle variant="full" />
              <Link to="/" className="inline-flex items-center gap-2 rounded-lg bg-gold-400 px-4 py-2.5 text-sm font-semibold text-navy-950 transition-colors hover:bg-gold-300">
                <ArrowLeft size={14} />
                Back to Home
              </Link>
              <button
                onClick={requestLogout}
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-500"
              >
                <LogOut size={14} />
                Log out
              </button>
            </div>
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
            {[{ key: 'active', label: 'Active Jobs' }, { key: 'completed', label: 'Completed' }, { key: 'security', label: 'Security' }].map(t => (
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
          {tab === 'security' ? (
            <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
              {/* Actions down the left (two-factor, then the PIN), the
                  explanations down the right. The column is declared on each
                  card rather than left to source order, so each explanation
                  sits level with the control it explains. */}
              <div className="lg:col-start-1">
                <MfaSettings />
              </div>
              <div className="lg:col-start-2">
                <MfaGuidance />
              </div>
              <div className="lg:col-start-1">
                <PinSettings />
              </div>
              <div className="lg:col-start-2">
                <PinGuidance />
              </div>
            </div>
          ) : tab === 'active' ? (
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
