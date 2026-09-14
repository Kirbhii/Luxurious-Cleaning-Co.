import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, useCurrentUser } from './store';
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

function ProtectedRoute({ children, role }: { children: React.ReactNode; role?: string }) {
  const user = useCurrentUser();
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-full flex flex-col">
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<PublicLayout><Home /></PublicLayout>} />
      <Route path="/services" element={<PublicLayout><Services /></PublicLayout>} />
      <Route path="/about" element={<PublicLayout><About /></PublicLayout>} />
      <Route path="/membership" element={<PublicLayout><Membership /></PublicLayout>} />
      <Route path="/partnerships" element={<PublicLayout><Partnerships /></PublicLayout>} />
      <Route path="/training" element={<PublicLayout><Training /></PublicLayout>} />
      <Route path="/contact" element={<PublicLayout><Contact /></PublicLayout>} />
      <Route path="/book" element={<PublicLayout><Booking /></PublicLayout>} />
      <Route path="/login" element={<Login />} />
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
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AppProvider>
  );
}
