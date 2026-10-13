/**
 * Recovery-code generation, normalisation and formatting.
 *
 * The plaintext is generated HERE, in the browser, and shown to the user exactly
 * once. It is sent to `replace_mfa_recovery_codes()` over TLS, hashed there with
 * bcrypt, and never stored or returned — so this file is the only place the
 * plaintext ever exists in readable form.
 *
 * ─── The alphabet, and why ───────────────────────────────────────────────────
 * Crockford base32: digits 0-9 plus A-Z minus I, L, O and U.
 *
 *   - I, L and O are excluded because they are the characters people misread.
 *     These codes get written on paper, read back weeks later, and typed by
 *     someone who has already lost their phone. Confusing a 0 with an O at that
 *     moment is a support ticket at best and another lockout at worst.
 *   - U is excluded to avoid accidental obscenity in generated strings.
 *   - 32 symbols is exactly 5 bits, so 10 characters is exactly 50 bits with no
 *     bias and no rejection needed.
 *
 * Excluded characters are not merely forbidden — they are FOLDED onto the symbol
 * they were meant to be (O -> 0, I/L -> 1). So a misread code still works
 * instead of failing with "that code did not match".
 *
 * 50 bits is why the database stores bcrypt rather than sha256: 50 bits behind a
 * fast hash is worth attacking offline, and behind bcrypt it is not.
 */

/** Crockford base32 — 32 symbols, exactly 5 bits each. */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** Characters per code, before the display hyphen. */
const CODE_LENGTH = 10;

/** How many codes a fresh set contains. */
export const RECOVERY_CODE_COUNT = 10;

/**
 * Cryptographically random index into ALPHABET.
 *
 * Rejection sampling rather than `byte % 32` — with 32 symbols 256 is an exact
 * multiple so nothing is ever rejected, but writing it this way means the
 * function stays correct if the alphabet is ever changed.
 */
function randomIndex(): number {
  const maxUnbiased = Math.floor(256 / ALPHABET.length) * ALPHABET.length;
  const buf = new Uint8Array(1);
  for (;;) {
    crypto.getRandomValues(buf);
    if (buf[0] < maxUnbiased) return buf[0] % ALPHABET.length;
  }
}

/** A single code, unformatted: 10 characters from ALPHABET. */
function randomCode(): string {
  let out = '';
  for (let i = 0; i < CODE_LENGTH; i += 1) out += ALPHABET[randomIndex()];
  return out;
}

/**
 * A fresh set of codes. Duplicates are re-rolled rather than trusted — the
 * collision probability is negligible, but "negligible" is not "impossible" and
 * a duplicate would silently cost the user a code.
 */
export function generateRecoveryCodes(count: number = RECOVERY_CODE_COUNT): string[] {
  const seen = new Set<string>();
  while (seen.size < count) seen.add(randomCode());
  return [...seen];
}

/**
 * Strip whatever the user pasted down to the symbols we actually issue.
 *
 * Uppercases, drops every separator, then folds the three characters we
 * deliberately never emit onto the ones they were most likely meant to be:
 * O -> 0, I -> 1, L -> 1. Everything else is left as-is, and an unrecognised
 * character survives to be rejected by the server rather than being silently
 * turned into a valid one.
 *
 * MUST stay in lockstep with the SQL: `replace_mfa_recovery_codes()` and
 * `verify_mfa_recovery_code()` both strip to `[A-Za-z0-9]` and uppercase. Codes
 * are folded HERE, before they are ever sent, so the database only ever stores
 * and compares symbols from this alphabet.
 */
export function normalizeRecoveryCode(input: string): string {
  return input
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1');
}

/** Display form: XXXXX-XXXXX. Purely cosmetic; the hyphen is never sent. */
export function formatRecoveryCode(code: string): string {
  if (code.length !== CODE_LENGTH) return code;
  return `${code.slice(0, 5)}-${code.slice(5)}`;
}

/** Is this plausibly one of our codes? Shape only — the server decides validity. */
export function looksLikeRecoveryCode(input: string): boolean {
  return normalizeRecoveryCode(input).length === CODE_LENGTH;
}
