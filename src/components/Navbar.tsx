import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Menu, X, Bell, ChevronDown, LogOut, User, LayoutDashboard } from 'lucide-react';
import { useStore, useCurrentUser, useNotifications } from '../store';
import { signOut } from '../lib/supabase';
import logoImg from '../imports/image-3.png';

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const { dispatch } = useStore();
  const user = useCurrentUser();
  const navigate = useNavigate();
  const location = useLocation();
  const notifications = useNotifications(user?.id);
  const unread = notifications.filter(n => !n.read).length;

  const navLinks = [
    { to: '/services', label: 'Services' },
    { to: '/membership', label: 'Membership' },
    { to: '/training', label: 'Training' },
    { to: '/partnerships', label: 'Partnerships' },
    { to: '/about', label: 'About' },
    { to: '/contact', label: 'Contact' },
  ];

  const portalPath = user ? (
    user.role === 'admin' ? '/portal/admin'
    : user.role === 'cleaner' ? '/portal/cleaner'
    : user.role === 'partner' ? '/portal/partner'
    : '/portal/customer'
  ) : '/login';

  async function handleLogout() {
    await signOut();
    dispatch({ type: 'LOGOUT' });
    navigate('/');
    setMenuOpen(false);
  }

  function isActive(path: string) {
    return location.pathname === path;
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-navy-950/97 backdrop-blur-md border-b border-gold-400/15">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center group" onClick={() => setMenuOpen(false)}>
          <img src={logoImg} alt="Luxurious Cleaning Co." className="h-10 w-auto object-contain" />
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden lg:flex items-center gap-6">
          {navLinks.map(link => (
            <Link
              key={link.to}
              to={link.to}
              className={`text-xs font-bold uppercase tracking-wider transition-colors ${isActive(link.to) ? 'text-gold-400' : 'text-cream-200 hover:text-gold-400'}`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Right actions */}
        <div className="flex items-center gap-3">
          {user ? (
            <>
              {/* Notification bell */}
              <div className="relative">
                <button
                  onClick={() => setNotifOpen(!notifOpen)}
                  className="relative w-9 h-9 flex items-center justify-center rounded-full border border-gold-400/20 hover:border-gold-400/50 transition-colors"
                >
                  <Bell size={15} className="text-cream-200" />
                  {unread > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-gold-400 rounded-full text-navy-950 text-[9px] font-bold flex items-center justify-center">
                      {unread}
                    </span>
                  )}
                </button>
                {notifOpen && (
                  <div className="absolute right-0 top-11 w-80 bg-navy-800 border border-gold-400/15 rounded-xl shadow-2xl overflow-hidden z-50">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gold-400/10">
                      <span className="text-sm font-medium text-cream-100">Notifications</span>
                      {unread > 0 && (
                        <button
                          onClick={() => { dispatch({ type: 'MARK_ALL_READ', payload: user.id }); }}
                          className="text-xs text-gold-400 hover:text-gold-300"
                        >
                          Mark all read
                        </button>
                      )}
                    </div>
                    <div className="max-h-72 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className="px-4 py-6 text-center text-cream-300 text-sm">No notifications</div>
                      ) : notifications.slice(0, 5).map(n => (
                        <div
                          key={n.id}
                          onClick={() => {
                            dispatch({ type: 'MARK_NOTIFICATION_READ', payload: n.id });
                            setNotifOpen(false);
                            navigate(n.link);
                          }}
                          className={`px-4 py-3 border-b border-gold-400/5 cursor-pointer hover:bg-navy-700 transition-colors ${!n.read ? 'bg-gold-400/5' : ''}`}
                        >
                          <div className="flex items-start gap-2">
                            {!n.read && <div className="w-1.5 h-1.5 bg-gold-400 rounded-full mt-1.5 shrink-0" />}
                            <div className={!n.read ? '' : 'pl-3.5'}>
                              <div className="text-sm font-medium text-cream-100 leading-snug">{n.title}</div>
                              <div className="text-xs text-cream-300 mt-0.5 leading-snug">{n.message}</div>
                              <div className="text-xs text-cream-300/60 mt-1">{new Date(n.createdAt).toLocaleDateString()}</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* User menu */}
              <div className="relative hidden md:block">
                <button
                  onClick={() => setMenuOpen(!menuOpen)}
                  className="flex items-center gap-2 text-sm text-cream-200 hover:text-cream-50"
                >
                  <div className="w-7 h-7 rounded-full bg-gold-400/20 border border-gold-400/30 flex items-center justify-center">
                    <span className="text-gold-400 text-xs font-semibold">{user.name[0]}</span>
                  </div>
                  <ChevronDown size={12} />
                </button>
                {menuOpen && (
                  <div className="absolute right-0 top-10 w-48 bg-navy-800 border border-gold-400/15 rounded-xl shadow-2xl overflow-hidden">
                    <div className="px-3 py-2.5 border-b border-gold-400/10">
                      <div className="text-sm font-medium text-cream-100">{user.name}</div>
                      <div className="text-xs text-cream-300 capitalize">{user.role}</div>
                    </div>
                    <Link to={portalPath} onClick={() => setMenuOpen(false)} className="flex items-center gap-2 px-3 py-2.5 text-sm text-cream-200 hover:bg-navy-700 hover:text-cream-50 transition-colors">
                      <LayoutDashboard size={13} />Portal
                    </Link>
                    <button onClick={handleLogout} className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-red-400 hover:bg-navy-700 transition-colors">
                      <LogOut size={13} />Sign Out
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <Link to="/login" className="hidden md:block text-sm text-cream-200 hover:text-cream-50 transition-colors">
                Sign In
              </Link>
              <Link to="/book" className="hidden md:flex items-center gap-1.5 text-xs font-black uppercase tracking-wider bg-gold-400 hover:bg-gold-300 text-navy-950 px-5 py-2 rounded-lg transition-colors">
                Book a Service
              </Link>
            </>
          )}

          {/* Mobile menu toggle */}
          <button onClick={() => setMenuOpen(!menuOpen)} className="lg:hidden w-9 h-9 flex items-center justify-center">
            {menuOpen ? <X size={20} className="text-cream-100" /> : <Menu size={20} className="text-cream-100" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="lg:hidden bg-navy-900 border-t border-gold-400/10 px-6 py-4 space-y-1">
          {navLinks.map(link => (
            <Link
              key={link.to}
              to={link.to}
              onClick={() => setMenuOpen(false)}
              className="block py-2.5 text-sm text-cream-200 hover:text-cream-50 border-b border-gold-400/5 transition-colors"
            >
              {link.label}
            </Link>
          ))}
          <div className="pt-3 space-y-2">
            {user ? (
              <>
                <Link to={portalPath} onClick={() => setMenuOpen(false)} className="flex items-center gap-2 py-2 text-sm text-gold-400">
                  <LayoutDashboard size={14} />{user.role === 'customer' ? 'Customer Portal' : 'My Portal'}
                </Link>
                <button onClick={handleLogout} className="flex items-center gap-2 py-2 text-sm text-red-400">
                  <LogOut size={14} />Sign Out
                </button>
              </>
            ) : (
              <>
                <Link to="/login" onClick={() => setMenuOpen(false)} className="block py-2 text-sm text-cream-200">Sign In</Link>
                <Link to="/book" onClick={() => setMenuOpen(false)} className="block text-center bg-gold-400 text-navy-950 text-sm font-medium py-2.5 rounded-lg">Book a Service</Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
