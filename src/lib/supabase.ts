import { createClient } from '@supabase/supabase-js';
import type { UserRole } from '../store';

// ─── Environment ────────────────────────────────────────────────────────────
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase environment variables. Please check your.env file");
}

// ─── Database Types ──────────────────────────────────────────────────────────

export type BookingStatus =
  | 'pending' | 'confirmed' | 'cleaner_assigned'
  | 'en_route' | 'in_progress' | 'completed'
  | 'cancelled' | 'rescheduled' | 'awaiting_quote';

export type MembershipTier = 'bronze' | 'silver' | 'gold';
export type MembershipStatus = 'none' | 'active' | 'pending';
export type ApplicationStatus = 'submitted' | 'under_review' | 'approved' | 'rejected';
export type TrainingAppStatus = 'submitted' | 'under_review' | 'accepted' | 'scheduled' | 'completed' | 'rejected';
export type PartnerProjectStatus =
  | 'lead_submitted' | 'received' | 'contacted' | 'quote'
  | 'approved' | 'scheduled' | 'cleaning' | 'completed';

/** Mirrors public.profiles table */
export interface ProfileRow {
  id: string;
  email: string;
  name: string;
  phone: string;
  role: UserRole;
  employee_id: string | null;
  assigned_zone_id: string | null;
  company_id: string | null;
  company_code: string | null;
  permissions: string[];
  membership_tier: MembershipTier | null;
  membership_status: MembershipStatus;
  partner_application_id: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

/** Mirrors public.bookings table */
export interface BookingRow {
  id: string;
  customer_id: string;
  cleaner_id: string | null;
  service: string;
  status: BookingStatus;
  date: string;
  time: string;
  address: string;
  city: string;
  property_type: string;
  bedrooms: number;
  bathrooms: number;
  size: string;
  frequency: string;
  special_requests: string;
  fragrance: string;
  allergies: string;
  access_instructions: string;
  cleaner_notes: string;
  before_photos: string[];
  progress_photos: string[];
  after_photos: string[];
  partner_company_id: string | null;
  created_at: string;
  updated_at: string;
}

/** Mirrors public.booking_timeline table */
export interface TimelineRow {
  id: string;
  booking_id: string;
  event: string;
  note: string;
  actor: string;
  created_at: string;
}

/** Mirrors public.notifications table */
export interface NotificationRow {
  id: string;
  user_id: string;
  title: string;
  message: string;
  read: boolean;
  link: string;
  created_at: string;
}

/** Mirrors public.partner_applications table */
export interface PartnerApplicationRow {
  id: string;
  user_id: string | null;
  company_name: string;
  industry: string;
  contact_person: string;
  position: string;
  email: string;
  phone: string;
  website: string;
  address: string;
  services_required: string;
  estimated_volume: string;
  proposal: string;
  status: ApplicationStatus;
  created_at: string;
  updated_at: string;
}

/** Mirrors public.partner_projects table */
export interface PartnerProjectRow {
  id: string;
  partner_id: string;
  name: string;
  address: string;
  size: string;
  units: string;
  turnover_date: string | null;
  preferred_date: string | null;
  requirements: string;
  additional_info: string;
  status: PartnerProjectStatus;
  created_at: string;
  updated_at: string;
}

/** Mirrors public.training_programs table */
export interface TrainingProgramRow {
  id: string;
  name: string;
  description: string;
  requirements: string;
  duration: string;
  objectives: string[];
  schedule: string;
  slots: number;
  slots_available: number;
  price: number | null;
  is_active: boolean;
  created_at: string;
}

/** Mirrors public.training_applications table */
export interface TrainingApplicationRow {
  id: string;
  program_id: string;
  user_id: string | null;
  name: string;
  email: string;
  phone: string;
  experience: string;
  status: TrainingAppStatus;
  created_at: string;
  updated_at: string;
}

/** Mirrors public.contact_messages table */
export interface ContactMessageRow {
  id: string;
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  read: boolean;
  created_at: string;
}

// Full Database shape used by createClient<Database>()
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        Insert: Omit<ProfileRow, 'created_at' | 'updated_at'> & { created_at?: string; updated_at?: string };
        Update: Partial<ProfileRow>;
      };
      bookings: {
        Row: BookingRow;
        Insert: Omit<BookingRow, 'created_at' | 'updated_at'> & { created_at?: string; updated_at?: string };
        Update: Partial<BookingRow>;
      };
      booking_timeline: {
        Row: TimelineRow;
        Insert: Omit<TimelineRow, 'id' | 'created_at'> & { id?: string; created_at?: string };
        Update: Partial<TimelineRow>;
      };
      notifications: {
        Row: NotificationRow;
        Insert: Omit<NotificationRow, 'id' | 'created_at'> & { id?: string; created_at?: string };
        Update: Partial<NotificationRow>;
      };
      partner_applications: {
        Row: PartnerApplicationRow;
        Insert: Omit<PartnerApplicationRow, 'id' | 'created_at' | 'updated_at'> & { id?: string; created_at?: string; updated_at?: string };
        Update: Partial<PartnerApplicationRow>;
      };
      partner_projects: {
        Row: PartnerProjectRow;
        Insert: Omit<PartnerProjectRow, 'id' | 'created_at' | 'updated_at'> & { id?: string; created_at?: string; updated_at?: string };
        Update: Partial<PartnerProjectRow>;
      };
      training_programs: {
        Row: TrainingProgramRow;
        Insert: Omit<TrainingProgramRow, 'id' | 'created_at'> & { id?: string; created_at?: string };
        Update: Partial<TrainingProgramRow>;
      };
      training_applications: {
        Row: TrainingApplicationRow;
        Insert: Omit<TrainingApplicationRow, 'id' | 'created_at' | 'updated_at'> & { id?: string; created_at?: string; updated_at?: string };
        Update: Partial<TrainingApplicationRow>;
      };
      contact_messages: {
        Row: ContactMessageRow;
        Insert: Omit<ContactMessageRow, 'id' | 'created_at'> & { id?: string; created_at?: string };
        Update: Partial<ContactMessageRow>;
      };
    };
    Functions: Record<string, never>;
    Enums: {
      user_role: UserRole;
      booking_status: BookingStatus;
      membership_tier: MembershipTier;
      membership_status: MembershipStatus;
    };
  };
}

// ─── Client ──────────────────────────────────────────────────────────────────

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Persist session in localStorage so page reloads keep the user logged in
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

// ─── Auth Helpers ────────────────────────────────────────────────────────────

/** Sign up a new user for any role.
 *  Extra profile fields are stored in raw_user_meta_data and picked up
 *  by the handle_new_user() trigger that creates the profiles row.
 */
export async function signUp(options: {
  email: string;
  password: string;
  name: string;
  phone?: string;
  role: UserRole;
  employeeId?: string;
  companyCode?: string;
}) {
  const { data, error } = await supabase.auth.signUp({
    email: options.email,
    password: options.password,
    options: {
      data: {
        name: options.name,
        phone: options.phone ?? '',
        role: options.role,
        employee_id: options.employeeId ?? '',
        company_code: options.companyCode ?? '',
      },
    },
  });
  return { data, error };
}

/** Sign in with email + password. Works for all roles — role is stored in
 *  the profiles table, not in the auth token, so no role param needed here.
 */
export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  return { data, error };
}

/** Sign out the current user. */
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  return { error };
}

/** Fetch the profiles row for the currently authenticated user. */
export async function fetchProfile(userId: string): Promise<ProfileRow | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('[Supabase] fetchProfile error:', error.message);
    return null;
  }
  return data;
}

/** Update mutable profile fields for the current user. */
export async function updateProfile(
  userId: string,
  fields: Partial<Pick<ProfileRow, 'name' | 'phone' | 'avatar_url' | 'membership_tier' | 'membership_status'>>
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('profiles') as any)
    .update(fields)
    .eq('id', userId)
    .select()
    .single();
  return { data: data as ProfileRow | null, error };
}

// ─── MFA Helpers (Admin) ─────────────────────────────────────────────────────

/** Enroll an admin in TOTP MFA. Returns the QR code URI to show the user. */
export async function enrollAdminMfa() {
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
  return { data, error };
}

/** Begin an MFA challenge for the active TOTP factor. */
export async function challengeAdminMfa(factorId: string) {
  const { data, error } = await supabase.auth.mfa.challenge({ factorId });
  return { data, error };
}

/** Verify a 6-digit TOTP code for an active challenge. */
export async function verifyAdminMfa(factorId: string, challengeId: string, code: string) {
  const { data, error } = await supabase.auth.mfa.verify({ factorId, challengeId, code });
  return { data, error };
}

/** Returns the list of enrolled MFA factors for the current user. */
export async function listMfaFactors() {
  const { data, error } = await supabase.auth.mfa.listFactors();
  return { data, error };
}

// ─── Data Helpers ────────────────────────────────────────────────────────────

/** Fetch all bookings visible to the current user (RLS handles scoping). */
export async function fetchBookings() {
  const { data, error } = await supabase
    .from('bookings')
    .select('*, booking_timeline(*)')
    .order('created_at', { ascending: false });
  return { data, error };
}

/** Fetch notifications for the current user. */
export async function fetchNotifications(userId: string) {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  return { data, error };
}

/** Mark a single notification as read. */
export async function markNotificationRead(notificationId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('notifications') as any)
    .update({ read: true })
    .eq('id', notificationId);
  return { error };
}

/** Mark all notifications for a user as read. */
export async function markAllNotificationsRead(userId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('notifications') as any)
    .update({ read: true })
    .eq('user_id', userId);
  return { error };
}

/** Fetch all profiles — admin only (RLS enforced on the server). */
export async function fetchAllProfiles() {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });
  return { data, error };
}

/** Fetch cleaner profiles only. */
export async function fetchCleaners() {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', 'cleaner');
  return { data, error };
}
