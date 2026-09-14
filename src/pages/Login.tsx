import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, ArrowRight } from 'lucide-react';
import { useStore, genId } from '../store';
import type { User, UserRole } from '../store';
import logoImg from '../imports/image-3.png';
import loginImage from '../imports/login-cleaning.jpg';

export default function Login() {
  const { state, dispatch } = useStore();
  const navigate = useNavigate();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [regForm, setRegForm] = useState({
    name: '', email: '', phone: '', password: '', confirmPassword: '',
    role: 'customer' as UserRole,
  });

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    setTimeout(() => {
      const user = state.users.find(u => u.email === loginForm.email && u.password === loginForm.password);
      if (user) {
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
        membershipTier: null,
        membershipStatus: 'none',
        partnerApplicationId: null,
        createdAt: new Date().toISOString(),
      };
      dispatch({ type: 'REGISTER', payload: user });
      navigate(user.role === 'partner' ? '/portal/partner' : '/');
      setLoading(false);
    }, 800);
  }

  const demoAccounts = [
    { label: 'Admin', email: 'admin@luxclean.com', password: 'admin123' },
    { label: 'Customer', email: 'customer@demo.com', password: 'demo123' },
    { label: 'Cleaner', email: 'cleaner@demo.com', password: 'demo123' },
    { label: 'Partner', email: 'partner@demo.com', password: 'demo123' },
  ];

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
      <div className="flex-1 flex flex-col justify-center px-8 md:px-12 lg:max-w-md xl:max-w-lg">
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

        {/* Demo accounts */}
        <div className="bg-navy-800 border border-gold-400/15 rounded-xl p-4 mb-6">
          <div className="text-xs text-cream-300/70 mb-2 font-medium">Demo accounts (click to fill):</div>
          <div className="flex flex-wrap gap-2">
            {demoAccounts.map(acc => (
              <button
                key={acc.label}
                onClick={() => { setLoginForm({ email: acc.email, password: acc.password }); setMode('login'); }}
                className="text-xs px-3 py-1 rounded-full bg-gold-400/10 border border-gold-400/25 text-gold-400 hover:bg-gold-400/20 transition-colors"
              >
                {acc.label}
              </button>
            ))}
          </div>
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
              <label className="block text-xs text-cream-300 mb-1.5">Email</label>
              <input
                required type="email"
                value={loginForm.email}
                onChange={e => setLoginForm(f => ({ ...f, email: e.target.value }))}
                className="w-full bg-navy-800 border border-gold-400/15 rounded-lg px-4 py-3 text-sm text-cream-100 placeholder-cream-300/40 focus:outline-none focus:border-gold-400/40"
                placeholder="you@example.com"
              />
            </div>
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
              <div>
                <label className="block text-xs text-cream-300 mb-1.5">Phone</label>
                <input value={regForm.phone} onChange={e => setRegForm(f => ({ ...f, phone: e.target.value }))} className="w-full bg-navy-800 border border-gold-400/15 rounded-lg px-4 py-2.5 text-sm text-cream-100 focus:outline-none focus:border-gold-400/40" />
              </div>
              <div>
                <label className="block text-xs text-cream-300 mb-1.5">Account Type</label>
                <select value={regForm.role} onChange={e => setRegForm(f => ({ ...f, role: e.target.value as UserRole }))} className="w-full bg-navy-800 border border-gold-400/15 rounded-lg px-4 py-2.5 text-sm text-cream-100 focus:outline-none focus:border-gold-400/40">
                  <option value="customer">Customer</option>
                  <option value="partner">Business Partner</option>
                </select>
              </div>
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
