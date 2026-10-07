import { createClient } from '@supabase/supabase-js';
import type { UserRole } from '../store';
import type {
  Booking as AppBooking,
  ContactMessage as AppContactMessage,
  Notification as AppNotification,
  PartnerApplication as AppPartnerApplication,
  PartnerProject as AppPartnerProject,
  TrainingApplication as AppTrainingApplication,
  TrainingProgram as AppTrainingProgram,
} from '../store';

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
  | 'cancelled' | 'rescheduled' | 'awaiting_quote'
  | 'awaiting_review' | 'rejected';

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
  pin_hash: string | null;
  pin_created_at: string | null;
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
  /** Membership benefit wiring (migration 006). Optional until applied. */
  priority?: string | null;
  member_tier?: MembershipTier | null;
  discount_percent?: number | null;
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
  resume_name?: string | null;
  resume_url?: string | null;
  company_id?: string | null;
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
  resume_name?: string | null;
  resume_url?: string | null;
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

/** Send a password reset email to the user. */
export async function resetPassword(email: string) {
  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  return { data, error };
}

/** Update the user's password (called after clicking the reset link). */
export async function updatePassword(newPassword: string) {
  const { data, error } = await supabase.auth.updateUser({
    password: newPassword,
  });
  return { data, error };
}

// ─── Client-safe column lists ────────────────────────────────────────────────
// profiles.pin_hash is NOT readable by clients (migration 007 revokes the
// table-level SELECT and re-grants only safe columns). A wildcard `select('*')`
// therefore FAILS with a permission error — always select these columns
// explicitly. Add new columns here when the schema grows.
export const PROFILE_COLUMNS = [
  'id',
  'email',
  'name',
  'phone',
  'role',
  'employee_id',
  'assigned_zone_id',
  'company_id',
  'company_code',
  'permissions',
  'pin_created_at',
  'membership_tier',
  'membership_status',
  'partner_application_id',
  'avatar_url',
  'created_at',
  'updated_at',
].join(', ');

/** Fetch the profiles row for the currently authenticated user. */
export async function fetchProfile(userId: string): Promise<ProfileRow | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('id', userId)
    .single();

  if (error) {
    console.error('[Supabase] fetchProfile error:', error.message);
    return null;
  }
  return data as unknown as ProfileRow;
}

/** Fetch all profiles from the database (admin only). */
export async function fetchAllProfiles(): Promise<ProfileRow[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[Supabase] fetchAllProfiles error:', error.message);
    return [];
  }
  return data || [];
}

/** Update mutable, self-service profile fields for the current user.
 *
 *  Only identity/contact fields are accepted. Privileged columns
 *  (role, membership_tier, membership_status, employee_id, company_id,
 *  permissions, pin_hash) are enforced server-side by the
 *  enforce_profile_column_privileges trigger in migration 007, and are
 *  deliberately not part of this signature. Membership changes go through
 *  activateMembership() / cancelMembership().
 */
export async function updateProfile(
  userId: string,
  fields: Partial<Pick<ProfileRow, 'name' | 'phone' | 'avatar_url'>>
) {
  // NOTE: the returning clause must list columns explicitly. A bare .select()
  // expands to `RETURNING *`, which requires SELECT privilege on EVERY column —
  // including pin_hash, which migration 007 revoked from the client roles. The
  // privilege check then fails and the whole UPDATE rolls back, so the change
  // silently never persists even though the request looked successful.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('profiles') as any)
    .update(fields)
    .eq('id', userId)
    .select(PROFILE_COLUMNS)
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

/** Turn off (unenroll) an MFA factor. */
export async function unenrollMfa(factorId: string) {
  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  return { error };
}

type RawFactor = { id: string; factor_type?: string; status?: string };

/** Narrow the SDK's factor list to plain fields we care about. */
function totpFactors(data: unknown): RawFactor[] {
  const all = (data as { all?: RawFactor[] } | null)?.all ?? [];
  return all.filter(f => f.factor_type === 'totp');
}

/**
 * The user's *verified* TOTP factor, if any.
 *
 * An enrolled-but-unverified factor does NOT count. Supabase only treats a
 * factor as active once a code has been checked against it, so a half-finished
 * enrollment must never be mistaken for protection that actually exists.
 */
export async function verifiedTotpFactor(): Promise<{
  factorId: string | null;
  error: { message: string } | null;
}> {
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) return { factorId: null, error: { message: error.message } };
  const verified = totpFactors(data).find(f => f.status === 'verified');
  return { factorId: verified?.id ?? null, error: null };
}

/**
 * Factors that were enrolled but never verified — the leftovers of an abandoned
 * setup. Clearing them before a fresh enroll avoids "factor already exists".
 */
export async function unverifiedTotpFactorIds(): Promise<string[]> {
  const { data } = await supabase.auth.mfa.listFactors();
  return totpFactors(data).filter(f => f.status !== 'verified').map(f => f.id);
}

/**
 * Whether the current session still owes a second factor.
 *
 * The *current* level is decoded from the access token's `aal` claim, which is
 * trustworthy. Whether a factor *exists* is asked of the server instead of read
 * from `nextLevel`.
 *
 * Do not go back to `nextLevel`. Called with no argument,
 * `getAuthenticatorAssuranceLevel()` computes it from `session.user.factors` —
 * the session object cached in storage, not a fresh read — so a session created
 * before the enrollment (or a sign-in response that omits `factors`) reports no
 * factor and the step-up is silently skipped. `listFactors()` performs a real
 * `/user` request, so it cannot go stale.
 */
export async function mfaStepUpRequired(): Promise<{
  required: boolean;
  factorId: string | null;
  error: { message: string } | null;
}> {
  const { data: aal, error: aalError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  // `required: true` on error, not false. The error flag is the primary signal
  // and resolveStepUp() reads it first — but this function's whole job is to
  // decide whether to demand a second factor, so it must never hand a caller a
  // fail-OPEN value. One that reads only `required` would otherwise let a failed
  // lookup mean "no factor is owed".
  if (aalError) return { required: true, factorId: null, error: { message: aalError.message } };
  if (aal?.currentLevel === 'aal2') return { required: false, factorId: null, error: null };

  const { factorId, error } = await verifiedTotpFactor();
  // Same rule: a failed factor read means "we do not know", and "we do not know"
  // must not read as "nothing is owed".
  if (error) return { required: true, factorId: null, error };
  return { required: factorId !== null, factorId, error: null };
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

/** Fetch cleaner profiles only. */
export async function fetchCleaners() {
  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('role', 'cleaner');
  return { data: data as unknown as ProfileRow[] | null, error };
}

// ─── Admin: Account Creation ─────────────────────────────────────────────────

/**
 * Approve a cleaner or partner application and automatically create their account.
 * This calls the Supabase Edge Function which:
 * 1. Generates a random password
 * 2. Creates the auth.users account
 * 3. Sends a welcome email with credentials
 * 
 * @param applicationType - 'cleaner' or 'partner'
 * @param applicationId - UUID of the training_application or partner_application
 * @returns credentials object with email, password, employeeId/companyCode
 */
export async function approveApplicationAndCreateAccount(
  applicationType: 'cleaner' | 'partner',
  applicationId: string
) {
  // The edge function uses the service-role key and verifies that the caller is
  // an admin. Send the current access token explicitly so the Authorization
  // header is always present — even if the client has not refreshed the session.
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;

  if (!accessToken) {
    return {
      data: null,
      error: { message: 'You must be signed in as an admin to approve applications.' },
    };
  }

  const { data, error } = await supabase.functions.invoke('create-account', {
    body: { applicationType, applicationId },
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (error) {
    console.error('[approveApplicationAndCreateAccount] error:', error);
    return { data: null, error };
  }

  return { data, error: null };
}

/**
 * Update application status to 'approved' or 'accepted'.
 * Call this BEFORE or AFTER creating the account.
 */
export async function updateApplicationStatus(
  applicationType: 'cleaner' | 'partner',
  applicationId: string,
  status: 'approved' | 'accepted' | 'rejected'
) {
  const table = applicationType === 'cleaner' ? 'training_applications' : 'partner_applications';
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from(table) as any)
    .update({ status })
    .eq('id', applicationId);

  return { error };
}

// ─── PIN Helpers (Staff: Cleaner, Admin, Partner) ────────────────────────────
// PINs are hashed and verified on the server (bcrypt via pgcrypto) by the
// SECURITY DEFINER functions in migrations 007 and 010. The client never sees
// the hash and never computes one — a 4-6 digit PIN hashed client-side with
// bare SHA-256 is trivially brute-forced, and `pin_hash` is not readable by
// clients at all.
//
// Setting a PIN always requires proof the session alone does not carry:
//   · a PIN already exists  -> the CURRENT PIN
//   · no PIN yet            -> the ACCOUNT PASSWORD (verified server-side
//                              against auth.users, not in the browser)
// Both are enforced inside set_user_pin(), so calling the RPC directly cannot
// skip them.

export type PinLockStatus = {
  /** Whether the account has a PIN at all. */
  hasPin: boolean;
  /** While true, even the CORRECT PIN is rejected. */
  isLocked: boolean;
  /** Seconds until the lockout lifts. 0 when not locked. */
  secondsRemaining: number;
  /** Attempts left before the lockout engages. */
  attemptsLeft: number;
};

/**
 * Detect a PostgREST "function not found" error, which is what you get when
 * migration 010 has not been applied yet. Callers use this to show an honest
 * "not available yet" notice instead of a scary raw error.
 */
export function isMissingRpc(message: string | undefined): boolean {
  if (!message) return false;
  return (
    message.includes('Could not find the function') ||
    message.includes('PGRST202') ||
    message.includes('does not exist')
  );
}

/**
 * Check if the current user has a PIN set.
 * Server-side; does not read the hash into the client.
 */
export async function hasPin(): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)('has_user_pin');
  if (error) {
    console.error('[Supabase] hasPin error:', error.message);
    return false;
  }
  return Boolean(data);
}

/**
 * Read the current user's PIN state without submitting one.
 *
 * Without this, the only way to discover "you are locked out" would be to
 * submit a PIN — which burns one of the five attempts. So the UI reads status
 * first and shows a countdown instead of inviting a doomed attempt.
 */
export async function pinLockStatus(): Promise<{
  status: PinLockStatus | null;
  error: { message: string } | null;
}> {
  const fallback: PinLockStatus = {
    hasPin: false,
    isLocked: false,
    secondsRemaining: 0,
    attemptsLeft: 5,
  };

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.rpc as any)('pin_lock_status');

    if (error) {
      console.error('[Supabase] pinLockStatus error:', error.message);
      return { status: null, error: { message: error.message } };
    }

    // A set-returning function comes back as an array over PostgREST.
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return { status: fallback, error: null };

    return {
      status: {
        hasPin: Boolean(row.has_pin),
        isLocked: Boolean(row.is_locked),
        secondsRemaining: Number(row.seconds_remaining ?? 0),
        attemptsLeft: Number(row.attempts_left ?? 0),
      },
      error: null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[Supabase] pinLockStatus threw:', message);
    return { status: null, error: { message } };
  }
}

/**
 * Create or change the current user's PIN.
 *
 * @param newPin      - 4-6 digit PIN
 * @param currentPin  - required when a PIN already exists
 * @param password    - required when setting the FIRST PIN
 */
export async function setPin(
  newPin: string,
  opts: { currentPin?: string; password?: string } = {}
): Promise<{ error: { message: string } | null }> {
  // Validate locally first for a fast, friendly error.
  if (!/^\d{4,6}$/.test(newPin)) {
    return { error: { message: 'PIN must be 4-6 digits' } };
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.rpc as any)('set_user_pin', {
      p_new_pin: newPin,
      p_current_pin: opts.currentPin || null,
      p_password: opts.password || null,
    });

    if (error) {
      console.error('[Supabase] setPin error:', error.message);
      return { error: { message: error.message } };
    }
    return { error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[Supabase] setPin threw:', message);
    return { error: { message } };
  }
}

/**
 * Verify the current user's PIN.
 * The comparison happens in the database; the client only receives a boolean.
 *
 * NOTE: while a lockout is active this returns `valid: false` even for the
 * correct PIN — that is deliberate (see migration 010). Callers must read
 * pinLockStatus() to tell "wrong PIN" apart from "locked out", otherwise a
 * locked-out user is told their PIN is incorrect when it was not.
 */
export async function verifyUserPin(
  pin: string
): Promise<{ valid: boolean; error?: { message: string } }> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.rpc as any)('verify_user_pin', { p_pin: pin });

    if (error) {
      console.error('[Supabase] verifyUserPin error:', error.message);
      return { valid: false, error: { message: error.message } };
    }

    if (data !== true) {
      return { valid: false, error: { message: 'Incorrect PIN' } };
    }

    return { valid: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[Supabase] verifyUserPin threw:', message);
    return { valid: false, error: { message } };
  }
}

// ─── Membership Helpers ──────────────────────────────────────────────────────
// membership_tier / membership_status are frozen against direct client writes
// (migration 007 trigger), so activation goes through a server-side function.

/** Activate the current customer's membership at the given tier. */
export async function activateMembership(
  tier: MembershipTier
): Promise<{ error: { message: string } | null }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.rpc as any)('activate_own_membership', { p_tier: tier });
  if (error) {
    console.error('[Supabase] activateMembership error:', error.message);
    return { error: { message: error.message } };
  }
  return { error: null };
}

/** Cancel the current customer's membership. */
export async function cancelMembership(): Promise<{ error: { message: string } | null }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.rpc as any)('cancel_own_membership');
  if (error) {
    console.error('[Supabase] cancelMembership error:', error.message);
    return { error: { message: error.message } };
  }
  return { error: null };
}

// ─── Database Persistence ─────────────────────────────────────────────────────
// Row-level security already scopes SELECTs (own rows, or all rows for admin),
// so plain selects return exactly what the signed-in user may see.
// Every helper fails soft ({ data: null, error }) so the app keeps working
// with local state when the database is unreachable.

export function isUuid(value: string | null | undefined): value is string {
  return !!value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

// ── Training programs ──

export function trainingProgramFromRow(row: TrainingProgramRow): AppTrainingProgram {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    requirements: row.requirements,
    duration: row.duration,
    objectives: row.objectives ?? [],
    schedule: row.schedule,
    slots: row.slots,
    slotsAvailable: row.slots_available,
    price: row.price === null || row.price === undefined ? null : Number(row.price),
  };
}

export async function fetchTrainingPrograms(): Promise<{ data: AppTrainingProgram[] | null; error: { message: string } | null }> {
  try {
    const { data, error } = await supabase
      .from('training_programs')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: true });
    if (error) return { data: null, error: { message: error.message } };
    return { data: (data as TrainingProgramRow[]).map(trainingProgramFromRow), error: null };
  } catch (err) {
    return { data: null, error: { message: err instanceof Error ? err.message : 'Network error' } };
  }
}

// ── Training applications ──

export function trainingAppFromRow(row: TrainingApplicationRow): AppTrainingApplication {
  return {
    id: row.id,
    programId: row.program_id,
    userId: row.user_id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    experience: row.experience,
    resumeName: row.resume_name ?? null,
    resumeUrl: row.resume_url ?? null,
    status: row.status,
    createdAt: row.created_at,
  };
}

export async function insertTrainingApplication(input: {
  program_id: string;
  user_id: string | null;
  name: string;
  email: string;
  phone: string;
  experience: string;
  resume_name: string | null;
  resume_url: string | null;
}): Promise<{ data: AppTrainingApplication | null; error: { message: string } | null }> {
  try {
    const { data, error } = await (supabase.from('training_applications') as any)
      .insert(input)
      .select()
      .single();
    if (error) return { data: null, error: { message: error.message } };
    return { data: trainingAppFromRow(data as TrainingApplicationRow), error: null };
  } catch (err) {
    return { data: null, error: { message: err instanceof Error ? err.message : 'Network error' } };
  }
}

export async function fetchTrainingApplications(): Promise<{ data: AppTrainingApplication[] | null; error: { message: string } | null }> {
  try {
    const { data, error } = await supabase
      .from('training_applications')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) return { data: null, error: { message: error.message } };
    return { data: (data as TrainingApplicationRow[]).map(trainingAppFromRow), error: null };
  } catch (err) {
    return { data: null, error: { message: err instanceof Error ? err.message : 'Network error' } };
  }
}

export async function updateTrainingApplicationRow(id: string, fields: { status: TrainingAppStatus }): Promise<{ error: { message: string } | null }> {
  try {
    const { error } = await (supabase.from('training_applications') as any)
      .update(fields)
      .eq('id', id);
    if (error) return { error: { message: error.message } };
    return { error: null };
  } catch (err) {
    return { error: { message: err instanceof Error ? err.message : 'Network error' } };
  }
}

export async function deleteTrainingApplicationRow(id: string): Promise<{ error: { message: string } | null }> {
  try {
    const { error } = await supabase.from('training_applications').delete().eq('id', id);
    if (error) return { error: { message: error.message } };
    return { error: null };
  } catch (err) {
    return { error: { message: err instanceof Error ? err.message : 'Network error' } };
  }
}

// ── Partner applications ──

export function partnerAppFromRow(row: PartnerApplicationRow): AppPartnerApplication {
  return {
    id: row.id,
    userId: row.user_id,
    companyName: row.company_name,
    industry: row.industry,
    contactPerson: row.contact_person,
    position: row.position,
    email: row.email,
    phone: row.phone,
    website: row.website,
    address: row.address,
    servicesRequired: row.services_required,
    estimatedVolume: row.estimated_volume,
  proposal: row.proposal,
  resumeName: row.resume_name ?? null,
  resumeUrl: row.resume_url ?? null,
  companyId: row.company_id ?? null,
  status: row.status,
  createdAt: row.created_at,
  };
}

export async function insertPartnerApplication(input: {
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
  resume_name: string | null;
  resume_url: string | null;
}): Promise<{ data: AppPartnerApplication | null; error: { message: string } | null }> {
  try {
    const { data, error } = await (supabase.from('partner_applications') as any)
      .insert(input)
      .select()
      .single();
    if (error) return { data: null, error: { message: error.message } };
    return { data: partnerAppFromRow(data as PartnerApplicationRow), error: null };
  } catch (err) {
    return { data: null, error: { message: err instanceof Error ? err.message : 'Network error' } };
  }
}

export async function fetchPartnerApplications(): Promise<{ data: AppPartnerApplication[] | null; error: { message: string } | null }> {
  try {
    const { data, error } = await supabase
      .from('partner_applications')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) return { data: null, error: { message: error.message } };
    return { data: (data as PartnerApplicationRow[]).map(partnerAppFromRow), error: null };
  } catch (err) {
    return { data: null, error: { message: err instanceof Error ? err.message : 'Network error' } };
  }
}

export async function updatePartnerApplicationRow(id: string, fields: { status: ApplicationStatus }): Promise<{ error: { message: string } | null }> {
  try {
    const { error } = await (supabase.from('partner_applications') as any)
      .update(fields)
      .eq('id', id);
    if (error) return { error: { message: error.message } };
    return { error: null };
  } catch (err) {
    return { error: { message: err instanceof Error ? err.message : 'Network error' } };
  }
}

// ── Bookings ──

export function bookingFromRow(row: BookingRow & { booking_timeline?: TimelineRow[] }): AppBooking {
  return {
    id: row.id,
    customerId: row.customer_id,
    service: row.service,
    status: row.status as AppBooking['status'],
    date: row.date,
    time: (row.time || '').slice(0, 5),
    address: row.address,
    city: row.city,
    propertyType: row.property_type,
    bedrooms: row.bedrooms,
    bathrooms: row.bathrooms,
    size: row.size,
    frequency: row.frequency,
    specialRequests: row.special_requests,
    fragrance: row.fragrance,
    allergies: row.allergies,
    accessInstructions: row.access_instructions,
    cleanerId: row.cleaner_id,
    cleanerNotes: row.cleaner_notes,
    beforePhotos: row.before_photos ?? [],
    progressPhotos: row.progress_photos ?? [],
    afterPhotos: row.after_photos ?? [],
    priority: (row.priority as AppBooking['priority']) ?? 'normal',
    memberTier: row.member_tier ?? null,
    discountPercent: row.discount_percent ?? 0,
    timeline: (row.booking_timeline ?? []).map(t => ({
      id: t.id,
      event: t.event,
      note: t.note,
      timestamp: t.created_at,
      actor: t.actor,
    })),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function bookingToRow(booking: AppBooking): Record<string, unknown> {
  return {
    id: booking.id,
    customer_id: booking.customerId,
    cleaner_id: isUuid(booking.cleanerId) ? booking.cleanerId : null,
    service: booking.service,
    status: booking.status,
    date: booking.date,
    time: booking.time,
    address: booking.address,
    city: booking.city,
    property_type: booking.propertyType,
    bedrooms: booking.bedrooms,
    bathrooms: booking.bathrooms,
    size: booking.size,
    frequency: booking.frequency,
    special_requests: booking.specialRequests,
    fragrance: booking.fragrance,
    allergies: booking.allergies,
    access_instructions: booking.accessInstructions,
    cleaner_notes: booking.cleanerNotes,
    before_photos: booking.beforePhotos,
    progress_photos: booking.progressPhotos,
    after_photos: booking.afterPhotos,
    priority: booking.priority ?? 'normal',
    member_tier: booking.memberTier ?? null,
    discount_percent: booking.discountPercent ?? 0,
  };
}

const MEMBER_COLUMNS = ['priority', 'member_tier', 'discount_percent'];

export async function insertBookingRow(booking: AppBooking): Promise<{ error: { message: string } | null }> {
  try {
    const full = bookingToRow(booking);
    const { error } = await (supabase.from('bookings') as any).insert(full);
    if (!error) return { error: null };
    // Fall back for databases where migration 006 hasn't been applied yet.
    if (/column|priority|member_tier|discount/i.test(error.message)) {
      const legacy = { ...full };
      for (const key of MEMBER_COLUMNS) delete legacy[key];
      const { error: retryError } = await (supabase.from('bookings') as any).insert(legacy);
      if (retryError) return { error: { message: retryError.message } };
      return { error: null };
    }
    return { error: { message: error.message } };
  } catch (err) {
    return { error: { message: err instanceof Error ? err.message : 'Network error' } };
  }
}

export async function fetchBookingsFromDb(): Promise<{ data: AppBooking[] | null; error: { message: string } | null }> {
  try {
    const { data, error } = await fetchBookings();
    if (error) return { data: null, error: { message: error.message } };
    return { data: (data as Array<BookingRow & { booking_timeline?: TimelineRow[] }>).map(bookingFromRow), error: null };
  } catch (err) {
    return { data: null, error: { message: err instanceof Error ? err.message : 'Network error' } };
  }
}

export async function updateBookingRow(
  id: string,
  fields: Partial<{ status: BookingStatus; cleaner_id: string | null; cleaner_notes: string; before_photos: string[]; progress_photos: string[]; after_photos: string[] }>
): Promise<{ error: { message: string } | null }> {
  try {
    // `.select('id')` makes PostgREST emit a RETURNING clause. Without it a write
    // that matched zero rows comes back as `error: null` — PostgREST only reports
    // success, never an affected-row count. A row is matched by the WHERE clause
    // AND the RLS policy, so an RLS-blocked update would otherwise look like it
    // worked while the database stayed untouched.
    const { data, error } = await (supabase.from('bookings') as any)
      .update(fields)
      .eq('id', id)
      .select('id');
    if (error) return { error: { message: error.message } };
    if (!data || data.length === 0) {
      return { error: { message: `Booking ${id} was not updated — it may have been removed, or you may not have permission to change it.` } };
    }
    return { error: null };
  } catch (err) {
    return { error: { message: err instanceof Error ? err.message : 'Network error' } };
  }
}

export async function deleteBookingRow(id: string): Promise<{ error: { message: string } | null }> {
  try {
    // See updateBookingRow — the RETURNING clause is what makes a zero-row delete
    // observable instead of a silent no-op reported as success.
    const { data, error } = await supabase.from('bookings').delete().eq('id', id).select('id');
    if (error) return { error: { message: error.message } };
    if (!data || data.length === 0) {
      return { error: { message: `Booking ${id} was not deleted — it may have been removed already, or you may not have permission to delete it.` } };
    }
    return { error: null };
  } catch (err) {
    return { error: { message: err instanceof Error ? err.message : 'Network error' } };
  }
}

// ── Contact messages ──

export async function insertContactMessage(input: {
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
}): Promise<{ data: AppContactMessage | null; error: { message: string } | null }> {
  try {
    const { data, error } = await (supabase.from('contact_messages') as any)
      .insert(input)
      .select()
      .single();
    if (error) return { data: null, error: { message: error.message } };
    const row = data as ContactMessageRow;
    return {
      data: {
        id: row.id,
        name: row.name,
        email: row.email,
        phone: row.phone,
        subject: row.subject,
        message: row.message,
        createdAt: row.created_at,
        read: row.read,
      },
      error: null,
    };
  } catch (err) {
    return { data: null, error: { message: err instanceof Error ? err.message : 'Network error' } };
  }
}

export async function fetchContactMessages(): Promise<{ data: AppContactMessage[] | null; error: { message: string } | null }> {
  try {
    const { data, error } = await supabase
      .from('contact_messages')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) return { data: null, error: { message: error.message } };
    return {
      data: (data as ContactMessageRow[]).map(row => ({
        id: row.id,
        name: row.name,
        email: row.email,
        phone: row.phone,
        subject: row.subject,
        message: row.message,
        createdAt: row.created_at,
        read: row.read,
      })),
      error: null,
    };
  } catch (err) {
    return { data: null, error: { message: err instanceof Error ? err.message : 'Network error' } };
  }
}

// ── Notifications ──

export function notificationFromRow(row: NotificationRow): AppNotification {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    message: row.message,
    read: row.read,
    link: row.link,
    createdAt: row.created_at,
  };
}

export async function insertNotification(input: {
  user_id: string;
  title: string;
  message: string;
  link: string;
}): Promise<{ data: AppNotification | null; error: { message: string } | null }> {
  if (!isUuid(input.user_id)) return { data: null, error: { message: 'Invalid user id' } };
  try {
    const { data, error } = await (supabase.from('notifications') as any)
      .insert(input)
      .select()
      .single();
    if (error) return { data: null, error: { message: error.message } };
    return { data: notificationFromRow(data as NotificationRow), error: null };
  } catch (err) {
    return { data: null, error: { message: err instanceof Error ? err.message : 'Network error' } };
  }
}

export async function fetchNotificationsFromDb(userId: string): Promise<{ data: AppNotification[] | null; error: { message: string } | null }> {
  try {
    const { data, error } = await fetchNotifications(userId);
    if (error) return { data: null, error: { message: error.message } };
    return { data: (data as NotificationRow[]).map(notificationFromRow), error: null };
  } catch (err) {
    return { data: null, error: { message: err instanceof Error ? err.message : 'Network error' } };
  }
}

export async function markNotificationReadDb(id: string): Promise<void> {
  try {
    await markNotificationRead(id);
  } catch {
    // best-effort only
  }
}

export async function markAllNotificationsReadDb(userId: string): Promise<void> {
  try {
    await markAllNotificationsRead(userId);
  } catch {
    // best-effort only
  }
}

// ── Partner companies & projects ─────────────────────────────────────────────

export interface PartnerCompanyRow {
  id: string;
  name: string;
  code: string;
  industry: string | null;
  website: string | null;
  address: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  is_active: boolean;
  created_at: string;
}

export function generateCompanyCode(companyName: string): string {
  const prefix = (companyName.replace(/[^a-zA-Z]/g, '').slice(0, 4) || 'LC').toUpperCase();
  const rand = Math.floor(100 + Math.random() * 900);
  return `${prefix}-${rand}`;
}

/** Create the company record for an approved partner (admin only per RLS). Retries on code collision. */
export async function createPartnerCompany(input: {
  name: string;
  industry: string;
  website: string;
  address: string;
  contact_email: string;
  contact_phone: string;
}): Promise<{ data: PartnerCompanyRow | null; error: { message: string } | null }> {
  try {
    for (let attempt = 0; attempt < 3; attempt++) {
      const { data, error } = await (supabase.from('partner_companies') as any)
        .insert({ ...input, code: generateCompanyCode(input.name) })
        .select()
        .single();
      if (!error) return { data: data as PartnerCompanyRow, error: null };
      if (error.code !== '23505') return { data: null, error: { message: error.message } };
    }
    return { data: null, error: { message: 'Could not generate a unique company code' } };
  } catch (err) {
    return { data: null, error: { message: err instanceof Error ? err.message : 'Network error' } };
  }
}

export async function linkPartnerApplicationCompany(appId: string, companyId: string): Promise<{ error: { message: string } | null }> {
  try {
    const { error } = await (supabase.from('partner_applications') as any)
      .update({ company_id: companyId })
      .eq('id', appId);
    if (error) return { error: { message: error.message } };
    return { error: null };
  } catch (err) {
    return { error: { message: err instanceof Error ? err.message : 'Network error' } };
  }
}

/** Tag a partner profile with its company (admin only).
 *
 *  profiles.company_id is frozen against direct client writes (migration 007),
 *  so this goes through a SECURITY DEFINER function that verifies the caller is
 *  an admin. Without it, the column would have to stay writable by every user —
 *  which is what let a partner self-assign an arbitrary company.
 */
export async function setProfileCompany(
  userId: string,
  companyId: string
): Promise<{ error: { message: string } | null }> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.rpc as any)('admin_set_profile_company', {
      p_user_id: userId,
      p_company_id: companyId,
    });
    if (error) return { error: { message: error.message } };
    return { error: null };
  } catch (err) {
    return { error: { message: err instanceof Error ? err.message : 'Network error' } };
  }
}

/** The roles an admin may assign from the dashboard.
 *
 *  'admin' is deliberately excluded — admin_set_user_role() (migration 008)
 *  refuses to grant it, so minting another admin stays a deliberate act in the
 *  Supabase dashboard rather than a UI action.
 */
export type AssignableRole = 'customer' | 'cleaner' | 'partner';

/** Change another user's role. Admin-only, enforced server-side.
 *
 *  profiles.role is frozen against client writes (migration 007 column grants
 *  plus the enforce_profile_column_privileges trigger), so this write has to go
 *  through admin_set_user_role() from migration 008. That function refuses to
 *  grant 'admin' and refuses to change the caller's own role.
 */
export async function setUserRole(
  userId: string,
  role: AssignableRole
): Promise<{ error: { message: string } | null }> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.rpc as any)('admin_set_user_role', {
      p_user_id: userId,
      p_role: role,
    });
    if (error) return { error: { message: error.message } };
    return { error: null };
  } catch (err) {
    return { error: { message: err instanceof Error ? err.message : 'Network error' } };
  }
}

export function partnerProjectFromRow(row: PartnerProjectRow): AppPartnerProject {
  return {
    id: row.id,
    partnerId: row.partner_id,
    name: row.name,
    address: row.address,
    size: row.size,
    units: row.units,
    turnoverDate: row.turnover_date ?? '',
    preferredDate: row.preferred_date ?? '',
    requirements: row.requirements,
    additionalInfo: row.additional_info,
    status: row.status,
    createdAt: row.created_at,
  };
}

export async function insertPartnerProject(input: {
  partner_id: string;
  name: string;
  address: string;
  size: string;
  units: string;
  turnover_date: string | null;
  preferred_date: string | null;
  requirements: string;
  additional_info: string;
}): Promise<{ data: AppPartnerProject | null; error: { message: string } | null }> {
  try {
    const { data, error } = await (supabase.from('partner_projects') as any)
      .insert(input)
      .select()
      .single();
    if (error) return { data: null, error: { message: error.message } };
    return { data: partnerProjectFromRow(data as PartnerProjectRow), error: null };
  } catch (err) {
    return { data: null, error: { message: err instanceof Error ? err.message : 'Network error' } };
  }
}

export async function fetchPartnerProjects(): Promise<{ data: AppPartnerProject[] | null; error: { message: string } | null }> {
  try {
    const { data, error } = await supabase
      .from('partner_projects')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) return { data: null, error: { message: error.message } };
    return { data: (data as PartnerProjectRow[]).map(partnerProjectFromRow), error: null };
  } catch (err) {
    return { data: null, error: { message: err instanceof Error ? err.message : 'Network error' } };
  }
}

// ─── Resume Upload (Supabase Storage) ─────────────────────────────────────────
// Files go to the PRIVATE `resumes` bucket (see migrations 003 + 007). Access is
// scoped to the uploader and admins — applicant PII is no longer world-readable.
// Path shape is fixed: <userId>/<timestamp>_<random>_<sanitized-name>, which the
// storage RLS policies rely on for the ownership check.

export const RESUME_BUCKET = 'resumes';
export const RESUME_MAX_BYTES = 5 * 1024 * 1024;
const RESUME_ALLOWED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

export function validateResumeFile(file: File): string | null {
  if (!RESUME_ALLOWED_TYPES.includes(file.type)) {
    return 'Only PDF or Word documents (.pdf, .doc, .docx) are accepted.';
  }
  if (file.size > RESUME_MAX_BYTES) {
    return 'File is too large. Maximum size is 5MB.';
  }
  return null;
}

/** Upload a resume and return its storage path.
 *
 *  The bucket is private, so there is no permanent public URL. Callers store the
 *  returned `path` and generate a short-lived signed URL on demand via
 *  getResumeSignedUrl().
 */
export async function uploadResume(file: File, userId: string): Promise<{ path: string }> {
  const validationError = validateResumeFile(file);
  if (validationError) throw new Error(validationError);

  const sanitized = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
  const path = `${userId}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${sanitized}`;

  const { error } = await supabase.storage.from(RESUME_BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (error) throw new Error(error.message);

  return { path };
}

/** Create a short-lived signed URL for a private resume object.
 *  Works for the uploader (owner) and for admins reviewing applications.
 */
export async function getResumeSignedUrl(
  path: string,
  expiresInSeconds = 60 * 10
): Promise<{ url: string | null; error: { message: string } | null }> {
  const { data, error } = await supabase.storage
    .from(RESUME_BUCKET)
    .createSignedUrl(path, expiresInSeconds);

  if (error) return { url: null, error: { message: error.message } };
  return { url: data?.signedUrl ?? null, error: null };
}
