import { useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, ArrowRight } from 'lucide-react';
import { useStore, genId } from '../store';
import type { User, UserRole } from '../store';
import logoImg from '../imports/image-3.png';
import loginImage from '../imports/login-cleaning.jpg';

export default function Login() {
  const { state, dispatch } = useStore();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [mode, setMode] = useState<'login' | 'register'>(searchParams.get('mode') === 'register' ? 'register' : 'login');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pendingRegistration, setPendingRegistration] = useState<User | null>(null);
  const [pendingAdminLogin, setPendingAdminLogin] = useState<User | null>(null);
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [otpMessage, setOtpMessage] = useState('');
  const otpRefs = useRef<Array<HTMLInputElement | null>>([]);

  const [loginRole, setLoginRole] = useState<UserRole>('customer');
  const [loginForm, setLoginForm] = useState({ identifier: '', password: '', companyCode: '', mfaCode: '' });
  const [regForm, setRegForm] = useState({
    name: '', email: '', phone: '', employeeId: '', companyCode: '', password: '', confirmPassword: '',
    role: 'customer' as UserRole,
  });

  const identifierLabel = loginRole === 'partner'
    ? 'Corporate email address'
    : loginRole === 'cleaner'
      ? 'Email or cleaner ID'
      : loginRole === 'admin'
        ? 'Admin email address'
        : 'Email address or phone number';
  const identifierPlaceholder = loginRole === 'partner'
    ? 'company@example.com'
    : loginRole === 'cleaner'
      ? 'cleaner@example.com or CLN-001'
      : loginRole === 'admin'
        ? 'admin@example.com'
        : 'you@example.com or +1 416 555 0100';

  function updateLoginRole(role: UserRole) {
    setLoginRole(role);
    setLoginForm(form => ({ ...form, identifier: '', companyCode: '', mfaCode: '' }));
    setError('');
  }

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    setTimeout(() => {
      const identifier = loginForm.identifier.trim().toLowerCase();
      const user = state.users.find(account => {
        const matchesIdentifier = account.email.toLowerCase() === identifier
          || account.phone.replace(/\D/g, '') === identifier.replace(/\D/g, '')
          || account.employeeId?.toLowerCase() === identifier;
        const matchesCompany = loginRole !== 'partner' || !loginForm.companyCode.trim()
          || account.companyCode?.toLowerCase() === loginForm.companyCode.trim().toLowerCase();
        return matchesIdentifier && account.password === loginForm.password && account.role === loginRole && matchesCompany;
      });
      if (user?.role === 'admin') {
        setPendingAdminLogin(user);
        setOtp(['', '', '', '', '', '']);
        setOtpMessage('');
      } else if (user) {
        dispatch({ type: 'LOGIN', payload: user });
        const portal = user.role === 'admin' ? '/portal/admin'
          : user.role === 'cleaner' ? '/portal/cleaner'
          : user.role === 'partner' ? '/portal/partner'
          : '/';
        navigate(portal);
      } else {
        setError('Invalid email or password.');
      }
      setLoading(false);
    }, 800);
  }

  function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (regForm.password !== regForm.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (state.users.find(u => u.email === regForm.email)) {
      setError('An account with this email already exists.');
      return;
    }
    setLoading(true);
    setTimeout(() => {
      const user: User = {
        id: genId('u'),
        email: regForm.email,
        password: regForm.password,
        name: regForm.name,
        role: regForm.role,
        phone: regForm.phone,
        employeeId: regForm.employeeId || null,
        companyId: regForm.role === 'partner' ? genId('company') : null,
        companyCode: regForm.companyCode || null,
        assignedZoneId: regForm.role === 'cleaner' ? null : null,
        permissions: regForm.role === 'admin' ? ['manage_users', 'approve_partners'] : [],
        membershipTier: null,
        membershipStatus: 'none',
        partnerApplicationId: null,
        createdAt: new Date().toISOString(),
      };
      if (user.role === 'customer' || user.role === 'admin') {
        setPendingRegistration(user);
        setOtp(['', '', '', '', '', '']);
        setOtpMessage('');
      } else {
        dispatch({ type: 'REGISTER', payload: user });
        navigate(user.role === 'partner' ? '/portal/partner' : '/');
      }
      setLoading(false);
    }, 800);
  }

  function handleOtpChange(index: number, value: string) {
    const digit = value.replace(/\D/g, '').slice(-1);
    const nextOtp = [...otp];
    nextOtp[index] = digit;
    setOtp(nextOtp);
    setOtpMessage('');
    if (digit && index < otp.length - 1) otpRefs.current[index + 1]?.focus();
  }

  function handleOtpKeyDown(index: number, event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Backspace' && !otp[index] && index > 0) otpRefs.current[index - 1]?.focus();
  }

  function handleOtpPaste(event: React.ClipboardEvent<HTMLInputElement>) {
    event.preventDefault();
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6).split('');
    if (!pasted.length) return;
    const nextOtp = ['', '', '', '', '', ''];
    pasted.forEach((digit, index) => { nextOtp[index] = digit; });
    setOtp(nextOtp);
    otpRefs.current[Math.min(pasted.length, 6) - 1]?.focus();
  }

  function confirmOtp() {
    const verifiedUser = pendingRegistration || pendingAdminLogin;
    if (!verifiedUser) return;
    if (otp.join('').length !== 6) {
      setOtpMessage('Enter the complete 6-digit verification code.');
      return;
    }
    if (pendingRegistration) {
      dispatch({ type: 'REGISTER', payload: pendingRegistration });
      navigate(pendingRegistration.role === 'admin' ? '/portal/admin' : '/');
      return;
    }
    dispatch({ type: 'LOGIN', payload: verifiedUser });
    navigate('/portal/admin');
  }

  if (pendingRegistration || pendingAdminLogin) {
    const isAdminVerification = Boolean(pendingAdminLogin);
    const verificationUser = pendingRegistration || pendingAdminLogin;
    return (
      <div className="min-h-screen bg-navy-950 flex items-center justify-center px-6 py-10 relative overflow-hidden">
        <img src={loginImage} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-navy-950/80 backdrop-blur-[2px]" />
        <div className="relative w-full max-w-lg rounded-2xl border border-gold-400/20 bg-navy-900/95 px-6 py-10 text-center shadow-2xl md:px-12">
          <img src={logoImg} alt="Luxurious Cleaning Co." className="mx-auto mb-6 h-10 w-auto object-contain" />
          <h1 className="font-serif text-3xl text-cream-100 mb-2">Verification Code</h1>
          <p className="mx-auto max-w-sm text-sm leading-relaxed text-cream-300">
            Enter the 6-digit {isAdminVerification ? 'MFA' : 'verification'} code sent to <span className="text-cream-100">{verificationUser?.email}</span>.
          </p>
          <div className="mt-8 flex justify-center gap-2 sm:gap-3">
            {otp.map((digit, index) => (
              <input
                key={index}
                ref={element => { otpRefs.current[index] = element; }}
                value={digit}
                onChange={event => handleOtpChange(index, event.target.value)}
                onKeyDown={event => handleOtpKeyDown(index, event)}
                onPaste={handleOtpPaste}
                inputMode="numeric"
                maxLength={1}
                aria-label={`Verification digit ${index + 1}`}
                className="h-12 w-10 rounded-lg border border-gold-400/25 bg-navy-800 text-center text-xl font-semibold text-cream-100 outline-none transition-colors focus:border-gold-400 focus:ring-1 focus:ring-gold-400/40 sm:h-14 sm:w-12"
              />
            ))}
          </div>
          {otpMessage && <p className="mt-4 text-sm text-red-300">{otpMessage}</p>}
          <button
            type="button"
            onClick={confirmOtp}
            className="mt-8 inline-flex items-center justify-center gap-2 rounded-lg bg-gold-400 px-8 py-3 text-sm font-semibold text-navy-950 transition-colors hover:bg-gold-300"
          >
            Confirm <ArrowRight size={14} />
          </button>
          <div className="mt-7 border-t border-gold-400/10 pt-5">
            <p className="text-xs text-cream-300/60">Didn't receive the code?</p>
            <button
              type="button"
              onClick={() => { setOtp(['', '', '', '', '', '']); setOtpMessage('A new verification code has been sent.'); otpRefs.current[0]?.focus(); }}
              className="mt-2 text-xs font-medium text-gold-400 transition-colors hover:text-gold-300"
            >
              Resend Code
            </button>
          </div>
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
      <div className="h-screen flex-1 flex flex-col justify-start overflow-y-auto px-8 py-8 md:px-12 md:py-12 lg:max-w-md xl:max-w-lg">
        <div className="mb-8">
          <Link to="/" className="flex items-center self-start -ml-2 mb-10 translate-y-6">
            <img src={logoImg} alt="Luxurious Cleaning Co." className="h-10 w-auto object-contain" />
          </Link>
          <h1 className="font-serif text-3xl text-cream-100 mb-1">
            {mode === 'login' ? 'Welcome back' : 'Create an account'}
          </h1>
          <p className="text-sm text-cream-300">
            {mode === 'login' ? "Sign in to your portal" : "Join to book, track, and manage your services"}
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex bg-navy-800 rounded-xl p-1 mb-6">
          <button
            onClick={() => { setMode('login'); setError(''); }}
            className={`flex-1 text-sm py-2 rounded-lg transition-colors font-medium ${mode === 'login' ? 'bg-gold-400 text-navy-950' : 'text-cream-300 hover:text-cream-100'}`}
          >
            Sign In
          </button>
          <button
            onClick={() => { setMode('register'); setError(''); }}
            className={`flex-1 text-sm py-2 rounded-lg transition-colors font-medium ${mode === 'register' ? 'bg-gold-400 text-navy-950' : 'text-cream-300 hover:text-cream-100'}`}
          >
            Register
          </button>
        </div>

        {error && (
          <div className="bg-red-400/10 border border-red-400/25 rounded-lg px-4 py-3 text-sm text-red-400 mb-4">
            {error}
          </div>
        )}

        {mode === 'login' ? (
          <form onSubmit={handleLogin} className="space-y-4">
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
            <div>
              <label className="block text-xs text-cream-300 mb-1.5">{identifierLabel}</label>
              <input
                required type={loginRole === 'cleaner' ? 'text' : 'email'}
                value={loginForm.identifier}
                onChange={e => setLoginForm(f => ({ ...f, identifier: e.target.value }))}
                className="w-full bg-navy-800 border border-gold-400/15 rounded-lg px-4 py-3 text-sm text-cream-100 placeholder-cream-300/40 focus:outline-none focus:border-gold-400/40"
                placeholder={identifierPlaceholder}
              />
            </div>
            {loginRole === 'partner' && (
              <div>
                <label className="block text-xs text-cream-300 mb-1.5">Company code <span className="text-cream-300/50">(optional)</span></label>
                <input
                  value={loginForm.companyCode}
                  onChange={e => setLoginForm(f => ({ ...f, companyCode: e.target.value }))}
                  className="w-full bg-navy-800 border border-gold-400/15 rounded-lg px-4 py-3 text-sm text-cream-100 placeholder-cream-300/40 focus:outline-none focus:border-gold-400/40"
                  placeholder="ACG-001"
                />
              </div>
            )}
            <div className="relative">
              <label className="block text-xs text-cream-300 mb-1.5">Password</label>
              <input
                required type={showPass ? 'text' : 'password'}
                value={loginForm.password}
                onChange={e => setLoginForm(f => ({ ...f, password: e.target.value }))}
                className="w-full bg-navy-800 border border-gold-400/15 rounded-lg px-4 py-3 pr-11 text-sm text-cream-100 focus:outline-none focus:border-gold-400/40"
              />
              <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-[30px] text-cream-300 hover:text-cream-100">
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
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs text-cream-300 mb-1.5">Full Name *</label>
                <input required value={regForm.name} onChange={e => setRegForm(f => ({ ...f, name: e.target.value }))} className="w-full bg-navy-800 border border-gold-400/15 rounded-lg px-4 py-2.5 text-sm text-cream-100 focus:outline-none focus:border-gold-400/40" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-cream-300 mb-1.5">Email *</label>
                <input required type="email" value={regForm.email} onChange={e => setRegForm(f => ({ ...f, email: e.target.value }))} className="w-full bg-navy-800 border border-gold-400/15 rounded-lg px-4 py-2.5 text-sm text-cream-100 focus:outline-none focus:border-gold-400/40" />
              </div>
              {regForm.role === 'cleaner' && (
                <div className="col-span-2">
                  <label className="block text-xs text-cream-300 mb-1.5">Employee / cleaner ID</label>
                  <input value={regForm.employeeId} onChange={e => setRegForm(f => ({ ...f, employeeId: e.target.value }))} className="w-full bg-navy-800 border border-gold-400/15 rounded-lg px-4 py-2.5 text-sm text-cream-100 focus:outline-none focus:border-gold-400/40" placeholder="CLN-001" />
                </div>
              )}
              <div>
                <label className="block text-xs text-cream-300 mb-1.5">Phone</label>
                <input value={regForm.phone} onChange={e => setRegForm(f => ({ ...f, phone: e.target.value }))} className="w-full bg-navy-800 border border-gold-400/15 rounded-lg px-4 py-2.5 text-sm text-cream-100 focus:outline-none focus:border-gold-400/40" />
              </div>
              <div>
                <label className="block text-xs text-cream-300 mb-1.5">Account Type</label>
                <select value={regForm.role} onChange={e => setRegForm(f => ({ ...f, role: e.target.value as UserRole }))} className="w-full bg-navy-800 border border-gold-400/15 rounded-lg px-4 py-2.5 text-sm text-cream-100 focus:outline-none focus:border-gold-400/40">
                  <option value="customer">Customer</option>
                  <option value="partner">Partnered company</option>
                  <option value="cleaner">Cleaner</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              {regForm.role === 'partner' && (
                <div className="col-span-2">
                  <label className="block text-xs text-cream-300 mb-1.5">Company code</label>
                  <input value={regForm.companyCode} onChange={e => setRegForm(f => ({ ...f, companyCode: e.target.value }))} className="w-full bg-navy-800 border border-gold-400/15 rounded-lg px-4 py-2.5 text-sm text-cream-100 focus:outline-none focus:border-gold-400/40" placeholder="ACG-001" />
                </div>
              )}
              <div className="relative">
                <label className="block text-xs text-cream-300 mb-1.5">Password *</label>
                <input required type={showPass ? 'text' : 'password'} value={regForm.password} onChange={e => setRegForm(f => ({ ...f, password: e.target.value }))} className="w-full bg-navy-800 border border-gold-400/15 rounded-lg px-4 py-2.5 text-sm text-cream-100 focus:outline-none focus:border-gold-400/40" />
              </div>
              <div>
                <label className="block text-xs text-cream-300 mb-1.5">Confirm Password *</label>
                <input required type={showPass ? 'text' : 'password'} value={regForm.confirmPassword} onChange={e => setRegForm(f => ({ ...f, confirmPassword: e.target.value }))} className="w-full bg-navy-800 border border-gold-400/15 rounded-lg px-4 py-2.5 text-sm text-cream-100 focus:outline-none focus:border-gold-400/40" />
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
