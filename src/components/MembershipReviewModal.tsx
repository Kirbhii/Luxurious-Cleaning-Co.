import { X, CheckCircle2, XCircle, User, Mail, Phone, MapPin, Crown } from 'lucide-react';
import type { User as UserType, MembershipTier } from '../store';

interface MembershipReviewModalProps {
  user: UserType;
  requestedTier: MembershipTier;
  onClose: () => void;
  onApprove: (userId: string, tier: MembershipTier) => void;
  onReject: (userId: string) => void;
  loading?: boolean;
}

export default function MembershipReviewModal({
  user,
  requestedTier,
  onClose,
  onApprove,
  onReject,
  loading = false,
}: MembershipReviewModalProps) {
  return (
    <div className="fixed inset-0 z-[100] bg-navy-950/90 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4 sm:p-6">
      <div className="bg-navy-800 border border-gold-400/20 rounded-2xl shadow-2xl max-w-xl w-full m-auto animate-scale-in overflow-hidden flex flex-col max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-3rem)]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gold-400/10 shrink-0 bg-navy-800">
          <div>
            <h3 className="font-serif text-2xl text-cream-100">Membership Application</h3>
            <p className="text-sm text-cream-300 mt-1 capitalize">{requestedTier} Tier Request</p>
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
          {/* Requested Tier Badge */}
          <div className="bg-gold-400/10 border border-gold-400/20 rounded-xl p-4 flex items-center gap-3">
            <Crown size={24} className="text-gold-400" />
            <div>
              <p className="text-sm text-cream-300">Requested Membership:</p>
              <p className="text-lg font-semibold text-gold-400 capitalize">{requestedTier} Membership</p>
            </div>
          </div>

          {/* Applicant Information */}
          <div className="bg-navy-700 rounded-xl p-4">
            <h4 className="text-sm font-semibold text-cream-100 mb-3 flex items-center gap-2">
              <User size={16} className="text-gold-400" />
              Applicant Information
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-cream-300/70">Full Name:</span>
                <span className="text-cream-100 font-medium">{user.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-cream-300/70">Email:</span>
                <span className="text-cream-100">{user.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-cream-300/70">Phone:</span>
                <span className="text-cream-100">{user.phone || 'Not provided'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-cream-300/70">Customer ID:</span>
                <span className="text-cream-100 font-mono text-xs">{user.id.slice(0, 8)}</span>
              </div>
            </div>
          </div>

          {/* Current Status */}
          <div className="bg-navy-700 rounded-xl p-4">
            <h4 className="text-sm font-semibold text-cream-100 mb-3">Current Status</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-cream-300/70">Membership Status:</span>
                <span className={`capitalize ${user.membershipStatus === 'active' ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {user.membershipStatus}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-cream-300/70">Current Tier:</span>
                <span className="text-cream-100 capitalize">{user.membershipTier || 'None'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-cream-300/70">Account Created:</span>
                <span className="text-cream-100">{new Date(user.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 px-6 py-4 border-t border-gold-400/10 bg-navy-750 shrink-0">
          <button
            onClick={() => onReject(user.id)}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors text-sm font-semibold disabled:opacity-60"
          >
            <XCircle size={16} />
            {loading ? 'Processing...' : 'Reject Application'}
          </button>
          <button
            onClick={() => onApprove(user.id, requestedTier)}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white transition-colors text-sm font-semibold disabled:opacity-60"
          >
            <CheckCircle2 size={16} />
            {loading ? 'Processing...' : 'Approve Membership'}
          </button>
        </div>
      </div>
      </div>
    </div>
  );
}
