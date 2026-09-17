import { useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, ArrowRight } from 'lucide-react';
import type { UserRole } from '../store';
import {
  signIn,
  signUp,
  fetchProfile,
  challengeAdminMfa,
  verifyAdminMfa,
  listMfaFactors,
} from '../lib/supabase';
import logoImg from '../imports/image-3.png';
import loginImage from '../imports/login-cleaning.jpg';

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

  const [mode, setMode] = useState<'login' | 'register'>(
    searchParams.get('mode') === 'register' ? 'register' : 'login'
  );
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // OTP / MFA state
  const [pendingMfa, setPendingMfa] = useState<PendingMfa | null>(null);
  const [pendingVerifyEmail, setPendingVerifyEmail] = useState(''); // email-verify after signup
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [otpMessage, setOtpMessage] = useState('');
  const otpRefs = useRef<Array<HTMLInputElement | null>>([]);

  // Role selector (login form only)
  const [loginRole, setLoginRole] = useState<UserRole>('customer');
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
    role: 'customer',
  });

  // ── Dynamic labels ──────────────────────────────────────────────────────────
  const identifierLabel =
    loginRole === 'partner' ? 'Corporate email address'
    : loginRole === 'cleaner' ? 'Email address'
    : loginRole === 'admin' ? 'Admin email address'
    : 'Email address or phone number';

  const identifierPlaceholder =
    loginRole === 'partner' ? 'company@example.com'
    : loginRole === 'cleaner' ? 'cleaner@example.com'
    : loginRole === 'admin' ? 'admin@example.com'
    : 'you@example.com';

  // ── Helpers ─────────────────────────────────────────────────────────────────
  function portalFor(role: UserRole) {
    if (role === 'admin') return '/portal/admin';
    if (role === 'cleaner') return '/portal/cleaner';
    if (role === 'partner') return '/portal/partner';
    return '/portal/customer';
  }

  function updateLoginRole(role: UserRole) {
    setLoginRole(role);
    setLoginForm({ identifier: '', password: '', companyCode: '' });
    setError('');
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
        setError(authError?.message ?? 'Invalid email or password.');
        return;
      }

      // 2. Fetch the profile to get the role
      const profile = await fetchProfile(authData.user.id);
      if (!profile) {
        setError('Account profile not found. Please contact support.');
        return;
      }

      // 3. Validate the selected role matches what's stored
      if (profile.role !== loginRole) {
        setError(`This account is not registered as a ${loginRole}. Please select the correct account type.`);
        return;
      }

      // 4. Admin → require MFA if enrolled
      if (profile.role === 'admin') {
        const { data: factorsData } = await listMfaFactors();
        const totpFactor = factorsData?.totp?.[0];

        if (totpFactor) {
          // Factor exists — challenge it
          const { data: challengeData, error: challengeError } = await challengeAdminMfa(totpFactor.id);
          if (challengeError || !challengeData) {
            setError('Failed to start MFA challenge. Please try again.');
            return;
          }
          setPendingMfa({ factorId: totpFactor.id, challengeId: challengeData.id });
          setOtp(['', '', '', '', '', '']);
          setOtpMessage('');
          return; // Wait for OTP screen
        }
        // No MFA factor enrolled yet — allow login but prompt setup in the dashboard
      }

      // 5. Success — navigate to correct portal
      navigate(portalFor(profile.role));
    } catch (err) {
      console.error('[Login]', err);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  // ── Register ────────────────────────────────────────────────────────────────
  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (regForm.password !== regForm.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (regForm.password.length < 8) {
      setError('Password must be at least 8 characters.');
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
        return;
      }

      // Supabase sends a confirmation email by default.
      // If email confirmations are disabled in your project settings,
      // data.session will be non-null and we can navigate immediately.
      if (data.session) {
        const profile = await fetchProfile(data.user!.id);
        navigate(portalFor(profile?.role ?? regForm.role));
      } else {
        // Needs email verification
        setPendingVerifyEmail(regForm.email.trim().toLowerCase());
        setOtp(['', '', '', '', '', '']);
        setOtpMessage('');
      }
    } catch (err) {
      console.error('[Register]', err);
      setError('An unexpected error occurred. Please try again.');
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
          <img src={logoImg} alt="Luxurious Cleaning Co." className="mx-auto mb-6 h-10 w-auto object-contain" />

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
          <Link to="/" className="flex items-center self-start -ml-2 mb-10 translate-y-6">
            <img src={logoImg} alt="Luxurious Cleaning Co." className="h-10 w-auto object-contain" />
          </Link>
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

        {/* ── Sign In form ── */}
        {mode === 'login' ? (
          <form onSubmit={handleLogin} className="space-y-4">
            {/* Role selector */}
            <div>
              <label className="block text-xs text-cream-300 mb-1.5">Account type</label>
              <select
                value={loginRole}
                onChange={e => updateLoginRole(e.target.value as UserRole)}
                className="w-full bg-navy-800 border border-gold-400/15 rounded-lg px-4 py-3 text-sm text-cream-100 focus:outline-none focus:border-gold-400/40"
              >
                <option value="customer">Customer</option>
                <option value="partner">Partnered company</option>
                <option value="cleaner">Cleaner</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            {/* Email / identifier */}
            <div>
              <label className="block text-xs text-cream-300 mb-1.5">{identifierLabel}</label>
              <input
                required
                type="email"
                value={loginForm.identifier}
                onChange={e => setLoginForm(f => ({ ...f, identifier: e.target.value }))}
                placeholder={identifierPlaceholder}
                className="w-full bg-navy-800 border border-gold-400/15 rounded-lg px-4 py-3 text-sm text-cream-100 placeholder-cream-300/40 focus:outline-none focus:border-gold-400/40"
              />
            </div>

            {/* Optional company code for partners */}
            {loginRole === 'partner' && (
              <div>
                <label className="block text-xs text-cream-300 mb-1.5">
                  Company code <span className="text-cream-300/50">(optional)</span>
                </label>
                <input
                  value={loginForm.companyCode}
                  onChange={e => setLoginForm(f => ({ ...f, companyCode: e.target.value }))}
                  placeholder="ACG-001"
                  className="w-full bg-navy-800 border border-gold-400/15 rounded-lg px-4 py-3 text-sm text-cream-100 placeholder-cream-300/40 focus:outline-none focus:border-gold-400/40"
                />
              </div>
            )}

            {/* Admin MFA hint */}
            {loginRole === 'admin' && (
              <p className="text-xs text-cream-300/60 bg-navy-800 rounded-lg px-3 py-2 border border-gold-400/10">
                Admin accounts with an authenticator app enrolled will be prompted for a 6-digit code after the password step.
              </p>
            )}

            {/* Password */}
            <div className="relative">
              <label className="block text-xs text-cream-300 mb-1.5">Password</label>
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

              {/* Cleaner: employee ID */}
              {regForm.role === 'cleaner' && (
                <div className="col-span-2">
                  <label className="block text-xs text-cream-300 mb-1.5">Employee / Cleaner ID</label>
                  <input
                    value={regForm.employeeId}
                    onChange={e => setRegForm(f => ({ ...f, employeeId: e.target.value }))}
                    placeholder="CLN-001"
                    className="w-full bg-navy-800 border border-gold-400/15 rounded-lg px-4 py-2.5 text-sm text-cream-100 focus:outline-none focus:border-gold-400/40"
                  />
                </div>
              )}

              {/* Phone */}
              <div>
                <label className="block text-xs text-cream-300 mb-1.5">Phone</label>
                <input
                  value={regForm.phone}
                  onChange={e => setRegForm(f => ({ ...f, phone: e.target.value }))}
                  className="w-full bg-navy-800 border border-gold-400/15 rounded-lg px-4 py-2.5 text-sm text-cream-100 focus:outline-none focus:border-gold-400/40"
                />
              </div>

              {/* Account type */}
              <div>
                <label className="block text-xs text-cream-300 mb-1.5">Account Type</label>
                <select
                  value={regForm.role}
                  onChange={e => setRegForm(f => ({ ...f, role: e.target.value as UserRole }))}
                  className="w-full bg-navy-800 border border-gold-400/15 rounded-lg px-4 py-2.5 text-sm text-cream-100 focus:outline-none focus:border-gold-400/40"
                >
                  <option value="customer">Customer</option>
                  <option value="partner">Partnered company</option>
                  <option value="cleaner">Cleaner</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              {/* Partner: company code */}
              {regForm.role === 'partner' && (
                <div className="col-span-2">
                  <label className="block text-xs text-cream-300 mb-1.5">Company code</label>
                  <input
                    value={regForm.companyCode}
                    onChange={e => setRegForm(f => ({ ...f, companyCode: e.target.value }))}
                    placeholder="ACG-001"
                    className="w-full bg-navy-800 border border-gold-400/15 rounded-lg px-4 py-2.5 text-sm text-cream-100 focus:outline-none focus:border-gold-400/40"
                  />
                </div>
              )}

              {/* Password */}
              <div className="relative">
                <label className="block text-xs text-cream-300 mb-1.5">Password *</label>
                <input
                  required
                  type={showPass ? 'text' : 'password'}
                  value={regForm.password}
                  onChange={e => setRegForm(f => ({ ...f, password: e.target.value }))}
                  className="w-full bg-navy-800 border border-gold-400/15 rounded-lg px-4 py-2.5 text-sm text-cream-100 focus:outline-none focus:border-gold-400/40"
                />
              </div>

              {/* Confirm password */}
              <div>
                <label className="block text-xs text-cream-300 mb-1.5">Confirm Password *</label>
                <input
                  required
                  type={showPass ? 'text' : 'password'}
                  value={regForm.confirmPassword}
                  onChange={e => setRegForm(f => ({ ...f, confirmPassword: e.target.value }))}
                  className="w-full bg-navy-800 border border-gold-400/15 rounded-lg px-4 py-2.5 text-sm text-cream-100 focus:outline-none focus:border-gold-400/40"
                />
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
