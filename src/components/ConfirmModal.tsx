import { AlertTriangle, X } from 'lucide-react';

type ConfirmModalProps = {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ConfirmModal({ title, message, confirmLabel, onConfirm, onCancel }: ConfirmModalProps) {
  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/65 px-5 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        className="relative w-full max-w-sm rounded-2xl border border-gold-400/25 bg-navy-900 px-6 py-7 text-center shadow-2xl"
        onClick={event => event.stopPropagation()}
      >
        <button
          type="button"
          aria-label="Close confirmation dialog"
          onClick={onCancel}
          className="absolute right-4 top-4 text-cream-300 transition-colors hover:text-cream-100"
        >
          <X size={16} />
        </button>
        <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full border border-gold-400/30 bg-gold-400/10 text-gold-400">
          <AlertTriangle size={21} />
        </div>
        <h2 id="confirm-modal-title" className="text-lg font-semibold text-cream-100">{title}</h2>
        <p className="mt-1 text-xs leading-relaxed text-cream-300">{message}</p>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-gold-400/20 bg-navy-800 px-4 py-2.5 text-xs font-medium text-cream-300 transition-colors hover:border-gold-400/40 hover:text-cream-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-md bg-red-400 px-4 py-2.5 text-xs font-semibold text-navy-950 transition-colors hover:bg-red-300"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
