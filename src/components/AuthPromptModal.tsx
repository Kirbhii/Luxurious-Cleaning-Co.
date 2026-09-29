import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import logoImg from '../imports/image-3.png';

interface AuthPromptModalProps {
  open: boolean;
  onClose: () => void;
  redirectAfterLogin?: string;
}

export default function AuthPromptModal({ open, onClose, redirectAfterLogin }: AuthPromptModalProps) {
  const navigate = useNavigate();

  if (!open) return null;

  function goToLogin() {
    onClose();
    navigate(redirectAfterLogin ? `/login?redirect=${encodeURIComponent(redirectAfterLogin)}` : '/login');
  }

  function goToRegister() {
    onClose();
    navigate(
      redirectAfterLogin
        ? `/login?mode=register&redirect=${encodeURIComponent(redirectAfterLogin)}`
        : '/login?mode=register'
    );
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 px-5 backdrop-blur-sm"
      onClick={onClose}
      data-auth-exempt
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-prompt-title"
        className="relative w-full max-w-md rounded-2xl border border-gold-400/30 bg-navy-900 px-7 py-8 text-center shadow-2xl"
        onClick={event => event.stopPropagation()}
        data-auth-exempt
      >
        <button
          type="button"
          aria-label="Close sign in prompt"
          onClick={onClose}
          className="absolute right-4 top-4 text-cream-300 hover:text-cream-100"
          data-auth-exempt
        >
          <X size={18} />
        </button>
        <img src={logoImg} alt="Luxurious Cleaning Co." className="mx-auto mb-5 h-12 max-h-12 w-auto max-w-[240px] object-contain" />
        <h2 id="auth-prompt-title" className="font-serif text-2xl text-cream-100 mb-2">Welcome to Luxurious Cleaning Co.</h2>
        <p className="text-sm leading-relaxed text-cream-300 mb-7">Please sign in to continue, or create an account to get started.</p>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={goToLogin}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-gold-400 px-4 py-3 text-sm font-semibold text-navy-950 transition-colors hover:bg-gold-300"
            data-auth-exempt
          >
            Log In
          </button>
          <button
            type="button"
            onClick={goToRegister}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-gold-400/40 px-4 py-3 text-sm font-semibold text-gold-400 transition-colors hover:bg-gold-400/10"
            data-auth-exempt
          >
            Sign Up
          </button>
        </div>
      </div>
    </div>
  );
}
