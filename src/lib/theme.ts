import { useSyncExternalStore } from 'react';

/**
 * Light / dark theme, as a tiny external store.
 *
 * The theme is a property of the DOCUMENT, not of any one React tree: the
 * navbar, the portals, the login screen and the modals all have to agree, and
 * several of them render in different trees. So the source of truth is the
 * `data-theme` attribute on <html> — the same attribute the CSS reads — and
 * React subscribes to it rather than holding a copy. A React copy would be a
 * second answer to the same question, and the two would eventually disagree.
 *
 * Dark is the default and stays the default for anyone who has never chosen.
 * Nothing about the existing look changes unless the user asks for it.
 */

export type Theme = 'dark' | 'light';

const STORAGE_KEY = 'lcc-theme';

/**
 * How long the cross-fade runs. Kept in step with the `.theme-anim` block in
 * index.css: the class has to outlive the transition it enables, or the last
 * few frames snap.
 */
const TRANSITION_MS = 380;

const listeners = new Set<() => void>();

/** The stored preference. Dark unless the user explicitly chose light. */
export function readStoredTheme(): Theme {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'light' ? 'light' : 'dark';
  } catch {
    // Private mode, or storage disabled. Not an error worth surfacing — the
    // theme simply does not persist across visits.
    return 'dark';
  }
}

/** The theme actually in force, read off the document. */
export function currentTheme(): Theme {
  return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
}

let clearTransition: number | undefined;

export function setTheme(theme: Theme) {
  const root = document.documentElement;

  if (root.getAttribute('data-theme') !== theme) {
    // Enable the cross-fade for exactly one switch, then take it away again.
    // Leaving it on would put a 380ms delay on every hover in the app.
    root.classList.add('theme-anim');
    window.clearTimeout(clearTransition);
    clearTransition = window.setTimeout(() => root.classList.remove('theme-anim'), TRANSITION_MS);
  }

  root.setAttribute('data-theme', theme);

  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Chosen for this session only. Still applied — just not remembered.
  }

  listeners.forEach((l) => l());
}

export function toggleTheme() {
  setTheme(currentTheme() === 'dark' ? 'light' : 'dark');
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * The theme currently applied. Reads the DOM rather than a React state copy, so
 * a toggle in one tree updates every other one immediately.
 *
 * The third argument is the server snapshot. There is no SSR here, but
 * useSyncExternalStore requires it, and returning the default keeps the shape
 * honest: nothing has been read yet, so nothing is claimed.
 */
export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, currentTheme, () => 'dark' as Theme);
}
