import { useRef, useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, ArrowRight, CheckCircle2, XCircle } from 'lucide-react';
import type { UserRole } from '../store';
import {
  signIn,
  signUp,
  fetchProfile,
  resetPassword,
  verifyAdminMfa,
} from '../lib/supabase';
import { useToast } from '../components/ToastContainer';
import PasswordCriteria from '../components/PasswordCriteria';
import {
  validateEmail,
  validateName,
  validatePhone,
  validatePassword,
} from '../lib/validation';
import logoImg from '../imports/image-3.png';
import loginImage from '../imports/login-cleaning.jpg';
import Logo from '../components/Logo';

// ─── Types ────────────────────────────────────────────────────────────────────

type LoginForm = {
  identifier: string;
  password: string;
  companyCode: string;
};

type RegForm = {
  name: string;
  email: string;
  phone: string;
  employeeId: string;
  companyCode: string;
  password: string;
  confirmPassword: string;
  role: UserRole;
};

// Pending MFA state after a successful admin password check
type PendingMfa = {
  factorId: string;
  challengeId: string;
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const toast = useToast();

  const [mode, setMode] = useState<'login' | 'register' | 'forgot-password'>(
    searchParams.get('mode') === 'register' ? 'register' : 'login'
  );
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // OTP / MFA state
  const [pendingMfa, setPendingMfa] = useState<PendingMfa | null>(null);
  const [pendingVerifyEmail, setPendingVerifyEmail] = useState(''); // email-verify after signup
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [otpMessage, setOtpMessage] = useState('');
  const otpRefs = useRef<Array<HTMLInputElement | null>>([]);

  // Login form (no role selector - role is determined from database)
  const [loginForm, setLoginForm] = useState<LoginForm>({
    identifier: '',
    password: '',
    companyCode: '',
  });

  const [regForm, setRegForm] = useState<RegForm>({
    name: '',
    email: '',
    phone: '',
    employeeId: '',
    companyCode: '',
    password: '',
    confirmPassword: '',
    role: 'customer', // Fixed to customer - other roles created by admin
  });

  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');

  // ── Helpers ─────────────────────────────────────────────────────────────────
  function portalFor(role: UserRole) {
    if (role === 'admin') return '/portal/admin';
    if (role === 'cleaner') return '/portal/cleaner';
    if (role === 'partner') return '/portal/partner';
    return '/'; // Customers go to home page
  }

  function getSafeRedirect(): string | null {
    const redirect = searchParams.get('redirect');
    if (!redirect) return null;
    // Only allow internal paths, never /login or /reset-password to avoid loops
    if (!redirect.startsWith('/')) return null;
    if (redirect.startsWith('/login') || redirect.startsWith('/reset-password') || redirect.startsWith('/portal')) return null;
    return redirect;
  }

  // ── Login ───────────────────────────────────────────────────────────────────
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const email = loginForm.identifier.trim().toLowerCase();

      // 1. Authenticate with Supabase
      const { data: authData, error: authError } = await signIn(email, loginForm.password);
      if (authError || !authData.user) {
        const errorMsg = authError?.message ?? 'Invalid email or password.';
        setError(errorMsg);
        toast.error('Login Failed', errorMsg);
        return;
      }

      // 2. Fetch the profile to get the role
      const profile = await fetchProfile(authData.user.id);
      if (!profile) {
        const errorMsg = 'Account profile not found. Please contact support.';
        setError(errorMsg);
        toast.error('Profile Error', errorMsg);
        return;
      }

      // 3. Show success message and navigate
      toast.success(
        'Welcome back!',
        `Logged in as ${profile.name || profile.email}`
      );

      // Small delay for toast to show before navigation
      setTimeout(() => {
        const redirect = getSafeRedirect();
        // Customers honor the redirect (e.g. /book, /membership); staff go to their portal
        if (redirect && profile.role === 'customer') {
          navigate(redirect);
        } else {
          navigate(portalFor(profile.role));
        }
      }, 300);
    } catch (err) {
      console.error('[Login]', err);
      const errorMsg = 'An unexpected error occurred. Please try again.';
      setError(errorMsg);
      toast.error('Login Error', errorMsg);
    } finally {
      setLoading(false);
    }
  }

  // ── Register ────────────────────────────────────────────────────────────────
  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    // Validate all fields
    const nameValidation = validateName(regForm.name, 'Full name');
    if (!nameValidation.valid) {
      setError(nameValidation.errors[0]);
      return;
    }

    const emailValidation = validateEmail(regForm.email);
    if (!emailValidation.valid) {
      setError(emailValidation.errors[0]);
      return;
    }

    const phoneValidation = validatePhone(regForm.phone, false); // Phone is optional
    if (!phoneValidation.valid) {
      setError(phoneValidation.errors[0]);
      return;
    }

    const passwordValidation = validatePassword(regForm.password);
    if (!passwordValidation.valid) {
      setError(passwordValidation.errors[0]);
      return;
    }

    if (regForm.password !== regForm.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const { data, error: signUpError } = await signUp({
        email: regForm.email.trim().toLowerCase(),
        password: regForm.password,
        name: regForm.name.trim(),
        phone: regForm.phone.trim(),
        role: regForm.role,
        employeeId: regForm.employeeId.trim() || undefined,
        companyCode: regForm.companyCode.trim() || undefined,
      });

      if (signUpError) {
        setError(signUpError.message);
        toast.error('Registration Failed', signUpError.message);
        return;
      }

      console.log('[Register] Success:', { 
        hasSession: !!data.session, 
        hasUser: !!data.user,
        user: data.user 
      });

      // If email confirmations are disabled, data.session will exist
      // If enabled, session will be null and user needs to verify email
      if (data.session && data.user) {
        // User is logged in - fetch profile and navigate
        const profile = await fetchProfile(data.user.id);
        
        if (profile) {
          // Success! Show welcome message
          toast.success(
            'Account Created Successfully!',
            `Welcome to Luxurious Cleaning, ${profile.name}!`
          );

          // Navigate to home for customers
          if (profile.role === 'customer') {
            setTimeout(() => {
              const redirect = getSafeRedirect();
              navigate(redirect ?? portalFor(profile.role));
            }, 500);
          }
        } else {
          // Profile not created yet (shouldn't happen with trigger)
          const errorMsg = 'Account created but profile not found. Please try signing in.';
          setError(errorMsg);
          toast.warning('Almost There', errorMsg);
          setTimeout(() => {
            setMode('login');
          }, 2000);
        }
      } else if (data.user) {
        // Email verification required
        toast.info(
          'Verify Your Email',
          'Check your inbox for a confirmation link to activate your account.'
        );
        setPendingVerifyEmail(regForm.email.trim().toLowerCase());
        setOtp(['', '', '', '', '', '']);
        setOtpMessage('');
      } else {
        const errorMsg = 'Registration failed. Please try again.';
        setError(errorMsg);
        toast.error('Registration Error', errorMsg);
      }
    } catch (err) {
      console.error('[Register]', err);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  // ── Forgot Password ─────────────────────────────────────────────────────────
  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    // Validate email
    const emailValidation = validateEmail(forgotPasswordEmail);
    if (!emailValidation.valid) {
      setError(emailValidation.errors[0]);
      toast.error('Invalid Email', emailValidation.errors[0]);
      return;
    }

    setLoading(true);

    try {
      const { error: resetError } = await resetPassword(forgotPasswordEmail.trim().toLowerCase());

      if (resetError) {
        setError(resetError.message);
        toast.error('Reset Failed', resetError.message);
        return;
      }

      const successMsg = `Password reset email sent to ${forgotPasswordEmail}. Check your inbox and click the link to reset your password.`;
      setSuccessMessage(successMsg);
      toast.success(
        'Reset Email Sent!',
        `Check ${forgotPasswordEmail} for the password reset link.`
      );
      setForgotPasswordEmail('');
    } catch (err) {
      console.error('[ForgotPassword]', err);
      const errorMsg = 'An unexpected error occurred. Please try again.';
      setError(errorMsg);
      toast.error('Reset Error', errorMsg);
    } finally {
      setLoading(false);
    }
  }

  // ── OTP digit handlers ───────────────────────────────────────────────────────
  function handleOtpChange(index: number, value: string) {
    const digit = value.replace(/\D/g, '').slice(-1);
    const next = [...otp];
    next[index] = digit;
    setOtp(next);
    setOtpMessage('');
    if (digit && index < 5) otpRefs.current[index + 1]?.focus();
  }

  function handleOtpKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  }

  function handleOtpPaste(e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const digits = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6).split('');
    if (!digits.length) return;
    const next = ['', '', '', '', '', ''];
    digits.forEach((d, i) => { next[i] = d; });
    setOtp(next);
    otpRefs.current[Math.min(digits.length, 6) - 1]?.focus();
  }

  // ── Confirm MFA (admin TOTP) ────────────────────────────────────────────────
  async function confirmMfa() {
    if (!pendingMfa) return;
    const code = otp.join('');
    if (code.length !== 6) {
      setOtpMessage('Enter the complete 6-digit code from your authenticator app.');
      return;
    }
    setLoading(true);
    try {
      const { error: verifyError } = await verifyAdminMfa(
        pendingMfa.factorId,
        pendingMfa.challengeId,
        code
      );
      if (verifyError) {
        setOtpMessage('Incorrect code. Please try again.');
        setOtp(['', '', '', '', '', '']);
        otpRefs.current[0]?.focus();
        return;
      }
      // MFA passed — navigate to admin portal
      navigate('/portal/admin');
    } catch (err) {
      console.error('[MFA]', err);
      setOtpMessage('Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  // ── OTP screen (MFA or email verification) ───────────────────────────────────
  const showOtpScreen = pendingMfa !== null || pendingVerifyEmail !== '';
  const isAdminMfa = pendingMfa !== null;

  if (showOtpScreen) {
    return (
      <div className="min-h-screen bg-navy-950 flex items-center justify-center px-6 py-10 relative overflow-hidden">
        <img src={loginImage} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-navy-950/80 backdrop-blur-[2px]" />
        <div className="relative w-full max-w-lg rounded-2xl border border-gold-400/20 bg-navy-900/95 px-6 py-10 text-center shadow-2xl md:px-12">
          <img src={logoImg} alt="Luxurious Cleaning Co." className="mx-auto mb-6 h-16 max-h-16 w-auto max-w-[280px] object-contain" />
          
          {isAdminMfa ? (
            <>
              <h1 className="font-serif text-3xl text-cream-100 mb-2">Two-Factor Authentication</h1>
              <p className="mx-auto max-w-sm text-sm leading-relaxed text-cream-300">
                Enter the 6-digit code from your <span className="text-cream-100">authenticator app</span>.
              </p>
            </>
          ) : (
            <>
              <h1 className="font-serif text-3xl text-cream-100 mb-2">Verify your email</h1>
              <p className="mx-auto max-w-sm text-sm leading-relaxed text-cream-300">
                We sent a confirmation link to{' '}
                <span className="text-cream-100">{pendingVerifyEmail}</span>.
                Check your inbox and click the link to activate your account, then{' '}
                <button
                  type="button"
                  onClick={() => { setPendingVerifyEmail(''); setMode('login'); }}
                  className="text-gold-400 underline hover:text-gold-300"
                >
                  sign in
                </button>.
              </p>
            </>
          )}

          {isAdminMfa && (
            <>
              <div className="mt-8 flex justify-center gap-2 sm:gap-3">
                {otp.map((digit, index) => (
                  <input
                    key={index}
                    ref={el => { otpRefs.current[index] = el; }}
                    value={digit}
                    onChange={e => handleOtpChange(index, e.target.value)}
                    onKeyDown={e => handleOtpKeyDown(index, e)}
                    onPaste={handleOtpPaste}
                    inputMode="numeric"
                    maxLength={1}
                    aria-label={`MFA digit ${index + 1}`}
                    className="h-12 w-10 rounded-lg border border-gold-400/25 bg-navy-800 text-center text-xl font-semibold text-cream-100 outline-none transition-colors focus:border-gold-400 focus:ring-1 focus:ring-gold-400/40 sm:h-14 sm:w-12"
                  />
                ))}
              </div>
              {otpMessage && <p className="mt-4 text-sm text-red-300">{otpMessage}</p>}
              <button
                type="button"
                onClick={confirmMfa}
                disabled={loading}
                className="mt-8 inline-flex items-center justify-center gap-2 rounded-lg bg-gold-400 px-8 py-3 text-sm font-semibold text-navy-950 transition-colors hover:bg-gold-300 disabled:opacity-60"
              >
                {loading ? 'Verifying…' : <>Verify <ArrowRight size={14} /></>}
              </button>
              <div className="mt-7 border-t border-gold-400/10 pt-5">
                <button
                  type="button"
                  onClick={() => { setPendingMfa(null); setError(''); }}
                  className="text-xs font-medium text-gold-400 transition-colors hover:text-gold-300"
                >
                  ← Back to sign in
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // ── Main login/register layout ────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-navy-950 flex">
      {/* Left visual */}
      <div className="hidden lg:flex lg:flex-1 relative">
        <img src={loginImage} alt="Luxury interior" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-navy-950/60 to-navy-950/20" />
        <div className="absolute bottom-12 left-12">
          <div className="font-serif text-3xl text-cream-50 mb-2 italic">"Your space, elevated."</div>
          <div className="text-cream-200/70 text-sm">Luxurious Cleaning Co.</div>
        </div>
      </div>

      {/* Form panel */}
      <div className="h-screen flex-1 flex flex-col justify-start overflow-y-auto px-8 py-8 md:px-12 md:py-12 lg:max-w-md xl:max-w-lg">
        <div className="mb-8">
          <div className="mb-6">
            <Logo height={56} align="left" />
          </div>
          <h1 className="font-serif text-3xl text-cream-100 mb-1">
            {mode === 'login' ? 'Welcome back' : 'Create an account'}
          </h1>
          <p className="text-sm text-cream-300">
            {mode === 'login'
              ? 'Sign in to your portal'
              : 'Join to book, track, and manage your services'}
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex bg-navy-800 rounded-xl p-1 mb-6">
          <button
            onClick={() => { setMode('login'); setError(''); }}
            className={`flex-1 text-sm py-2 rounded-lg transition-colors font-medium ${
              mode === 'login' ? 'bg-gold-400 text-navy-950' : 'text-cream-300 hover:text-cream-100'
            }`}
          >
            Sign In
          </button>
          <button
            onClick={() => { setMode('register'); setError(''); }}
            className={`flex-1 text-sm py-2 rounded-lg transition-colors font-medium ${
              mode === 'register' ? 'bg-gold-400 text-navy-950' : 'text-cream-300 hover:text-cream-100'
            }`}
          >
            Register
          </button>
        </div>

        {error && (
          <div className="bg-red-400/10 border border-red-400/25 rounded-lg px-4 py-3 text-sm text-red-400 mb-4">
            {error}
          </div>
        )}

        {successMessage && (
          <div className="bg-emerald-400/10 border border-emerald-400/25 rounded-lg px-4 py-3 text-sm text-emerald-400 mb-4">
            {successMessage}
          </div>
        )}

        {/* ── Sign In form ── */}
        {mode === 'login' ? (
          <form onSubmit={handleLogin} className="space-y-4">
            {/* Email / identifier */}
            <div>
              <label className="block text-xs text-cream-300 mb-1.5">Email address</label>
              <input
                required
                type="email"
                value={loginForm.identifier}
                onChange={e => setLoginForm(f => ({ ...f, identifier: e.target.value }))}
                placeholder="you@example.com"
                className="w-full bg-navy-800 border border-gold-400/15 rounded-lg px-4 py-3 text-sm text-cream-100 placeholder-cream-300/40 focus:outline-none focus:border-gold-400/40"
              />
            </div>

            {/* Password */}
            <div className="relative">
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs text-cream-300">Password</label>
                <button
                  type="button"
                  onClick={() => { setMode('forgot-password'); setError(''); setSuccessMessage(''); }}
                  className="text-xs text-gold-400 hover:text-gold-300 transition-colors"
                >
                  Forgot password?
                </button>
              </div>
              <input
                required
                type={showPass ? 'text' : 'password'}
                value={loginForm.password}
                onChange={e => setLoginForm(f => ({ ...f, password: e.target.value }))}
                className="w-full bg-navy-800 border border-gold-400/15 rounded-lg px-4 py-3 pr-11 text-sm text-cream-100 focus:outline-none focus:border-gold-400/40"
              />
              <button
                type="button"
                onClick={() => setShowPass(v => !v)}
                className="absolute right-3 top-[30px] text-cream-300 hover:text-cream-100"
                aria-label={showPass ? 'Hide password' : 'Show password'}
              >
                {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-gold-400 hover:bg-gold-300 text-navy-950 font-semibold py-3 rounded-lg transition-colors disabled:opacity-60 mt-2"
            >
              {loading ? 'Signing in…' : <>Sign In <ArrowRight size={14} /></>}
            </button>
          </form>
        ) : mode === 'forgot-password' ? (
          /* ── Forgot Password form ── */
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div>
              <label className="block text-xs text-cream-300 mb-1.5">Email address</label>
              <input
                required
                type="email"
                value={forgotPasswordEmail}
                onChange={e => setForgotPasswordEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full bg-navy-800 border border-gold-400/15 rounded-lg px-4 py-3 text-sm text-cream-100 placeholder-cream-300/40 focus:outline-none focus:border-gold-400/40"
              />
              <p className="text-xs text-cream-300/60 mt-2">
                Enter your email address and we'll send you a link to reset your password.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-gold-400 hover:bg-gold-300 text-navy-950 font-semibold py-3 rounded-lg transition-colors disabled:opacity-60"
            >
              {loading ? 'Sending…' : <>Send Reset Link <ArrowRight size={14} /></>}
            </button>

            <button
              type="button"
              onClick={() => { setMode('login'); setError(''); setSuccessMessage(''); }}
              className="w-full text-xs text-cream-300 hover:text-cream-100 transition-colors"
            >
              ← Back to sign in
            </button>
          </form>
        ) : (
          /* ── Register form ── */
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {/* Full name */}
              <div className="col-span-2">
                <label className="block text-xs text-cream-300 mb-1.5">Full Name *</label>
                <input
                  required
                  value={regForm.name}
                  onChange={e => setRegForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full bg-navy-800 border border-gold-400/15 rounded-lg px-4 py-2.5 text-sm text-cream-100 focus:outline-none focus:border-gold-400/40"
                />
              </div>

              {/* Email */}
              <div className="col-span-2">
                <label className="block text-xs text-cream-300 mb-1.5">Email *</label>
                <input
                  required
                  type="email"
                  value={regForm.email}
                  onChange={e => setRegForm(f => ({ ...f, email: e.target.value }))}
                  className="w-full bg-navy-800 border border-gold-400/15 rounded-lg px-4 py-2.5 text-sm text-cream-100 focus:outline-none focus:border-gold-400/40"
                />
              </div>

              {/* Phone */}
              <div className="col-span-2">
                <label className="block text-xs text-cream-300 mb-1.5">Phone</label>
                <input
                  value={regForm.phone}
                  onChange={e => setRegForm(f => ({ ...f, phone: e.target.value }))}
                  className="w-full bg-navy-800 border border-gold-400/15 rounded-lg px-4 py-2.5 text-sm text-cream-100 focus:outline-none focus:border-gold-400/40"
                />
              </div>

              {/* Password */}
              <div className="col-span-2 relative">
                <label className="block text-xs text-cream-300 mb-1.5">Password *</label>
                <input
                  required
                  type={showPass ? 'text' : 'password'}
                  value={regForm.password}
                  onChange={e => setRegForm(f => ({ ...f, password: e.target.value }))}
                  className="w-full bg-navy-800 border border-gold-400/15 rounded-lg px-4 py-2.5 text-sm text-cream-100 focus:outline-none focus:border-gold-400/40"
                />
                {/* Password Criteria */}
                {regForm.password && <PasswordCriteria password={regForm.password} />}
              </div>

              {/* Confirm password */}
              <div className="col-span-2 relative">
                <label className="block text-xs text-cream-300 mb-1.5">Confirm Password *</label>
                <input
                  required
                  type={showPass ? 'text' : 'password'}
                  value={regForm.confirmPassword}
                  onChange={e => setRegForm(f => ({ ...f, confirmPassword: e.target.value }))}
                  className="w-full bg-navy-800 border border-gold-400/15 rounded-lg px-4 py-2.5 pr-10 text-sm text-cream-100 focus:outline-none focus:border-gold-400/40"
                />
                {/* Password match indicator */}
                {regForm.confirmPassword && (
                  <div className="absolute right-3 top-[30px]">
                    {regForm.password === regForm.confirmPassword ? (
                      <CheckCircle2 size={16} className="text-emerald-400" />
                    ) : (
                      <XCircle size={16} className="text-red-400" />
                    )}
                  </div>
                )}
                {/* Match status message */}
                {regForm.confirmPassword && regForm.password !== regForm.confirmPassword && (
                  <p className="text-xs text-red-300 mt-1.5">Passwords do not match</p>
                )}
                {regForm.confirmPassword && regForm.password === regForm.confirmPassword && regForm.password.length >= 8 && (
                  <p className="text-xs text-emerald-400 mt-1.5">✓ Passwords match</p>
                )}
              </div>

              {/* Show/hide toggle */}
              <div className="col-span-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowPass(v => !v)}
                  className="flex items-center gap-1.5 text-xs text-cream-300 hover:text-cream-100"
                >
                  {showPass ? <EyeOff size={13} /> : <Eye size={13} />}
                  {showPass ? 'Hide passwords' : 'Show passwords'}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-gold-400 hover:bg-gold-300 text-navy-950 font-semibold py-3 rounded-lg transition-colors disabled:opacity-60"
            >
              {loading ? 'Creating account…' : <>Create Account <ArrowRight size={14} /></>}
            </button>
          </form>
        )}

        <p className="text-xs text-cream-300/60 text-center mt-6">
          By continuing, you agree to our{' '}
          <a href="#" className="text-gold-400 hover:text-gold-300">Terms of Service</a>
          {' '}and{' '}
          <a href="#" className="text-gold-400 hover:text-gold-300">Privacy Policy</a>.
        </p>
      </div>
    </div>
  );
}
