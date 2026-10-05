import { useLayoutEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useSearchParams } from 'react-router-dom';
import { AppProvider, useCurrentUser, useAuthReady, useMfaPending, useMfaRequired } from './store';
import { signOut } from './lib/supabase';
import { ToastProvider } from './components/ToastContainer';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Home from './pages/Home';
import Services from './pages/Services';
import About from './pages/About';
import Membership from './pages/Membership';
import Partnerships from './pages/Partnerships';
import Training from './pages/Training';
import Contact from './pages/Contact';
import Booking from './pages/Booking';
import Privacy from './pages/Privacy';
import Terms from './pages/Terms';
import Login from './pages/Login';
import ResetPassword from './pages/ResetPassword';
import CustomerPortal from './portals/CustomerPortal';
import CleanerPortal from './portals/CleanerPortal';
import PartnerPortal from './portals/PartnerPortal';
import AdminDashboard from './portals/AdminDashboard';

// ─── Scroll restoration ───────────────────────────────────────────────────────
// Resets the viewport to the top on every route change so pages like
// /membership always start at the top instead of inheriting the previous
// page's scroll position. Runs in useLayoutEffect (before paint) and resets
// both window and documentElement, since global CSS pins overflow on <html>.

function ScrollToTop() {
  const { pathname, search } = useLocation();

  useLayoutEffect(() => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [pathname, search]);

  return null;
}

// ─── Auth guard ───────────────────────────────────────────────────────────────
// Waits for the Supabase session check to finish before rendering.
// While authReady is false, shows a full-screen loading state so users
// never see a flash-of-login-page on a valid session reload.

function ProtectedRoute({ children, role }: { children: React.ReactNode; role?: string }) {
  const user = useCurrentUser();
  const authReady = useAuthReady();
  const mfaRequired = useMfaRequired();
  const mfaPending = useMfaPending();

  if (!authReady) {
    return (
      <div className="min-h-screen bg-navy-950 flex items-center justify-center">
        <span className="text-cream-300 text-sm animate-pulse">Loading…</span>
      </div>
    );
  }

  // The session is only aal1 — the password was accepted but the second factor
  // has not been given. Treat it as not signed in, so neither a direct
  // navigation nor a page reload can reach a portal without the OTP screen.
  if (mfaRequired || mfaPending) return <Navigate to="/login" replace />;
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <Navigate to="/" replace />;
  return <>{children}</>;
}

// ─── Layouts ──────────────────────────────────────────────────────────────────

function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-full flex flex-col">
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}

// ─── Routes ───────────────────────────────────────────────────────────────────

function AppRoutes() {
  return (
    <Routes>
      {/* Public pages */}
      <Route path="/"            element={<PublicLayout><Home /></PublicLayout>} />
      <Route path="/services"    element={<PublicLayout><Services /></PublicLayout>} />
      <Route path="/about"       element={<PublicLayout><About /></PublicLayout>} />
      <Route path="/membership"  element={<PublicLayout><Membership /></PublicLayout>} />
      <Route path="/partnerships" element={<PublicLayout><Partnerships /></PublicLayout>} />
      <Route path="/training"    element={<PublicLayout><Training /></PublicLayout>} />
      <Route path="/contact"     element={<PublicLayout><Contact /></PublicLayout>} />
      <Route path="/book"        element={<PublicLayout><Booking /></PublicLayout>} />
      <Route path="/privacy"     element={<PublicLayout><Privacy /></PublicLayout>} />
      <Route path="/terms"       element={<PublicLayout><Terms /></PublicLayout>} />
      <Route path="/login"       element={<LoginRoute />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* Protected portals — each locked to its role */}
      <Route path="/portal/customer" element={
        <ProtectedRoute role="customer"><CustomerPortal /></ProtectedRoute>
      } />
      <Route path="/portal/cleaner" element={
        <ProtectedRoute role="cleaner"><CleanerPortal /></ProtectedRoute>
      } />
      <Route path="/portal/partner" element={
        <ProtectedRoute role="partner"><PartnerPortal /></ProtectedRoute>
      } />
      <Route path="/portal/admin" element={
        <ProtectedRoute role="admin"><AdminDashboard /></ProtectedRoute>
      } />

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

// Redirect already-authenticated users away from /login to their portal
function LoginRoute() {
  const user = useCurrentUser();
  const authReady = useAuthReady();
  const mfaRequired = useMfaRequired();
  const mfaPending = useMfaPending();
  const [searchParams] = useSearchParams();

  if (!authReady) {
    return (
      <div className="min-h-screen bg-navy-950 flex items-center justify-center">
        <span className="text-cream-300 text-sm animate-pulse">Loading…</span>
      </div>
    );
  }

  // A user is published together with the step-up verdict (see SET_SESSION), so
  // this only redirects once the session is genuinely fully authenticated.
  // Redirecting on `user` alone unmounted <Login /> mid-challenge, which is why
  // the OTP screen never appeared, and it waved a stored aal1 session straight
  // into the portal on reload.
  if (user && !mfaRequired && !mfaPending) {
    const redirect = searchParams.get('redirect');
    const safeRedirect =
      redirect && redirect.startsWith('/') &&
      !redirect.startsWith('/login') &&
      !redirect.startsWith('/reset-password') &&
      !redirect.startsWith('/portal')
        ? redirect
        : null;
    // Customers honor ?redirect= (e.g. /book from the auth prompt); staff go to portal
    if (safeRedirect && user.role === 'customer') {
      return <Navigate to={safeRedirect} replace />;
    }
    const portal =
      user.role === 'admin'   ? '/portal/admin'
      : user.role === 'cleaner' ? '/portal/cleaner'
      : user.role === 'partner' ? '/portal/partner'
      : '/'; // Customers go to home page
    return <Navigate to={portal} replace />;
  }

  return <Login />;
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <AppProvider>
      <ToastProvider>
        <BrowserRouter>
          <ScrollToTop />
          <AppRoutes />
        </BrowserRouter>
      </ToastProvider>
    </AppProvider>
  );
}

// ─── signOut export for use in portals / Navbar ───────────────────────────────
// Portals call this and React Router's navigate('/login') to log out.
// Example usage in any component:
//   import { handleSignOut } from '../App';  ← don't do this; import signOut from supabase directly.
//
// Instead, portals should import signOut from '../lib/supabase' and navigate('/login').
// This comment is kept here for discoverability.
export { signOut };
