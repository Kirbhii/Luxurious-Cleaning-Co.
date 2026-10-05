import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, ArrowRight, CheckCircle2 } from 'lucide-react';
import { updatePassword } from '../lib/supabase';
import { validatePassword } from '../lib/validation';
import PasswordCriteria from '../components/PasswordCriteria';
import logoImg from '../imports/image-3.png';
import loginImage from '../imports/login-cleaning.jpg';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    // Validate password strength
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      setError(passwordValidation.errors[0]); // Show first error
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const { error: updateError } = await updatePassword(password);

      if (updateError) {
        setError(updateError.message);
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (err) {
      console.error('[ResetPassword]', err);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-navy-950 flex items-center justify-center px-6 py-10 relative overflow-hidden">
        <img src={loginImage} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-navy-950/80 backdrop-blur-[2px]" />
        <div className="relative w-full max-w-lg rounded-2xl border border-gold-400/20 bg-navy-900/95 px-6 py-10 text-center shadow-2xl md:px-12">
          <div className="mx-auto mb-6 w-16 h-16 rounded-full bg-emerald-400/15 border border-emerald-400/30 flex items-center justify-center">
            <CheckCircle2 size={32} className="text-emerald-400" />
          </div>
          <h1 className="font-serif text-3xl text-cream-100 mb-2">Password Reset Successful!</h1>
          <p className="mx-auto max-w-sm text-sm leading-relaxed text-cream-300 mb-6">
            Your password has been updated. Redirecting you to sign in...
          </p>
          <Link
            to="/login"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-gold-400 px-8 py-3 text-sm font-semibold text-navy-950 transition-colors hover:bg-gold-300"
          >
            Sign In <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-navy-950 flex">
      {/* Left visual */}
      <div className="hidden lg:flex lg:flex-1 relative">
        <img
          src={loginImage}
          alt="Luxury interior"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-navy-950/60 to-navy-950/20" />
        <div className="absolute bottom-12 left-12">
          <div className="font-serif text-3xl text-cream-50 mb-2 italic">"Your space, elevated."</div>
          <div className="text-cream-200/70 text-sm">Luxurious Cleaning Co.</div>
        </div>
      </div>

      {/* Form panel */}
      <div className="min-h-screen flex-1 flex flex-col justify-start px-6 py-6 sm:px-8 sm:py-8 md:px-12 md:py-12 lg:h-screen lg:overflow-y-auto lg:max-w-md xl:max-w-lg">
        <div className="mb-8">
          <Link to="/" className="flex items-center self-start -ml-2 mb-10 translate-y-6">
            <img src={logoImg} alt="Luxurious Cleaning Co." className="h-12 max-h-12 w-auto max-w-[240px] object-contain" />
          </Link>
          <h1 className="font-serif text-3xl text-cream-100 mb-1">Reset Your Password</h1>
          <p className="text-sm text-cream-300">
            Enter your new password below
          </p>
        </div>

        {error && (
          <div className="bg-red-400/10 border border-red-400/25 rounded-lg px-4 py-3 text-sm text-red-400 mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleResetPassword} className="space-y-4">
          {/* New Password */}
          <div className="relative">
            <label className="block text-xs text-cream-300 mb-1.5">New Password *</label>
            <input
              required
              type={showPass ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-navy-800 border border-gold-400/15 rounded-lg px-4 py-3 pr-11 text-sm text-cream-100 focus:outline-none focus:border-gold-400/40"
              placeholder="At least 8 characters"
            />
            <button
              type="button"
              onClick={() => setShowPass(v => !v)}
              className="absolute right-3 top-[30px] text-cream-300 hover:text-cream-100"
              aria-label={showPass ? 'Hide password' : 'Show password'}
            >
              {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
            {/* Password Criteria */}
            {password && <PasswordCriteria password={password} />}
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-xs text-cream-300 mb-1.5">Confirm New Password *</label>
            <input
              required
              type={showPass ? 'text' : 'password'}
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              className="w-full bg-navy-800 border border-gold-400/15 rounded-lg px-4 py-3 text-sm text-cream-100 focus:outline-none focus:border-gold-400/40"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-gold-400 hover:bg-gold-300 text-navy-950 font-semibold py-3 rounded-lg transition-colors disabled:opacity-60 mt-2"
          >
            {loading ? 'Resetting password…' : <>Reset Password <ArrowRight size={14} /></>}
          </button>

          <div className="text-center">
            <Link
              to="/login"
              className="text-xs text-cream-300 hover:text-cream-100 transition-colors"
            >
              ← Back to sign in
            </Link>
          </div>
        </form>

        <p className="text-xs text-cream-300/60 text-center mt-6">
          Having trouble?{' '}
          <Link to="/contact" className="text-gold-400 hover:text-gold-300">Contact Support</Link>
        </p>
      </div>
    </div>
  );
}
