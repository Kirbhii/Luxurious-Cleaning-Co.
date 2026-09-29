import { X, CheckCircle2, XCircle, User, Mail, Phone, Briefcase, GraduationCap, Building2, Globe, FileText } from 'lucide-react';
import type { PartnerApplication, TrainingApplication } from '../store';
import ResumeLink from './ResumeLink';

interface ApplicationReviewModalProps {
  application: PartnerApplication | TrainingApplication;
  applicationType: 'partner' | 'training';
  onClose: () => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  loading?: boolean;
}

export default function ApplicationReviewModal({
  application,
  applicationType,
  onClose,
  onApprove,
  onReject,
  loading = false,
}: ApplicationReviewModalProps) {
  const isPartner = applicationType === 'partner';
  const partnerApp = isPartner ? (application as PartnerApplication) : null;
  const trainingApp = !isPartner ? (application as TrainingApplication) : null;

  return (
    <div className="fixed inset-0 z-[100] bg-navy-950/90 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4 sm:p-6">
      <div className="bg-navy-800 border border-gold-400/20 rounded-2xl shadow-2xl max-w-2xl w-full m-auto animate-scale-in overflow-hidden flex flex-col max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-3rem)]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gold-400/10 shrink-0 bg-navy-800">
          <div>
            <h3 className="font-serif text-2xl text-cream-100">
              {isPartner ? 'Partnership' : 'Training'} Application Review
            </h3>
            <p className="text-sm text-cream-300 mt-1">
              {isPartner ? partnerApp?.companyName : trainingApp?.name}
            </p>
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
          <div className="flex items-center gap-3">
            <span className={`text-xs font-medium px-3 py-1.5 rounded-full border ${
              application.status === 'submitted' || application.status === 'under_review'
                ? 'text-amber-400 bg-amber-400/10 border-amber-400/20'
                : application.status === 'approved' || application.status === 'accepted'
                ? 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20'
                : 'text-red-400 bg-red-400/10 border-red-400/20'
            }`}>
              {application.status.replace('_', ' ').toUpperCase()}
            </span>
            <span className="text-xs text-cream-300">
              Submitted {new Date(application.createdAt).toLocaleString()}
            </span>
          </div>

          {/* Applicant Information */}
          <div className="bg-navy-700 rounded-xl p-4">
            <h4 className="text-sm font-semibold text-cream-100 mb-3 flex items-center gap-2">
              <User size={16} className="text-gold-400" />
              {isPartner ? 'Company' : 'Applicant'} Information
            </h4>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {isPartner && partnerApp ? (
                <>
                  <div className="col-span-2">
                    <span className="text-cream-300/70">Company Name:</span>
                    <p className="text-cream-100 font-medium">{partnerApp.companyName}</p>
                  </div>
                  <div>
                    <span className="text-cream-300/70">Industry:</span>
                    <p className="text-cream-100">{partnerApp.industry}</p>
                  </div>
                  <div>
                    <span className="text-cream-300/70">Contact Person:</span>
                    <p className="text-cream-100">{partnerApp.contactPerson}</p>
                  </div>
                  <div>
                    <span className="text-cream-300/70">Position:</span>
                    <p className="text-cream-100">{partnerApp.position}</p>
                  </div>
                  <div>
                    <span className="text-cream-300/70">Email:</span>
                    <p className="text-cream-100">{partnerApp.email}</p>
                  </div>
                  <div>
                    <span className="text-cream-300/70">Phone:</span>
                    <p className="text-cream-100">{partnerApp.phone}</p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-cream-300/70">Website:</span>
                    <p className="text-cream-100">{partnerApp.website || 'Not provided'}</p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-cream-300/70">Address:</span>
                    <p className="text-cream-100">{partnerApp.address}</p>
                  </div>
                </>
              ) : trainingApp ? (
                <>
                  <div className="col-span-2">
                    <span className="text-cream-300/70">Full Name:</span>
                    <p className="text-cream-100 font-medium">{trainingApp.name}</p>
                  </div>
                  <div>
                    <span className="text-cream-300/70">Email:</span>
                    <p className="text-cream-100">{trainingApp.email}</p>
                  </div>
                  <div>
                    <span className="text-cream-300/70">Phone:</span>
                    <p className="text-cream-100">{trainingApp.phone}</p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-cream-300/70">Experience:</span>
                    <p className="text-cream-100">{trainingApp.experience}</p>
                  </div>
                </>
              ) : null}
            </div>
          </div>

          {/* Additional Details */}
          {isPartner && partnerApp && (
            <div className="bg-navy-700 rounded-xl p-4">
              <h4 className="text-sm font-semibold text-cream-100 mb-3">Business Details</h4>
              <div className="space-y-3 text-sm">
                <div>
                  <span className="text-cream-300/70">Services Required:</span>
                  <p className="text-cream-100 mt-1">{partnerApp.servicesRequired}</p>
                </div>
                <div>
                  <span className="text-cream-300/70">Estimated Volume:</span>
                  <p className="text-cream-100 mt-1">{partnerApp.estimatedVolume}</p>
                </div>
                <div>
                  <span className="text-cream-300/70">Proposal:</span>
                  <p className="text-cream-100 mt-1">{partnerApp.proposal}</p>
                </div>
              </div>
            </div>
          )}

          {/* Attached Resume */}
          {application.resumeName && (
            <div className="bg-navy-700 rounded-xl p-4">
              <h4 className="text-sm font-semibold text-cream-100 mb-3 flex items-center gap-2">
                <FileText size={16} className="text-gold-400" />
                Attached File
              </h4>
              {application.resumeUrl ? (
                <ResumeLink path={application.resumeUrl} name={application.resumeName} size="md" />
              ) : (
                <span className="inline-flex items-center gap-2 text-sm text-cream-300/60 border border-gold-400/10 rounded-lg px-4 py-2.5">
                  <FileText size={15} /> {application.resumeName} (upload pending)
                </span>
              )}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 px-6 py-4 border-t border-gold-400/10 bg-navy-750 shrink-0">
          <button
            onClick={() => onReject(application.id)}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors text-sm font-semibold disabled:opacity-60"
          >
            <XCircle size={16} />
            {loading ? 'Processing...' : 'Reject Application'}
          </button>
          <button
            onClick={() => onApprove(application.id)}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white transition-colors text-sm font-semibold disabled:opacity-60"
          >
            <CheckCircle2 size={16} />
            {loading ? 'Processing...' : `Approve & Create Account`}
          </button>
        </div>
      </div>
      </div>
    </div>
  );
}
