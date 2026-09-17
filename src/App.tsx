import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, useCurrentUser, useAuthReady } from './store';
import { signOut } from './lib/supabase';
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
import Login from './pages/Login';
import CustomerPortal from './portals/CustomerPortal';
import CleanerPortal from './portals/CleanerPortal';
import PartnerPortal from './portals/PartnerPortal';
import AdminDashboard from './portals/AdminDashboard';

// ─── Auth guard ───────────────────────────────────────────────────────────────
// Waits for the Supabase session check to finish before rendering.
// While authReady is false, shows a full-screen loading state so users
// never see a flash-of-login-page on a valid session reload.

function ProtectedRoute({ children, role }: { children: React.ReactNode; role?: string }) {
  const user = useCurrentUser();
  const authReady = useAuthReady();

  if (!authReady) {
    return (
      <div className="min-h-screen bg-navy-950 flex items-center justify-center">
        <span className="text-cream-300 text-sm animate-pulse">Loading…</span>
      </div>
    );
  }

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
      <Route path="/login"       element={<LoginRoute />} />

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

  if (!authReady) {
    return (
      <div className="min-h-screen bg-navy-950 flex items-center justify-center">
        <span className="text-cream-300 text-sm animate-pulse">Loading…</span>
      </div>
    );
  }

  if (user) {
    const portal =
      user.role === 'admin'   ? '/portal/admin'
      : user.role === 'cleaner' ? '/portal/cleaner'
      : user.role === 'partner' ? '/portal/partner'
      : '/portal/customer';
    return <Navigate to={portal} replace />;
  }

  return <Login />;
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
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
