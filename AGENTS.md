# figma-make-app

React + Vite + Tailwind CSS project running inside Figma Make.

## Development Server

A Vite development server is **already running** on `$PORT` (default 8443). You don't need to start it manually.

- Preview URL: The user can access the running app through the preview panel
- Hot reload: Changes to source files are reflected immediately

## Project Structure

This is the canonical project structure. Start with task-relevant files below. Only follow imports or inspect other files when required, when a documented path is missing, or when the repository contradicts this guide.

- `src/main.tsx` - React entrypoint; imports `src/index.css` and mounts `src/App.tsx` into the `#root` element
- `src/App.tsx` - Primary application component and the usual starting point for UI work
- `src/index.css` - Global CSS entrypoint and Tailwind CSS v4 import
- `index.html` - Vite HTML shell containing the `#root` element and loading `src/main.tsx`
- `package.json` - Project dependencies and the Vite build, development, preview, and formatting scripts
- `vite.config.ts` - Vite configuration with React, Tailwind CSS v4, and Figma Make plugins plus the `@` alias for `src`
- `.mise.toml` - Toolchain versions for Node.js and pnpm

## Dependencies

- Runtime: React 19 and React DOM 19
- Styling: Tailwind CSS v4 with the `@tailwindcss/vite` plugin
- Build tooling: Vite 8, TypeScript 5.7, and `@vitejs/plugin-react`
- Formatting: oxfmt

## Styling

This project uses **Tailwind CSS v4** through the `@tailwindcss/vite` plugin configured in `vite.config.ts`. `src/index.css` imports Tailwind with `@import 'tailwindcss';`. Use Tailwind utility classes directly in JSX and put global CSS or Tailwind v4 theme customization in `src/index.css`. This scaffold does not need a Tailwind config file or PostCSS config.

`src/main.tsx` imports `src/index.css`, so global font wiring belongs in `src/index.css`. Keep CSS `@import` statements first, then add any `@font-face` rules and font-family defaults there.

## Code quality

- Use double quotes for strings containing apostrophes (`"We're here to help"`), or escape them in single-quoted strings. An unescaped apostrophe in a single-quoted string breaks the build.
- Ensure JSX tags are closed and braces are balanced.
- Export components as default exports.

## Security conventions

These rules were established by the security-hardening pass in
`supabase/migrations/007_security_hardening.sql`. Follow them for new code.

**Never write privileged profile columns from the client.**
`profiles.role`, `membership_tier`, `membership_status`, `permissions`,
`employee_id`, `company_id`, `company_code`, and `pin_hash` are frozen against
client `UPDATE` by the `profiles_enforce_column_privileges` trigger. Self-service
`updateProfile()` accepts only `name`, `phone`, `avatar_url`.

- Membership changes → `activateMembership(tier)` / `cancelMembership()` (RPC)
- PIN set/verify → `setPin(pin)` / `verifyUserPin(pin)` / `hasPin()` (RPC)
- Anything else privileged → a `SECURITY DEFINER` function, or an edge function
  running as `service_role`

**Never hashed client-side.** Password/PIN hashing happens in Postgres via
`pgcrypto`. A 4-6 digit PIN hashed with bare SHA-256 in the browser is
brute-forceable in under a second.

**Storage buckets holding user files are private.** Render them with signed
URLs (`getResumeSignedUrl` + the `ResumeLink` component), never
`getPublicUrl()`. A bucket path must begin with the owner's user id —
`<userId>/<file>` — because the storage RLS policies key off
`(storage.foldername(name))[1]`.

**Edge functions must authenticate the caller.** `create-account` verifies the
bearer token and requires `role = 'admin'` before touching the service-role
client. Never run a privileged operation without checking the caller's role
server-side; a client-side route guard is not a security boundary.

**Return generic errors.** Do not echo internal error messages or generated
credentials to unauthenticated callers.

**RLS is row-level, not column-level.** A permissive `FOR UPDATE USING
(id = auth.uid())` policy grants every column on that row. Pair broad policies
with a column-privilege trigger.

## Site metadata

Page title, description, and the `robots` index/noindex flag are driven by
`.figma/make/site.json` — not by editing `index.html` directly. The Vite
`figmaSiteConfiguration` plugin injects them into the `<!-- figma:* -->` slots.
Editing `index.html` metadata by hand produces duplicated tags.

