import { X, CheckCircle2, XCircle, User, MapPin, Calendar, Clock, Home, DollarSign, Zap, Crown } from 'lucide-react';
import type { Booking } from '../store';
import { STATUS_LABELS, STATUS_COLORS } from '../store';
import { PRIORITY_LABELS, PRIORITY_COLORS } from '../lib/membership';

interface BookingReviewModalProps {
  booking: Booking;
  onClose: () => void;
  onAccept: (bookingId: string) => void;
  onReject: (bookingId: string) => void;
  loading?: boolean;
}

export default function BookingReviewModal({
  booking,
  onClose,
  onAccept,
  onReject,
  loading = false,
}: BookingReviewModalProps) {
  return (
    <div className="fixed inset-0 z-[100] bg-navy-950/90 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4 sm:p-6">
      <div className="bg-navy-800 border border-gold-400/20 rounded-2xl shadow-2xl max-w-2xl w-full m-auto animate-scale-in overflow-hidden flex flex-col max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-3rem)]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gold-400/10 shrink-0 bg-navy-800">
          <div>
            <h3 className="font-serif text-2xl text-cream-100">Review Booking Request</h3>
            <p className="text-sm text-cream-300 mt-1">#{booking.id}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-navy-700 transition-colors"
          >
            <X size={18} className="text-cream-300" />
          </button>
        </div>

        {/* Content — scrollable body so the whole modal always fits the screen */}
        <div className="p-6 space-y-6 overflow-y-auto grow">
          {/* Status Badge */}
          <div className="flex flex-wrap items-center gap-2">
            <span className={`text-xs font-medium px-3 py-1.5 rounded-full border ${STATUS_COLORS[booking.status]}`}>
              {STATUS_LABELS[booking.status]}
            </span>
            {(booking.priority ?? 'normal') !== 'normal' && (
              <span className={`inline-flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-full border ${PRIORITY_COLORS[booking.priority ?? 'normal']}`}>
                <Zap size={12} /> {PRIORITY_LABELS[booking.priority ?? 'normal']}
              </span>
            )}
            {booking.memberTier && (
              <span className="inline-flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-full border text-gold-400 bg-gold-400/10 border-gold-400/25 capitalize">
                <Crown size={12} /> {booking.memberTier}{(booking.discountPercent ?? 0) > 0 ? ` · ${booking.discountPercent}% off` : ''}
              </span>
            )}
            <span className="text-xs text-cream-300">
              Submitted {new Date(booking.createdAt).toLocaleString()}
            </span>
          </div>

          {/* Customer Information */}
          <div className="bg-navy-700 rounded-xl p-4">
            <h4 className="text-sm font-semibold text-cream-100 mb-3 flex items-center gap-2">
              <User size={16} className="text-gold-400" />
              Customer Information
            </h4>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-cream-300/70">Name:</span>
                <p className="text-cream-100 font-medium">{booking.customerName || 'N/A'}</p>
              </div>
              <div>
                <span className="text-cream-300/70">Email:</span>
                <p className="text-cream-100">{booking.customerEmail || 'N/A'}</p>
              </div>
              <div className="col-span-2">
                <span className="text-cream-300/70">Phone:</span>
                <p className="text-cream-100">{booking.customerPhone || 'N/A'}</p>
              </div>
            </div>
          </div>

          {/* Service Details */}
          <div className="bg-navy-700 rounded-xl p-4">
            <h4 className="text-sm font-semibold text-cream-100 mb-3 flex items-center gap-2">
              <Home size={16} className="text-gold-400" />
              Service Details
            </h4>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="col-span-2">
                <span className="text-cream-300/70">Service Type:</span>
                <p className="text-cream-100 font-medium">{booking.service}</p>
              </div>
              <div>
                <span className="text-cream-300/70">Date:</span>
                <p className="text-cream-100">{new Date(booking.date + 'T00:00:00').toLocaleDateString()}</p>
              </div>
              <div>
                <span className="text-cream-300/70">Time:</span>
                <p className="text-cream-100">{booking.time}</p>
              </div>
              <div>
                <span className="text-cream-300/70">Frequency:</span>
                <p className="text-cream-100">{booking.frequency}</p>
              </div>
              <div>
                <span className="text-cream-300/70">Property Type:</span>
                <p className="text-cream-100">{booking.propertyType}</p>
              </div>
            </div>
          </div>

          {/* Property Details */}
          <div className="bg-navy-700 rounded-xl p-4">
            <h4 className="text-sm font-semibold text-cream-100 mb-3 flex items-center gap-2">
              <MapPin size={16} className="text-gold-400" />
              Property Details
            </h4>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="col-span-2">
                <span className="text-cream-300/70">Address:</span>
                <p className="text-cream-100">{booking.address}, {booking.city}</p>
              </div>
              <div>
                <span className="text-cream-300/70">Bedrooms:</span>
                <p className="text-cream-100">{booking.bedrooms}</p>
              </div>
              <div>
                <span className="text-cream-300/70">Bathrooms:</span>
                <p className="text-cream-100">{booking.bathrooms}</p>
              </div>
              {booking.size && (
                <div className="col-span-2">
                  <span className="text-cream-300/70">Size:</span>
                  <p className="text-cream-100">{booking.size}</p>
                </div>
              )}
            </div>
          </div>

          {/* Additional Information */}
          {(booking.specialRequests || booking.allergies || booking.accessInstructions) && (
            <div className="bg-navy-700 rounded-xl p-4">
              <h4 className="text-sm font-semibold text-cream-100 mb-3">Additional Information</h4>
              <div className="space-y-2 text-sm">
                {booking.specialRequests && (
                  <div>
                    <span className="text-cream-300/70">Special Requests:</span>
                    <p className="text-cream-100">{booking.specialRequests}</p>
                  </div>
                )}
                {booking.fragrance && (
                  <div>
                    <span className="text-cream-300/70">Preferred Fragrance:</span>
                    <p className="text-cream-100">{booking.fragrance}</p>
                  </div>
                )}
                {booking.allergies && (
                  <div>
                    <span className="text-cream-300/70">Allergies/Sensitivities:</span>
                    <p className="text-cream-100">{booking.allergies}</p>
                  </div>
                )}
                {booking.accessInstructions && (
                  <div>
                    <span className="text-cream-300/70">Access Instructions:</span>
                    <p className="text-cream-100">{booking.accessInstructions}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 px-6 py-4 border-t border-gold-400/10 bg-navy-750 shrink-0">
          <button
            onClick={() => onReject(booking.id)}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors text-sm font-semibold disabled:opacity-60"
          >
            <XCircle size={16} />
            {loading ? 'Processing...' : 'Reject Booking'}
          </button>
          <button
            onClick={() => onAccept(booking.id)}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white transition-colors text-sm font-semibold disabled:opacity-60"
          >
            <CheckCircle2 size={16} />
            {loading ? 'Processing...' : 'Accept Booking'}
          </button>
        </div>
      </div>
      </div>
    </div>
  );
}
