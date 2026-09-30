import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Users, CalendarCheck, Briefcase, GraduationCap, MessageSquare,
  CheckCircle2, XCircle, ArrowRight, ArrowLeft, UserCog, LogOut, Trash2, Mail, Key, FileText, Award,
} from 'lucide-react';
import { useStore, useCurrentUser, STATUS_LABELS, STATUS_COLORS, genId, profileToUser, saveNotification } from '../store';
import { useToast } from '../components/ToastContainer';
import type { BookingStatus, PartnerApplication, TrainingApplication, MembershipTier, User } from '../store';
import {
  signOut,
  fetchAllProfiles,
  isUuid,
  updateTrainingApplicationRow,
  deleteTrainingApplicationRow,
  updatePartnerApplicationRow,
  updateBookingRow,
  deleteBookingRow,
  createPartnerCompany,
  linkPartnerApplicationCompany,
  setProfileCompany,
  setUserRole,
  type AssignableRole,
} from '../lib/supabase';
import ConfirmModal from '../components/ConfirmModal';
import { PRIORITY_LABELS, PRIORITY_COLORS, priorityRank } from '../lib/membership';
import BookingReviewModal from '../components/BookingReviewModal';
import ApplicationReviewModal from '../components/ApplicationReviewModal';
import CertificateModal from '../components/CertificateModal';
import ResumeLink from '../components/ResumeLink';
import PinSettings from '../components/PinSettings';

const BOOKING_STATUSES: BookingStatus[] = [
  'pending', 'confirmed', 'cleaner_assigned', 'en_route', 'in_progress', 'completed', 'cancelled', 'awaiting_quote',
];

const USER_ROLE_FILTERS = ['all', 'admin', 'customer', 'cleaner', 'partner'] as const;
const COMPANY_STATUS_FILTERS = ['all', 'pending', 'approved', 'rejected'] as const;
const TRAINING_STATUS_FILTERS = ['all', 'pending', 'accepted', 'scheduled', 'completed', 'rejected'] as const;

export default function AdminDashboard() {
  const { state, dispatch } = useStore();
  const user = useCurrentUser()!;
  const navigate = useNavigate();
  const toast = useToast();
  const [tab, setTab] = useState<'overview' | 'bookings' | 'users' | 'partners' | 'training' | 'messages' | 'security'>('overview');
  const [bookingFilter, setBookingFilter] = useState<'all' | 'pending' | 'completed' | 'cancelled'>('all');
  const [userRoleFilter, setUserRoleFilter] = useState<(typeof USER_ROLE_FILTERS)[number]>('all');
  const [companyStatusFilter, setCompanyStatusFilter] = useState<(typeof COMPANY_STATUS_FILTERS)[number]>('all');
  const [trainingStatusFilter, setTrainingStatusFilter] = useState<(typeof TRAINING_STATUS_FILTERS)[number]>('all');
  const [confirmation, setConfirmation] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    onConfirm: () => void;
  } | null>(null);
  const [usersLoading, setUsersLoading] = useState(true);
  const [reviewingBooking, setReviewingBooking] = useState<string | null>(null);
  const [bookingActionLoading, setBookingActionLoading] = useState(false);
  const [reviewingApplication, setReviewingApplication] = useState<{ id: string; type: 'partner' | 'training' } | null>(null);
  const [applicationActionLoading, setApplicationActionLoading] = useState(false);
  const [certificateApp, setCertificateApp] = useState<TrainingApplication | null>(null);

  // Fetch all users on component mount
  useEffect(() => {
    async function loadAllUsers() {
      try {
        const profiles = await fetchAllProfiles();
        const users = profiles.map(profileToUser);
        dispatch({ type: 'SET_ALL_USERS', payload: users });
        console.log('[AdminDashboard] Loaded users:', users.length);
      } catch (error) {
        console.error('[AdminDashboard] Failed to load users:', error);
        toast.error('Failed to Load Users', 'Could not fetch users from database');
      } finally {
        setUsersLoading(false);
      }
    }

    loadAllUsers();
  }, [dispatch, toast]);

  const customers = state.users.filter(u => u.role === 'customer');
  const cleaners = state.users.filter(u => u.role === 'cleaner');
  const partners = state.users.filter(u => u.role === 'partner');
  const filteredUsers = state.users.filter(u => userRoleFilter === 'all' || u.role === userRoleFilter);
  const filteredPartnerApplications = state.partnerApplications.filter(app => {
    if (companyStatusFilter === 'all') return true;
    if (companyStatusFilter === 'pending') return app.status === 'submitted' || app.status === 'under_review';
    return app.status === companyStatusFilter;
  });
  const filteredTrainingApplications = state.trainingApplications.filter(app => {
    if (trainingStatusFilter === 'all') return true;
    if (trainingStatusFilter === 'pending') return app.status === 'submitted' || app.status === 'under_review';
    return app.status === trainingStatusFilter;
  });
  const totalBookings = state.bookings.length;
  const awaitingReviewBookings = state.bookings.filter(b => b.status === 'awaiting_review').length;
  const pendingBookings = state.bookings.filter(b => b.status === 'pending').length;
  const activeBookings = state.bookings.filter(b => ['confirmed', 'cleaner_assigned', 'en_route', 'in_progress'].includes(b.status)).length;
  const completedBookings = state.bookings.filter(b => b.status === 'completed').length;
  const activeMembers = state.users.filter(u => u.membershipStatus === 'active').length;
  const pendingApps = state.partnerApplications.filter(p => p.status === 'submitted' || p.status === 'under_review').length;
  const trainingApps = state.trainingApplications.length;
  const activeTrainees = state.trainingApplications.filter(a => a.status === 'accepted' || a.status === 'scheduled').length;
  const unreadMessages = state.contactMessages.filter(m => !m.read).length;

  function handleLogout() {
    signOut();
    dispatch({ type: 'LOGOUT' });
    navigate('/login');
  }

  function requestLogout() {
    setConfirmation({
      title: 'Log out?',
      message: 'You will be signed out of the admin dashboard and redirected to the login page.',
      confirmLabel: 'Log Out',
      onConfirm: () => { handleLogout(); setConfirmation(null); },
    });
  }

  function approveTrainingApp(applicationId: string) {
    const app = state.trainingApplications.find(a => a.id === applicationId);
    if (!app) return;
    setApplicationActionLoading(true);
    setTimeout(async () => {
      if (isUuid(app.id)) {
        const { error } = await updateTrainingApplicationRow(app.id, { status: 'accepted' });
        if (error) console.error('[Admin] Training approve DB sync failed:', error.message);
      }
      dispatch({ type: 'UPDATE_TRAINING_APP', payload: { ...app, status: 'accepted' } });
      const program = state.trainingPrograms.find(p => p.id === app.programId);
      if (app.userId) {
        await saveNotification(dispatch, {
          userId: app.userId,
          title: 'Training Application Accepted!',
          message: `Congratulations ${app.name}! Your application for "${program?.name || 'the training program'}"${program ? ` (${program.duration})` : ''} has been accepted. Please wait for further instructions on your schedule.`,
          link: '/portal/customer',
        });
      }
      setReviewingApplication(null);
      setApplicationActionLoading(false);
      toast.success('Application Approved!', `${app.name} has been accepted. They have been notified with the program details.`);
    }, 800);
  }

  function requestApproveTrainingApp(applicationId: string) {
    const app = state.trainingApplications.find(a => a.id === applicationId);
    const program = app ? state.trainingPrograms.find(p => p.id === app.programId) : null;
    setConfirmation({
      title: 'Approve training application?',
      message: `${app?.name || 'This applicant'} will be accepted into "${program?.name || 'the program'}" and notified with the program details. No account will be created.`,
      confirmLabel: 'Approve',
      onConfirm: () => {
        approveTrainingApp(applicationId);
        setConfirmation(null);
      },
    });
  }

  function rejectApplication(applicationId: string, type: 'partner' | 'training') {
    setApplicationActionLoading(true);
    setTimeout(async () => {
      if (type === 'partner') {
        const app = state.partnerApplications.find(a => a.id === applicationId);
        if (app) {
          if (isUuid(app.id)) {
            const { error } = await updatePartnerApplicationRow(app.id, { status: 'rejected' });
            if (error) console.error('[Admin] Partner reject DB sync failed:', error.message);
          }
          dispatch({
            type: 'UPDATE_PARTNER_APP',
            payload: { ...app, status: 'rejected' },
          });
          if (app.userId) {
            await saveNotification(dispatch, {
              userId: app.userId,
              title: 'Partnership Application Update',
              message: `Thank you for your interest, ${app.contactPerson}. Your partnership application for "${app.companyName}" was not approved at this time. You may contact us at 0919 002 4136 for feedback or reapply in the future.`,
              link: '/portal/customer',
            });
          }
        }
      } else {
        const app = state.trainingApplications.find(a => a.id === applicationId);
        if (app) {
          if (isUuid(app.id)) {
            const { error } = await updateTrainingApplicationRow(app.id, { status: 'rejected' });
            if (error) console.error('[Admin] Training reject DB sync failed:', error.message);
          }
          dispatch({
            type: 'UPDATE_TRAINING_APP',
            payload: { ...app, status: 'rejected' },
          });
          const program = state.trainingPrograms.find(p => p.id === app.programId);
          if (app.userId) {
            await saveNotification(dispatch, {
              userId: app.userId,
              title: 'Training Application Update',
              message: `Thank you for your interest, ${app.name}. Your application for "${program?.name || 'the training program'}" was not accepted at this time. You may contact us at 0919 002 4136 for feedback or apply for another program.`,
              link: '/portal/customer',
            });
          }
        }
      }

      setReviewingApplication(null);
      setApplicationActionLoading(false);
      toast.info('Application Rejected', `The ${type} application has been rejected. The applicant has been notified.`);
    }, 800);
  }

  function deleteBooking(bookingId: string) {
    deleteBookingRow(bookingId).then(({ error }) => {
      if (error) console.error('[Admin] Booking delete DB sync failed:', error.message);
    });
    dispatch({ type: 'DELETE_BOOKING', payload: bookingId });
    toast.success('Booking Deleted', 'The booking has been removed');
  }

  function updateTrainingApp(appId: string, status: TrainingApplication['status']) {
    const app = state.trainingApplications.find(a => a.id === appId);
    if (!app) return;
    if (isUuid(app.id)) {
      updateTrainingApplicationRow(app.id, { status }).then(({ error }) => {
        if (error) console.error('[Admin] Training update DB sync failed:', error.message);
      });
    }
    dispatch({ type: 'UPDATE_TRAINING_APP', payload: { ...app, status } });
    if (app.userId) {
      void saveNotification(dispatch, {
        userId: app.userId,
        title: `Training Application ${status === 'completed' ? 'Completed' : 'Updated'}`,
        message: status === 'completed'
          ? `Congratulations! You have completed "${state.trainingPrograms.find(p => p.id === app.programId)?.name || 'your training program'}". Your certificate is ready in the admin records.`
          : `Your training application status has been updated to: ${status.replace('_', ' ')}.`,
        link: '/portal/customer',
      });
    }
    toast.success(
      status === 'completed' ? 'Training Completed!' : 'Training Updated',
      `${app.name}'s record has been updated to ${status.replace('_', ' ')}.`
    );
  }

  function requestCompleteTraining(appId: string) {
    const app = state.trainingApplications.find(a => a.id === appId);
    setConfirmation({
      title: 'Mark training completed?',
      message: `${app?.name || 'This trainee'} has finished the program duration. Their record will be marked completed and a certificate can be printed.`,
      confirmLabel: 'Complete',
      onConfirm: () => { updateTrainingApp(appId, 'completed'); setConfirmation(null); },
    });
  }

  function deleteTrainingApp(appId: string) {
    if (isUuid(appId)) {
      deleteTrainingApplicationRow(appId).then(({ error }) => {
        if (error) console.error('[Admin] Training delete DB sync failed:', error.message);
      });
    }
    dispatch({ type: 'DELETE_TRAINING_APP', payload: appId });
    toast.success('Trainee Removed', 'The training record has been removed.');
  }

  function requestDeleteTrainingApp(appId: string) {
    const app = state.trainingApplications.find(a => a.id === appId);
    setConfirmation({
      title: 'Remove trainee?',
      message: `${app?.name || 'This trainee'}'s training record will be permanently removed. This action cannot be undone.`,
      confirmLabel: 'Remove',
      onConfirm: () => { deleteTrainingApp(appId); setConfirmation(null); },
    });
  }

  function requestRejectApplication(applicationId: string, type: 'partner' | 'training') {
    const app = type === 'partner'
      ? state.partnerApplications.find(a => a.id === applicationId)
      : state.trainingApplications.find(a => a.id === applicationId);
    const entityName = app ? ('companyName' in app ? app.companyName : app.name) : 'this application';
    setConfirmation({
      title: `Reject ${type} application?`,
      message: `${entityName}'s application will be rejected. They will be notified of the decision.`,
      confirmLabel: 'Reject',
      onConfirm: () => {
        rejectApplication(applicationId, type);
        setConfirmation(null);
      },
    });
  }

  function acceptBooking(bookingId: string) {
    const booking = state.bookings.find(b => b.id === bookingId);
    if (!booking) return;

    setBookingActionLoading(true);
    setTimeout(() => {
      const updatedBooking = {
        ...booking,
        status: 'pending' as BookingStatus,
        timeline: [
          ...booking.timeline,
          {
            id: genId('tl'),
            event: 'Booking Accepted',
            note: 'Your booking has been reviewed and accepted. We will assign a cleaner shortly.',
            timestamp: new Date().toISOString(),
            actor: user.name,
          },
        ],
        updatedAt: new Date().toISOString(),
      };

      dispatch({ type: 'UPDATE_BOOKING', payload: updatedBooking });
      updateBookingRow(bookingId, { status: 'pending' }).then(({ error }) => {
        if (error) console.error('[Admin] Booking accept DB sync failed:', error.message);
      });
      setReviewingBooking(null);
      setBookingActionLoading(false);
      
      toast.success('Booking Accepted!', `Booking ${bookingId} has been accepted and is now pending cleaner assignment.`);
    }, 800);
  }

  function rejectBooking(bookingId: string) {
    const booking = state.bookings.find(b => b.id === bookingId);
    if (!booking) return;

    setBookingActionLoading(true);
    setTimeout(() => {
      const updatedBooking = {
        ...booking,
        status: 'rejected' as BookingStatus,
        timeline: [
          ...booking.timeline,
          {
            id: genId('tl'),
            event: 'Booking Rejected',
            note: 'Your booking request has been reviewed and could not be accommodated at this time.',
            timestamp: new Date().toISOString(),
            actor: user.name,
          },
        ],
        updatedAt: new Date().toISOString(),
      };

      dispatch({ type: 'UPDATE_BOOKING', payload: updatedBooking });
      updateBookingRow(bookingId, { status: 'rejected' }).then(({ error }) => {
        if (error) console.error('[Admin] Booking reject DB sync failed:', error.message);
      });
      setReviewingBooking(null);
      setBookingActionLoading(false);
      
      toast.info('Booking Rejected', `Booking ${bookingId} has been rejected.`);
    }, 800);
  }

  function requestDeleteBooking(bookingId: string) {
    setConfirmation({
      title: 'Delete booking?',
      message: 'Are you sure you want to delete this booking? This action cannot be undone.',
      confirmLabel: 'Delete',
      onConfirm: () => { deleteBooking(bookingId); setConfirmation(null); },
    });
  }

  function requestAcceptBooking(bookingId: string) {
    setConfirmation({
      title: 'Accept booking?',
      message: `Booking ${bookingId} will be accepted and moved to pending cleaner assignment.`,
      confirmLabel: 'Accept',
      onConfirm: () => { acceptBooking(bookingId); setConfirmation(null); },
    });
  }

  function requestRejectBooking(bookingId: string) {
    setConfirmation({
      title: 'Reject booking?',
      message: `Booking ${bookingId} will be rejected. The customer will be notified.`,
      confirmLabel: 'Reject',
      onConfirm: () => { rejectBooking(bookingId); setConfirmation(null); },
    });
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
    updateBookingRow(bookingId, { status: newStatus }).then(({ error }) => {
      if (error) console.error('[Admin] Booking status DB sync failed:', error.message);
    });
    void saveNotification(dispatch, {
      userId: booking.customerId,
      title: `Booking Update — ${booking.id}`,
      message: `Your booking status has been updated: ${STATUS_LABELS[newStatus]}`,
      link: '/portal/customer',
    });
  }

  function requestBookingStatus(bookingId: string, newStatus: BookingStatus) {
    setConfirmation({
      title: 'Update booking status?',
      message: `This will change the booking status to ${STATUS_LABELS[newStatus]}.`,
      confirmLabel: 'Update',
      onConfirm: () => { updateBookingStatus(bookingId, newStatus); setConfirmation(null); },
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
    updateBookingRow(bookingId, {
      status: 'cleaner_assigned',
      cleaner_id: isUuid(cleanerId) ? cleanerId : null,
    }).then(({ error }) => {
      if (error) console.error('[Admin] Assign cleaner DB sync failed:', error.message);
    });
    void saveNotification(dispatch, {
      userId: booking.customerId,
      title: `Cleaner Assigned — ${booking.id}`,
      message: `${cleaner?.name} has been assigned to your booking on ${booking.date}.`,
      link: '/portal/customer',
    });
    if (cleanerId) {
      void saveNotification(dispatch, {
        userId: cleanerId,
        title: 'New Job Assignment',
        message: `You've been assigned to Booking #${booking.id} on ${booking.date} at ${booking.time}.`,
        link: '/portal/cleaner',
      });
    }
  }

  function requestAssignCleaner(bookingId: string, cleanerId: string) {
    const cleaner = state.users.find(account => account.id === cleanerId);
    setConfirmation({
      title: 'Assign cleaner?',
      message: `${cleaner?.name || 'This cleaner'} will be assigned to the booking.`,
      confirmLabel: 'Assign',
      onConfirm: () => { assignCleaner(bookingId, cleanerId); setConfirmation(null); },
    });
  }

  async function provisionPartnerCompany(app: PartnerApplication): Promise<string | null> {
    // Create the company record + link it to the application and applicant profile.
    // Best-effort: approval still succeeds if provisioning fails.
    if (app.companyId) return app.companyId;
    try {
      const { data: company, error: companyError } = await createPartnerCompany({
        name: app.companyName,
        industry: app.industry,
        website: app.website,
        address: app.address,
        contact_email: app.email,
        contact_phone: app.phone,
      });
      if (companyError || !company) {
        console.error('[Admin] Company creation failed:', companyError?.message);
        return null;
      }
      if (isUuid(app.id)) {
        const { error } = await linkPartnerApplicationCompany(app.id, company.id);
        if (error) console.error('[Admin] Company link failed:', error.message);
      }
      if (app.userId && isUuid(app.userId)) {
        const { error } = await setProfileCompany(app.userId, company.id);
        if (error) console.error('[Admin] Profile company tag failed:', error.message);
      }
      dispatch({ type: 'UPDATE_PARTNER_APP', payload: { ...app, status: 'approved', companyId: company.id } });
      return company.id;
    } catch (err) {
      console.error('[Admin] Company provisioning failed:', err);
      return null;
    }
  }

  function updatePartnerApp(app: PartnerApplication, status: PartnerApplication['status']) {
    const updated = { ...app, status };
    if (isUuid(app.id)) {
      updatePartnerApplicationRow(app.id, { status }).then(({ error }) => {
        if (error) console.error('[Admin] Partner update DB sync failed:', error.message);
      });
    }
    dispatch({ type: 'UPDATE_PARTNER_APP', payload: updated });
    if (status === 'approved') {
      // Grant the partner role. Without this the applicant stays role='customer'
      // and <ProtectedRoute role="partner"> bounces them straight back to "/", so
      // "approved" was a dead end — they could never actually reach the portal.
      if (app.userId && isUuid(app.userId)) {
        void setUserRole(app.userId, 'partner').then(({ error }) => {
          if (error) {
            console.error('[Admin] Partner role grant failed:', error.message);
            toast.error(
              'Role Update Failed',
              `${app.contactPerson} was approved, but the partner role could not be granted. Please retry from the Users tab.`
            );
          }
        });
      }
      // Provision the company record so the partner can submit projects
      void provisionPartnerCompany(updated).then(companyId => {
        if (companyId) {
          toast.success('Company Record Created', `${app.companyName} can now submit projects from the partner portal.`);
        }
      });
    }
    if (app.userId) {
      void saveNotification(dispatch, {
        userId: app.userId,
        title: `Partnership Application ${status === 'approved' ? 'Approved' : 'Updated'}`,
        message: status === 'approved'
          ? `Congratulations ${app.contactPerson}! "${app.companyName}" (${app.industry}) has been approved as a Luxurious Cleaning Co. partner for ${app.servicesRequired}. Our team will reach out about next steps.`
          : `Your partnership application for "${app.companyName}" has been updated to: ${status.replace('_', ' ')}.`,
        link: '/portal/partner',
      });
    }
  }

  function requestPartnerUpdate(app: PartnerApplication, status: PartnerApplication['status']) {
    const action = status === 'approved' ? 'approve' : status === 'rejected' ? 'reject' : 'move under review';
    setConfirmation({
      title: `${action.charAt(0).toUpperCase() + action.slice(1)} application?`,
      message: `${app.companyName}'s partnership application will be updated.`,
      confirmLabel: status === 'rejected' ? 'Reject' : 'Update',
      onConfirm: () => { updatePartnerApp(app, status); setConfirmation(null); },
    });
  }

  /** Admin-only role change — this is how a trainee gets absorbed, or any user
   *  is promoted. profiles.role is frozen against client writes (migration 007),
   *  so the write goes through admin_set_user_role() from migration 008, which
   *  refuses to grant 'admin' and refuses to change the caller's own role.
   */
  function requestUserRoleChange(user: User, role: AssignableRole) {
    if (user.role === role) return;
    // Sample/seed rows in the store carry ids like 'u1'; the RPC needs a real UUID.
    if (!isUuid(user.id)) {
      toast.error('Cannot change role', 'This is a local sample record, not a database account.');
      return;
    }
    setConfirmation({
      title: 'Change this user\'s role?',
      message: `${user.name} will become a ${role}. On their next sign-in they will land in the ${role} portal.`,
      confirmLabel: 'Change role',
      onConfirm: async () => {
        setConfirmation(null);
        const { error } = await setUserRole(user.id, role);
        if (error) {
          toast.error('Role Update Failed', error.message);
          return;
        }
        dispatch({ type: 'UPDATE_USER_ROLE', payload: { userId: user.id, role } });
        toast.success('Role Updated', `${user.name} is now a ${role}.`);
      },
    });
  }

  const STAT_GROUPS = [
    {
      label: 'Booking Performance',
      stats: [
        { label: 'All bookings', value: totalBookings, icon: CalendarCheck, color: 'text-blue-400' },
        { label: 'Awaiting review', value: awaitingReviewBookings, icon: CalendarCheck, color: 'text-yellow-400' },
        { label: 'Awaiting action', value: pendingBookings, icon: CalendarCheck, color: 'text-amber-400' },
        { label: 'In service', value: activeBookings, icon: CalendarCheck, color: 'text-purple-400' },
        { label: 'Completed bookings', value: completedBookings, icon: CheckCircle2, color: 'text-emerald-400' },
      ],
    },
    {
      label: 'Users & Membership',
      stats: [
        { label: 'Registered customers', value: customers.length, icon: Users, color: 'text-cream-300' },
        { label: 'Active memberships', value: activeMembers, icon: Users, color: 'text-gold-400' },
        { label: 'Available cleaners', value: cleaners.length, icon: UserCog, color: 'text-sky-400' },
        { label: 'Partner accounts', value: partners.length, icon: Briefcase, color: 'text-violet-400' },
      ],
    },
    {
      label: 'Operations & Communication',
      stats: [
        { label: 'Pending applications', value: pendingApps, icon: Briefcase, color: 'text-orange-400' },
        { label: 'Training applications', value: trainingApps, icon: GraduationCap, color: 'text-teal-400' },
        { label: 'Active trainees', value: activeTrainees, icon: GraduationCap, color: 'text-emerald-400' },
        { label: 'Total messages', value: state.contactMessages.length, icon: MessageSquare, color: 'text-pink-400' },
        { label: 'Unread messages', value: unreadMessages, icon: MessageSquare, color: 'text-red-400' },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-navy-950">
      {confirmation && <ConfirmModal {...confirmation} onCancel={() => setConfirmation(null)} />}
      {reviewingBooking && (
        <BookingReviewModal
          booking={state.bookings.find(b => b.id === reviewingBooking)!}
          onClose={() => setReviewingBooking(null)}
          onAccept={requestAcceptBooking}
          onReject={requestRejectBooking}
          loading={bookingActionLoading}
        />
      )}
      {reviewingApplication && (
        <ApplicationReviewModal
          application={
            reviewingApplication.type === 'partner'
              ? state.partnerApplications.find(a => a.id === reviewingApplication.id)!
              : state.trainingApplications.find(a => a.id === reviewingApplication.id)!
          }
          applicationType={reviewingApplication.type}
          onClose={() => setReviewingApplication(null)}
          onApprove={(id) => {
            if (reviewingApplication.type === 'partner') {
              const app = state.partnerApplications.find(a => a.id === id);
              if (app) requestPartnerUpdate(app, 'approved');
            } else {
              requestApproveTrainingApp(id);
            }
          }}
          onReject={(id) => requestRejectApplication(id, reviewingApplication.type)}
          loading={applicationActionLoading}
        />
      )}
      {certificateApp && (
        <CertificateModal
          app={certificateApp}
          programName={state.trainingPrograms.find(p => p.id === certificateApp.programId)?.name || 'Training Program'}
          programDuration={state.trainingPrograms.find(p => p.id === certificateApp.programId)?.duration}
          onClose={() => setCertificateApp(null)}
        />
      )}
      <div className="bg-navy-900 border-b border-gold-400/10 pt-16">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-start justify-between gap-4 mb-5">
            <div>
              <div className="text-xs text-gold-400 tracking-[0.2em] uppercase font-medium mb-1">Admin Dashboard</div>
              <h1 className="font-serif text-3xl text-cream-100">Control Center</h1>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link to="/" className="inline-flex items-center gap-2 rounded-lg border border-gold-400/30 bg-gold-400/10 px-4 py-2.5 text-sm font-semibold text-gold-400 transition-colors hover:border-gold-400/50 hover:bg-gold-400/20">
                <ArrowLeft size={14} />
                Back to Home
              </Link>
              <button
                onClick={requestLogout}
                className="inline-flex items-center gap-2 rounded-lg border border-red-400/30 bg-red-400/10 px-4 py-2.5 text-sm font-semibold text-red-300 transition-colors hover:border-red-300/50 hover:bg-red-400/20 hover:text-red-200"
              >
                <LogOut size={15} />
                Log out
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-1 border-b border-gold-400/10">
            {[
              { key: 'overview', label: 'Overview' },
              { key: 'bookings', label: 'Bookings', count: totalBookings },
              { key: 'users', label: 'Users', count: state.users.length },
              { key: 'partners', label: 'Partners', count: state.partnerApplications.length },
              { key: 'training', label: 'Training', count: trainingApps },
              { key: 'messages', label: 'Messages', count: unreadMessages },
              { key: 'security', label: 'Security' },
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

      <div className="max-w-7xl mx-auto px-6 py-8 min-h-[36rem]">
        {tab === 'overview' && (
          <div>
            <div className="space-y-8">
              {STAT_GROUPS.map(group => (
                <section key={group.label}>
                  <div className="flex items-center gap-3 mb-3">
                    <h2 className="text-xs text-gold-400 uppercase tracking-[0.18em] font-medium">{group.label}</h2>
                    <div className="h-px flex-1 bg-gold-400/10" />
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    {group.stats.map(stat => (
                      <div key={stat.label} className="bg-navy-800 border border-gold-400/10 rounded-xl p-4 min-h-[5.25rem]">
                        <div className={`text-2xl font-semibold ${stat.color} mb-0.5`}>{stat.value}</div>
                        <div className="text-xs text-cream-300">{stat.label}</div>
                      </div>
                    ))}
                  </div>
                </section>
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
              {state.bookings
                .filter(b => {
                  if (bookingFilter === 'all') return true;
                  if (bookingFilter === 'pending') return ['pending', 'awaiting_review', 'awaiting_quote'].includes(b.status);
                  return b.status === bookingFilter;
                })
                .sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority))
                .map(b => {
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
                      <div className="flex flex-wrap items-center gap-1.5">
                        {(b.priority ?? 'normal') !== 'normal' && (
                          <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${PRIORITY_COLORS[b.priority ?? 'normal']}`}>
                            {PRIORITY_LABELS[b.priority ?? 'normal']}
                          </span>
                        )}
                        {b.memberTier && (
                          <span className="text-xs font-medium px-2.5 py-1 rounded-full border text-gold-400 bg-gold-400/10 border-gold-400/25 capitalize">
                            {b.memberTier}{(b.discountPercent ?? 0) > 0 ? ` · ${b.discountPercent}% off` : ''}
                          </span>
                        )}
                        <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${STATUS_COLORS[b.status]}`}>
                          {STATUS_LABELS[b.status]}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      {/* Quick Review Button for Awaiting Review */}
                      {b.status === 'awaiting_review' && (
                        <button
                          onClick={() => setReviewingBooking(b.id)}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold bg-gold-400 hover:bg-gold-300 text-navy-950 px-4 py-2 rounded-lg transition-colors"
                        >
                          <CheckCircle2 size={13} /> Review Booking
                        </button>
                      )}

                      {/* Status change */}
                      <select
                        value={b.status}
                        onChange={e => requestBookingStatus(b.id, e.target.value as BookingStatus)}
                        className="bg-navy-700 border border-gold-400/15 text-cream-100 text-xs rounded-lg px-3 py-2 focus:outline-none"
                      >
                        {BOOKING_STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                      </select>

                      {/* Assign cleaner */}
                      <select
                        value={b.cleanerId || ''}
                        onChange={e => e.target.value && requestAssignCleaner(b.id, e.target.value)}
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
                      <button onClick={() => requestDeleteBooking(b.id)} className="inline-flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 border border-red-400/20 hover:border-red-400/40 px-3 py-2 rounded-lg transition-colors">
                        <Trash2 size={13} /> Delete
                      </button>
                    </div>
                  </div>
                );
              })}
              {state.bookings.filter(b => {
                if (bookingFilter === 'all') return true;
                if (bookingFilter === 'pending') return ['pending', 'awaiting_review', 'awaiting_quote'].includes(b.status);
                return b.status === bookingFilter;
              }).length === 0 && (
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
                  {usersLoading ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-12 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <div className="animate-spin h-8 w-8 border-3 border-gold-400 border-t-transparent rounded-full" />
                          <p className="text-cream-300 text-sm">Loading users from database...</p>
                        </div>
                      </td>
                    </tr>
                  ) : filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-cream-300">
                        No users found for this role.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map(u => (
                      <tr key={u.id} className="border-b border-gold-400/5 hover:bg-navy-700 transition-colors">
                        <td className="px-5 py-3 text-cream-100 font-medium">{u.name}</td>
                        <td className="px-5 py-3 text-cream-300">{u.email}</td>
                        <td className="px-5 py-3">
                          {u.role === 'admin' ? (
                            <span className="text-xs px-2 py-0.5 rounded-full capitalize bg-red-400/10 text-red-400">admin</span>
                          ) : (
                            <select
                              value={u.role}
                              onChange={e => requestUserRoleChange(u, e.target.value as AssignableRole)}
                              aria-label={`Role for ${u.name}`}
                              className={`text-xs px-2 py-1 rounded-lg border bg-navy-700 capitalize cursor-pointer focus:outline-none focus:border-gold-400/50 ${
                                u.role === 'cleaner' ? 'border-sky-400/30 text-sky-400'
                                : u.role === 'partner' ? 'border-violet-400/30 text-violet-400'
                                : 'border-emerald-400/30 text-emerald-400'
                              }`}
                            >
                              <option value="customer">customer</option>
                              <option value="cleaner">cleaner</option>
                              <option value="partner">partner</option>
                            </select>
                          )}
                        </td>
                        <td className="px-5 py-3 text-cream-300">{u.phone || '—'}</td>
                        <td className="px-5 py-3">
                          {u.membershipTier ? (
                            <span className="text-xs text-gold-400 capitalize">{u.membershipTier}</span>
                          ) : '—'}
                        </td>
                        <td className="px-5 py-3 text-cream-300 text-xs">{new Date(u.createdAt).toLocaleDateString()}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-cream-300/60">
              Change a role to absorb a trainee or promote a user — it takes effect on their next sign-in.
              Admin accounts are managed in the Supabase dashboard.
            </p>
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
                  {app.resumeName && (
                    <div className="mb-4">
                      {app.resumeUrl ? (
                        <ResumeLink path={app.resumeUrl} name={app.resumeName} />
                      ) : (
                        <span className="inline-flex items-center gap-2 text-xs text-cream-300/60 border border-gold-400/10 rounded-lg px-3 py-1.5">
                          <FileText size={13} /> {app.resumeName} (upload pending)
                        </span>
                      )}
                    </div>
                  )}
                  <div className="text-xs text-cream-300 mb-3">
                    Services: {app.servicesRequired} · Volume: {app.estimatedVolume}
                  </div>
                  {(app.status === 'submitted' || app.status === 'under_review') && (
                    <div className="flex gap-3">
                      <button
                        onClick={() => setReviewingApplication({ id: app.id, type: 'partner' })}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold bg-gold-400 hover:bg-gold-300 text-navy-950 px-4 py-2 rounded-lg transition-colors"
                      >
                        <CheckCircle2 size={13} /> Review Application
                      </button>
                      <button
                        onClick={() => requestPartnerUpdate(app, 'approved')}
                        className="flex items-center gap-1.5 text-xs bg-emerald-400/15 border border-emerald-400/30 text-emerald-400 px-3 py-1.5 rounded-lg hover:bg-emerald-400/25 transition-colors"
                      >
                        <CheckCircle2 size={12} />Approve
                      </button>
                      <button
                        onClick={() => requestPartnerUpdate(app, 'rejected')}
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
                    const partnerApp = state.partnerApplications.find(p => p.id === project.partnerId || p.companyId === project.partnerId);
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
            <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
              <div className="flex items-center gap-3">
                <h2 className="font-serif text-2xl text-cream-100">Training Applications</h2>
                <span className="text-xs font-medium px-2.5 py-1 rounded-full border text-emerald-400 bg-emerald-400/10 border-emerald-400/20">
                  {activeTrainees} Active {activeTrainees === 1 ? 'Trainee' : 'Trainees'}
                </span>
              </div>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Filter trainees by status">
                {TRAINING_STATUS_FILTERS.map(status => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setTrainingStatusFilter(status)}
                    aria-pressed={trainingStatusFilter === status}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${trainingStatusFilter === status ? 'bg-gold-400 text-navy-950' : 'border border-gold-400/20 text-cream-300 hover:border-gold-400/50'}`}
                  >
                    {status === 'all' ? 'All' : status === 'pending' ? 'Pending' : status.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>
            {filteredTrainingApplications.length === 0 ? (
              <div className="text-center py-16 text-cream-300">No training records found for this status.</div>
            ) : (
              <div className="space-y-4">
                {filteredTrainingApplications.map(app => {
                  const program = state.trainingPrograms.find(p => p.id === app.programId);
                  return (
                    <div key={app.id} className="bg-navy-800 border border-gold-400/10 rounded-xl p-5">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="font-serif text-lg text-cream-100">{app.name}</h3>
                          <div className="text-xs text-cream-300">{app.email} · {app.phone}</div>
                        </div>
                        <span className={`text-xs font-medium px-2.5 py-1 rounded-full border capitalize ${
                          app.status === 'accepted' || app.status === 'completed' ? 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20'
                          : app.status === 'rejected' ? 'text-red-400 bg-red-400/10 border-red-400/20'
                          : app.status === 'under_review' ? 'text-amber-400 bg-amber-400/10 border-amber-400/20'
                          : app.status === 'scheduled' ? 'text-violet-400 bg-violet-400/10 border-violet-400/20'
                          : 'text-blue-400 bg-blue-400/10 border-blue-400/20'
                        }`}>
                          {app.status.replace('_', ' ')}
                        </span>
                      </div>
                      <div className="mb-4">
                        <div className="text-sm text-cream-200 mb-2">
                          <span className="text-cream-300/70">Program:</span> {program?.name || 'Unknown'}
                        </div>
                        <div className="text-sm text-cream-300">
                          <span className="text-cream-300/70">Experience:</span> {app.experience}
                        </div>
                        {app.resumeName && (
                          <div className="mt-2">
                            {app.resumeUrl ? (
                              <ResumeLink path={app.resumeUrl} name={app.resumeName} />
                            ) : (
                              <span className="inline-flex items-center gap-2 text-xs text-cream-300/60 border border-gold-400/10 rounded-lg px-3 py-1.5">
                                <FileText size={13} /> {app.resumeName} (upload pending)
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="text-xs text-cream-300/60 mb-3">
                        Applied: {new Date(app.createdAt).toLocaleDateString()}
                      </div>
                      {(app.status === 'submitted' || app.status === 'under_review') && (
                        <div className="flex flex-wrap gap-3">
                          <button
                            onClick={() => setReviewingApplication({ id: app.id, type: 'training' })}
                            className="inline-flex items-center gap-1.5 text-xs font-semibold bg-gold-400 hover:bg-gold-300 text-navy-950 px-4 py-2 rounded-lg transition-colors"
                          >
                            <CheckCircle2 size={13} /> Review Application
                          </button>
                          <button
                            onClick={() => requestApproveTrainingApp(app.id)}
                            className="flex items-center gap-1.5 text-xs bg-emerald-400/15 border border-emerald-400/30 text-emerald-400 px-3 py-1.5 rounded-lg hover:bg-emerald-400/25 transition-colors"
                          >
                            <CheckCircle2 size={12} />Approve
                          </button>
                          <button
                            onClick={() => requestRejectApplication(app.id, 'training')}
                            className="flex items-center gap-1.5 text-xs bg-red-400/10 border border-red-400/25 text-red-400 px-3 py-1.5 rounded-lg hover:bg-red-400/20 transition-colors"
                          >
                            <XCircle size={12} />Reject
                          </button>
                        </div>
                      )}
                      {(app.status === 'accepted' || app.status === 'scheduled') && (
                        <div className="flex flex-wrap gap-3">
                          <button
                            onClick={() => requestCompleteTraining(app.id)}
                            className="flex items-center gap-1.5 text-xs bg-emerald-400/15 border border-emerald-400/30 text-emerald-400 px-3 py-1.5 rounded-lg hover:bg-emerald-400/25 transition-colors"
                          >
                            <CheckCircle2 size={12} />Mark Completed
                          </button>
                          <button
                            onClick={() => requestDeleteTrainingApp(app.id)}
                            className="flex items-center gap-1.5 text-xs bg-red-400/10 border border-red-400/25 text-red-400 px-3 py-1.5 rounded-lg hover:bg-red-400/20 transition-colors"
                          >
                            <Trash2 size={12} />Remove Trainee
                          </button>
                        </div>
                      )}
                      {app.status === 'completed' && (
                        <div className="flex flex-wrap gap-3">
                          <button
                            onClick={() => setCertificateApp(app)}
                            className="flex items-center gap-1.5 text-xs font-semibold bg-gold-400 hover:bg-gold-300 text-navy-950 px-4 py-2 rounded-lg transition-colors"
                          >
                            <Award size={12} />Print Certificate
                          </button>
                          <button
                            onClick={() => requestDeleteTrainingApp(app.id)}
                            className="flex items-center gap-1.5 text-xs bg-red-400/10 border border-red-400/25 text-red-400 px-3 py-1.5 rounded-lg hover:bg-red-400/20 transition-colors"
                          >
                            <Trash2 size={12} />Remove Trainee
                          </button>
                        </div>
                      )}
                      {app.status === 'rejected' && (
                        <div className="flex flex-wrap gap-3">
                          <button
                            onClick={() => requestDeleteTrainingApp(app.id)}
                            className="flex items-center gap-1.5 text-xs bg-red-400/10 border border-red-400/25 text-red-400 px-3 py-1.5 rounded-lg hover:bg-red-400/20 transition-colors"
                          >
                            <Trash2 size={12} />Remove Record
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
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

        {tab === 'security' && <PinSettings />}
      </div>
    </div>
  );
}
