import type { UserRole } from '../store';

/**
 * Accounts you have signed in with, remembered so the login form does not make
 * you retype a long email address every time you switch between admin, cleaner,
 * and customer while testing.
 *
 * ── WHAT IS STORED, AND WHAT IS DELIBERATELY NOT ────────────────────────────
 * Only the email address, the role, and the display name — never a password.
 * This site is live on a public URL, so anything written here is readable by any
 * script running on the page. A password in localStorage would survive sign-out
 * and could not be revoked by it; the session token Supabase already keeps there
 * expires and dies on sign-out. Keeping the password out is what makes this safe
 * to ship to production.
 *
 * The password half of the problem is better solved by the browser's own
 * password manager — it stores credentials in the OS credential store rather
 * than in page-readable storage. Save the password there once and the browser
 * offers the same one-click sign-in this file deliberately does not provide.
 */

const STORAGE_KEY = 'lc.remembered-accounts.v1';
const MAX_ACCOUNTS = 8;

export type RememberedAccount = {
  email: string;
  role: UserRole | null;
  name: string;
  lastUsedAt: number;
};

export const ROLE_LABEL: Record<UserRole, string> = {
  admin: 'Admin',
  cleaner: 'Cleaner',
  partner: 'Partner',
  customer: 'Customer',
};

/**
 * Line 1 of a picker row. The role, because that is how you scan the list —
 * "alin dito ang admin?". Falls back to the name only when there is no role.
 */
export function accountTitle(account: RememberedAccount): string {
  if (account.role) return ROLE_LABEL[account.role];
  return account.name.trim() || account.email;
}

/** The name in "Log in as …". The person, not the role. */
export function accountDisplayName(account: RememberedAccount): string {
  if (account.name.trim()) return account.name.trim();
  if (account.role) return ROLE_LABEL[account.role];
  return account.email.split('@')[0];
}

/**
 * One or two letters for the avatar circle. Facebook shows a photo; this is the
 * fallback for the common case where `profiles.avatar_url` is null, which it is
 * for every account here today. Multi-word names get two letters (Test One ->
 * TO), single words get one (Charles -> C) so the circle does not read as a
 * clipped word.
 */
export function accountInitials(account: RememberedAccount): string {
  const source = (account.name.trim() || account.role || account.email).trim();
  const parts = source.split(/[\s._-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.slice(0, 1).toUpperCase();
}

function isRole(v: unknown): v is UserRole {
  return v === 'admin' || v === 'cleaner' || v === 'partner' || v === 'customer';
}

/**
 * Never throws. A browser in private mode, a quota error, or hand-edited JSON
 * must all degrade to "no remembered accounts" — this is a convenience list, and
 * it is not allowed to be the reason the login page fails to render.
 */
export function loadRememberedAccounts(): RememberedAccount[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((a): a is Record<string, unknown> => !!a && typeof a === 'object')
      .map(a => ({
        email: String(a.email ?? ''),
        role: isRole(a.role) ? a.role : null,
        name: typeof a.name === 'string' ? a.name : '',
        lastUsedAt: typeof a.lastUsedAt === 'number' ? a.lastUsedAt : 0,
      }))
      .filter(a => a.email.includes('@'))
      .sort((a, b) => b.lastUsedAt - a.lastUsedAt)
      .slice(0, MAX_ACCOUNTS);
  } catch {
    return [];
  }
}

function save(accounts: RememberedAccount[]): RememberedAccount[] {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
  } catch {
    // Private mode / quota. The in-memory list still works for this session.
  }
  return accounts;
}

/**
 * Called after a successful password authentication — which is why it can store
 * the role: the profile is already fetched by then. Re-signing in to a known
 * address refreshes its role rather than duplicating it, so a role change made
 * in the dashboard shows up on the next login instead of going stale.
 */
export function rememberAccount(input: {
  email: string;
  role?: UserRole | null;
  name?: string;
}): RememberedAccount[] {
  const email = input.email.trim().toLowerCase();
  if (!email) return loadRememberedAccounts();

  const existing = loadRememberedAccounts();
  const previous = existing.find(a => a.email === email);

  const next: RememberedAccount = {
    email,
    // A failed profile read must not erase a role we already knew.
    role: input.role ?? previous?.role ?? null,
    name: input.name || previous?.name || '',
    lastUsedAt: Date.now(),
  };

  return save([next, ...existing.filter(a => a.email !== email)].slice(0, MAX_ACCOUNTS));
}

export function forgetAccount(email: string): RememberedAccount[] {
  const target = email.trim().toLowerCase();
  return save(loadRememberedAccounts().filter(a => a.email !== target));
}
