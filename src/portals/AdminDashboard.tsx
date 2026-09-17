import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, CalendarCheck, Briefcase, GraduationCap, MessageSquare,
  CheckCircle2, XCircle, ArrowRight, UserCog, LogOut, Trash2,
} from 'lucide-react';
import { useStore, useCurrentUser, STATUS_LABELS, STATUS_COLORS, genId } from '../store';
import type { BookingStatus, PartnerApplication } from '../store';

const BOOKING_STATUSES: BookingStatus[] = [
  'pending', 'confirmed', 'cleaner_assigned', 'en_route', 'in_progress', 'completed', 'cancelled', 'awaiting_quote',
];

const USER_ROLE_FILTERS = ['all', 'admin', 'customer', 'cleaner', 'partner'] as const;
const COMPANY_STATUS_FILTERS = ['all', 'pending', 'approved', 'rejected'] as const;

export default function AdminDashboard() {
  const { state, dispatch } = useStore();
  const user = useCurrentUser()!;
  const navigate = useNavigate();
  const [tab, setTab] = useState<'overview' | 'bookings' | 'users' | 'partners' | 'training' | 'messages'>('overview');
  const [bookingFilter, setBookingFilter] = useState<'all' | 'pending' | 'completed' | 'cancelled'>('all');
  const [userRoleFilter, setUserRoleFilter] = useState<(typeof USER_ROLE_FILTERS)[number]>('all');
  const [companyStatusFilter, setCompanyStatusFilter] = useState<(typeof COMPANY_STATUS_FILTERS)[number]>('all');

  const customers = state.users.filter(u => u.role === 'customer');
  const cleaners = state.users.filter(u => u.role === 'cleaner');
  const partners = state.users.filter(u => u.role === 'partner');
  const filteredUsers = state.users.filter(u => userRoleFilter === 'all' || u.role === userRoleFilter);
  const filteredPartnerApplications = state.partnerApplications.filter(app => {
    if (companyStatusFilter === 'all') return true;
    if (companyStatusFilter === 'pending') return app.status === 'submitted' || app.status === 'under_review';
    return app.status === companyStatusFilter;
  });
  const totalBookings = state.bookings.length;
  const pendingBookings = state.bookings.filter(b => b.status === 'pending').length;
  const activeBookings = state.bookings.filter(b => ['confirmed', 'cleaner_assigned', 'en_route', 'in_progress'].includes(b.status)).length;
  const completedBookings = state.bookings.filter(b => b.status === 'completed').length;
  const activeMembers = state.users.filter(u => u.membershipStatus === 'active').length;
  const pendingApps = state.partnerApplications.filter(p => p.status === 'submitted' || p.status === 'under_review').length;
  const trainingApps = state.trainingApplications.length;
  const unreadMessages = state.contactMessages.filter(m => !m.read).length;

  function handleLogout() {
    dispatch({ type: 'LOGOUT' });
    navigate('/login');
  }

  function deleteBooking(bookingId: string) {
    if (window.confirm('Delete this booking permanently?')) {
      dispatch({ type: 'DELETE_BOOKING', payload: bookingId });
    }
  }

  function updateBookingStatus(bookingId: string, newStatus: BookingStatus, cleanerId?: string) {
    const booking = state.bookings.find(b => b.id === bookingId);
    if (!booking) return;
    const event = {
      id: genId('tl'),
      event: STATUS_LABELS[newStatus],
      note: `Status updated to ${STATUS_LABELS[newStatus]} by admin.`,
      timestamp: new Date().toISOString(),
      actor: 'Admin',
    };
    const updated = {
      ...booking,
      status: newStatus,
      cleanerId: cleanerId || booking.cleanerId,
      timeline: [...booking.timeline, event],
      updatedAt: new Date().toISOString(),
    };
    dispatch({ type: 'UPDATE_BOOKING', payload: updated });
    dispatch({
      type: 'ADD_NOTIFICATION',
      payload: {
        id: genId('n'),
        userId: booking.customerId,
        title: `Booking Update — ${booking.id}`,
        message: `Your booking status has been updated: ${STATUS_LABELS[newStatus]}`,
        read: false,
        link: '/portal/customer',
        createdAt: new Date().toISOString(),
      },
    });
  }

  function assignCleaner(bookingId: string, cleanerId: string) {
    const booking = state.bookings.find(b => b.id === bookingId);
    if (!booking) return;
    const cleaner = state.users.find(u => u.id === cleanerId);
    const event = {
      id: genId('tl'),
      event: 'Cleaner Assigned',
      note: `${cleaner?.name} has been assigned to this booking.`,
      timestamp: new Date().toISOString(),
      actor: 'Admin',
    };
    const updated = {
      ...booking,
      cleanerId,
      status: 'cleaner_assigned' as BookingStatus,
      timeline: [...booking.timeline, event],
      updatedAt: new Date().toISOString(),
    };
    dispatch({ type: 'UPDATE_BOOKING', payload: updated });
    dispatch({
      type: 'ADD_NOTIFICATION',
      payload: {
        id: genId('n'),
        userId: booking.customerId,
        title: `Cleaner Assigned — ${booking.id}`,
        message: `${cleaner?.name} has been assigned to your booking on ${booking.date}.`,
        read: false,
        link: '/portal/customer',
        createdAt: new Date().toISOString(),
      },
    });
    if (cleanerId) {
      dispatch({
        type: 'ADD_NOTIFICATION',
        payload: {
          id: genId('n'),
          userId: cleanerId,
          title: 'New Job Assignment',
          message: `You've been assigned to Booking #${booking.id} on ${booking.date} at ${booking.time}.`,
          read: false,
          link: '/portal/cleaner',
          createdAt: new Date().toISOString(),
        },
      });
    }
  }

  function updatePartnerApp(app: PartnerApplication, status: PartnerApplication['status']) {
    const updated = { ...app, status };
    dispatch({ type: 'UPDATE_PARTNER_APP', payload: updated });
    if (app.userId) {
      dispatch({
        type: 'ADD_NOTIFICATION',
        payload: {
          id: genId('n'),
          userId: app.userId,
          title: `Partnership Application ${status === 'approved' ? 'Approved' : 'Updated'}`,
          message: status === 'approved'
            ? `Congratulations! ${app.companyName} has been approved as a Luxurious Cleaning Co. partner.`
            : `Your partnership application status has been updated to: ${status}.`,
          read: false,
          link: '/portal/partner',
          createdAt: new Date().toISOString(),
        },
      });
    }
  }

  const STATS = [
    { label: 'Total Bookings', value: totalBookings, icon: CalendarCheck, color: 'text-blue-400' },
    { label: 'Pending', value: pendingBookings, icon: CalendarCheck, color: 'text-amber-400' },
    { label: 'Active', value: activeBookings, icon: CalendarCheck, color: 'text-purple-400' },
    { label: 'Completed', value: completedBookings, icon: CheckCircle2, color: 'text-emerald-400' },
    { label: 'Customers', value: customers.length, icon: Users, color: 'text-cream-300' },
    { label: 'Active Members', value: activeMembers, icon: Users, color: 'text-gold-400' },
    { label: 'Cleaners', value: cleaners.length, icon: UserCog, color: 'text-sky-400' },
    { label: 'Partners', value: partners.length, icon: Briefcase, color: 'text-violet-400' },
    { label: 'Partner Leads', value: pendingApps, icon: Briefcase, color: 'text-orange-400' },
    { label: 'Training Apps', value: trainingApps, icon: GraduationCap, color: 'text-teal-400' },
    { label: 'Messages', value: state.contactMessages.length, icon: MessageSquare, color: 'text-pink-400' },
    { label: 'Unread Msgs', value: unreadMessages, icon: MessageSquare, color: 'text-red-400' },
  ];

  return (
    <div className="min-h-screen bg-navy-950">
      <div className="bg-navy-900 border-b border-gold-400/10 pt-16">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-start justify-between gap-4 mb-5">
            <div>
              <div className="text-xs text-gold-400 tracking-[0.2em] uppercase font-medium mb-1">Admin Dashboard</div>
              <h1 className="font-serif text-3xl text-cream-100">Control Center</h1>
            </div>
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-2 rounded-lg border border-red-400/30 bg-red-400/10 px-4 py-2.5 text-sm font-semibold text-red-300 transition-colors hover:border-red-300/50 hover:bg-red-400/20 hover:text-red-200"
            >
              <LogOut size={15} />
              Log out
            </button>
          </div>
          <div className="flex flex-wrap gap-1 border-b border-gold-400/10">
            {[
              { key: 'overview', label: 'Overview' },
              { key: 'bookings', label: 'Bookings', count: totalBookings },
              { key: 'users', label: 'Users', count: state.users.length },
              { key: 'partners', label: 'Partners', count: state.partnerApplications.length },
              { key: 'training', label: 'Training', count: trainingApps },
              { key: 'messages', label: 'Messages', count: unreadMessages },
            ].map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key as typeof tab)}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${tab === t.key ? 'border-gold-400 text-gold-400' : 'border-transparent text-cream-300 hover:text-cream-100'}`}
              >
                {t.label}
                {t.count !== undefined && t.count > 0 && (
                  <span className="text-xs px-1.5 py-0.5 rounded-full bg-navy-700 text-cream-300">{t.count}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {tab === 'overview' && (
          <div>
            <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-4">
              {STATS.map(stat => (
                <div key={stat.label} className="bg-navy-800 border border-gold-400/10 rounded-xl p-4">
                  <div className={`text-2xl font-semibold ${stat.color} mb-0.5`}>{stat.value}</div>
                  <div className="text-xs text-cream-300">{stat.label}</div>
                </div>
              ))}
            </div>

            {/* Recent bookings */}
            <div className="mt-8">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-serif text-xl text-cream-100">Recent Bookings</h3>
                <button onClick={() => setTab('bookings')} className="text-xs text-gold-400 hover:text-gold-300 flex items-center gap-1">
                  View all <ArrowRight size={12} />
                </button>
              </div>
              <div className="bg-navy-800 border border-gold-400/10 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gold-400/10">
                      <th className="text-left px-5 py-3 text-xs text-cream-300/70 font-medium">Booking</th>
                      <th className="text-left px-5 py-3 text-xs text-cream-300/70 font-medium">Customer</th>
                      <th className="text-left px-5 py-3 text-xs text-cream-300/70 font-medium">Service</th>
                      <th className="text-left px-5 py-3 text-xs text-cream-300/70 font-medium">Date</th>
                      <th className="text-left px-5 py-3 text-xs text-cream-300/70 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.bookings.slice(0, 5).map(b => {
                      const customer = state.users.find(u => u.id === b.customerId);
                      return (
                        <tr key={b.id} className="border-b border-gold-400/5 hover:bg-navy-700 transition-colors">
                          <td className="px-5 py-3 text-cream-300 font-mono text-xs">#{b.id}</td>
                          <td className="px-5 py-3 text-cream-100">{customer?.name || 'Guest'}</td>
                          <td className="px-5 py-3 text-cream-200">{b.service}</td>
                          <td className="px-5 py-3 text-cream-300">{b.date}</td>
                          <td className="px-5 py-3">
                            <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_COLORS[b.status]}`}>
                              {STATUS_LABELS[b.status]}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {tab === 'bookings' && (
          <div>
            <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
              <h2 className="font-serif text-2xl text-cream-100">All Bookings</h2>
              <div className="flex flex-wrap gap-2">
                {(['all', 'pending', 'completed', 'cancelled'] as const).map(filter => (
                  <button key={filter} onClick={() => setBookingFilter(filter)} className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${bookingFilter === filter ? 'bg-gold-400 text-navy-950' : 'border border-gold-400/20 text-cream-300 hover:border-gold-400/50'}`}>
                    {filter}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-4">
              {state.bookings.filter(b => bookingFilter === 'all' || b.status === bookingFilter).map(b => {
                const customer = state.users.find(u => u.id === b.customerId);
                const assignedCleaner = b.cleanerId ? state.users.find(u => u.id === b.cleanerId) : null;
                return (
                  <div key={b.id} className="bg-navy-800 border border-gold-400/10 rounded-xl p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-serif text-cream-100">{b.service}</span>
                          <span className="font-mono text-xs text-cream-300/60">#{b.id}</span>
                        </div>
                        <div className="text-xs text-cream-300 mt-0.5">{b.customerName || customer?.name || 'Guest'} · {b.date} at {b.time} · {b.address}</div>
                        <div className="text-xs text-cream-300/70 mt-1">{b.customerEmail || customer?.email || 'No email'} · {b.customerPhone || customer?.phone || 'No phone'}</div>
                      </div>
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${STATUS_COLORS[b.status]}`}>
                        {STATUS_LABELS[b.status]}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      {/* Status change */}
                      <select
                        value={b.status}
                        onChange={e => updateBookingStatus(b.id, e.target.value as BookingStatus)}
                        className="bg-navy-700 border border-gold-400/15 text-cream-100 text-xs rounded-lg px-3 py-2 focus:outline-none"
                      >
                        {BOOKING_STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                      </select>

                      {/* Assign cleaner */}
                      <select
                        value={b.cleanerId || ''}
                        onChange={e => e.target.value && assignCleaner(b.id, e.target.value)}
                        className="bg-navy-700 border border-gold-400/15 text-cream-100 text-xs rounded-lg px-3 py-2 focus:outline-none"
                      >
                        <option value="">Assign cleaner…</option>
                        {cleaners.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>

                      {assignedCleaner && (
                        <span className="text-xs text-cream-300">
                          Assigned: <span className="text-cream-100">{assignedCleaner.name}</span>
                        </span>
                      )}
                      <button onClick={() => deleteBooking(b.id)} className="inline-flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 border border-red-400/20 hover:border-red-400/40 px-3 py-2 rounded-lg transition-colors">
                        <Trash2 size={13} /> Delete
                      </button>
                    </div>
                  </div>
                );
              })}
              {state.bookings.filter(b => bookingFilter === 'all' || b.status === bookingFilter).length === 0 && (
                <div className="text-center py-12 text-cream-300">No {bookingFilter === 'all' ? '' : bookingFilter} bookings found.</div>
              )}
            </div>
          </div>
        )}

        {tab === 'users' && (
          <div>
            <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
              <h2 className="font-serif text-2xl text-cream-100">All Users</h2>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Filter users by role">
                {USER_ROLE_FILTERS.map(role => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => setUserRoleFilter(role)}
                    aria-pressed={userRoleFilter === role}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${userRoleFilter === role ? 'bg-gold-400 text-navy-950' : 'border border-gold-400/20 text-cream-300 hover:border-gold-400/50'}`}
                  >
                    {role === 'all' ? 'All' : role}
                  </button>
                ))}
              </div>
            </div>
            <div className="bg-navy-800 border border-gold-400/10 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gold-400/10">
                    {['Name', 'Email', 'Role', 'Phone', 'Membership', 'Joined'].map(h => (
                      <th key={h} className="text-left px-5 py-3 text-xs text-cream-300/70 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map(u => (
                    <tr key={u.id} className="border-b border-gold-400/5 hover:bg-navy-700 transition-colors">
                      <td className="px-5 py-3 text-cream-100 font-medium">{u.name}</td>
                      <td className="px-5 py-3 text-cream-300">{u.email}</td>
                      <td className="px-5 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${
                          u.role === 'admin' ? 'bg-red-400/10 text-red-400'
                          : u.role === 'cleaner' ? 'bg-sky-400/10 text-sky-400'
                          : u.role === 'partner' ? 'bg-violet-400/10 text-violet-400'
                          : 'bg-emerald-400/10 text-emerald-400'
                        }`}>{u.role}</span>
                      </td>
                      <td className="px-5 py-3 text-cream-300">{u.phone || '—'}</td>
                      <td className="px-5 py-3">
                        {u.membershipTier ? (
                          <span className="text-xs text-gold-400 capitalize">{u.membershipTier}</span>
                        ) : '—'}
                      </td>
                      <td className="px-5 py-3 text-cream-300 text-xs">{new Date(u.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredUsers.length === 0 && (
                <div className="text-center py-12 text-cream-300">No users found for this role.</div>
              )}
            </div>
          </div>
        )}

        {tab === 'partners' && (
          <div>
            <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
              <h2 className="font-serif text-2xl text-cream-100">Partnership Applications</h2>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Filter companies by application status">
                {COMPANY_STATUS_FILTERS.map(status => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setCompanyStatusFilter(status)}
                    aria-pressed={companyStatusFilter === status}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${companyStatusFilter === status ? 'bg-gold-400 text-navy-950' : 'border border-gold-400/20 text-cream-300 hover:border-gold-400/50'}`}
                  >
                    {status === 'all' ? 'All' : status === 'approved' ? 'Accepted' : status === 'pending' ? 'Pending' : 'Rejected'}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-4">
              {filteredPartnerApplications.map(app => (
                <div key={app.id} className="bg-navy-800 border border-gold-400/10 rounded-xl p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-serif text-lg text-cream-100">{app.companyName}</h3>
                      <div className="text-xs text-cream-300">{app.industry} · {app.contactPerson} · {app.email}</div>
                    </div>
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${
                      app.status === 'approved' ? 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20'
                      : app.status === 'rejected' ? 'text-red-400 bg-red-400/10 border-red-400/20'
                      : app.status === 'under_review' ? 'text-amber-400 bg-amber-400/10 border-amber-400/20'
                      : 'text-blue-400 bg-blue-400/10 border-blue-400/20'
                    }`}>
                      {app.status.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-sm text-cream-300 mb-4">{app.proposal}</p>
                  <div className="text-xs text-cream-300 mb-3">
                    Services: {app.servicesRequired} · Volume: {app.estimatedVolume}
                  </div>
                  {(app.status === 'submitted' || app.status === 'under_review') && (
                    <div className="flex gap-3">
                      <button
                        onClick={() => updatePartnerApp(app, 'under_review')}
                        className="flex items-center gap-1.5 text-xs border border-amber-400/30 text-amber-400 px-3 py-1.5 rounded-lg hover:bg-amber-400/10 transition-colors"
                      >
                        Mark Under Review
                      </button>
                      <button
                        onClick={() => updatePartnerApp(app, 'approved')}
                        className="flex items-center gap-1.5 text-xs bg-emerald-400/15 border border-emerald-400/30 text-emerald-400 px-3 py-1.5 rounded-lg hover:bg-emerald-400/25 transition-colors"
                      >
                        <CheckCircle2 size={12} />Approve
                      </button>
                      <button
                        onClick={() => updatePartnerApp(app, 'rejected')}
                        className="flex items-center gap-1.5 text-xs bg-red-400/10 border border-red-400/25 text-red-400 px-3 py-1.5 rounded-lg hover:bg-red-400/20 transition-colors"
                      >
                        <XCircle size={12} />Reject
                      </button>
                    </div>
                  )}
                </div>
              ))}
              {filteredPartnerApplications.length === 0 && (
                <div className="text-center py-12 text-cream-300">No companies found for this status.</div>
              )}

              {/* Partner projects */}
              {state.partnerProjects.length > 0 && (
                <div>
                  <h3 className="font-serif text-xl text-cream-100 mt-8 mb-4">Partner Projects</h3>
                  {state.partnerProjects.map(project => {
                    const partnerApp = state.partnerApplications.find(p => p.id === project.partnerId);
                    return (
                      <div key={project.id} className="bg-navy-800 border border-gold-400/10 rounded-xl p-5 mb-3">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h4 className="font-serif text-lg text-cream-100">{project.name}</h4>
                            <div className="text-xs text-cream-300">{partnerApp?.companyName} · {project.address}</div>
                          </div>
                          <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${
                            project.status === 'completed' ? 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20'
                            : 'text-amber-400 bg-amber-400/10 border-amber-400/20'
                          }`}>
                            {project.status.replace('_', ' ')}
                          </span>
                        </div>
                        <div className="text-sm text-cream-300">{project.requirements}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'training' && (
          <div>
            <h2 className="font-serif text-2xl text-cream-100 mb-5">Training Applications</h2>
            {state.trainingApplications.length === 0 ? (
              <div className="text-center py-16 text-cream-300">No training applications yet.</div>
            ) : (
              <div className="bg-navy-800 border border-gold-400/10 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gold-400/10">
                      {['Applicant', 'Email', 'Program', 'Status', 'Applied'].map(h => (
                        <th key={h} className="text-left px-5 py-3 text-xs text-cream-300/70 font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {state.trainingApplications.map(app => {
                      const program = state.trainingPrograms.find(p => p.id === app.programId);
                      return (
                        <tr key={app.id} className="border-b border-gold-400/5 hover:bg-navy-700">
                          <td className="px-5 py-3 text-cream-100">{app.name}</td>
                          <td className="px-5 py-3 text-cream-300">{app.email}</td>
                          <td className="px-5 py-3 text-cream-200">{program?.name || 'Unknown'}</td>
                          <td className="px-5 py-3">
                            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-400/10 text-amber-400 capitalize">{app.status.replace('_', ' ')}</span>
                          </td>
                          <td className="px-5 py-3 text-cream-300 text-xs">{new Date(app.createdAt).toLocaleDateString()}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {tab === 'messages' && (
          <div>
            <h2 className="font-serif text-2xl text-cream-100 mb-5">Contact Messages</h2>
            {state.contactMessages.length === 0 ? (
              <div className="text-center py-16 text-cream-300">No messages yet.</div>
            ) : (
              <div className="space-y-4">
                {state.contactMessages.map(msg => (
                  <div key={msg.id} className={`bg-navy-800 border rounded-xl p-5 ${!msg.read ? 'border-gold-400/25' : 'border-gold-400/10'}`}>
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <span className="font-medium text-cream-100 text-sm">{msg.name}</span>
                        <span className="text-cream-300 text-xs ml-2">{msg.email} · {msg.phone}</span>
                      </div>
                      <div className="text-xs text-cream-300/60">{new Date(msg.createdAt).toLocaleDateString()}</div>
                    </div>
                    <div className="text-sm font-medium text-cream-100 mb-1">{msg.subject}</div>
                    <div className="text-sm text-cream-300">{msg.message}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
