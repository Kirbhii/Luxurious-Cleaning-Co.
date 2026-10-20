import { Moon, Sun } from 'lucide-react';
import { toggleTheme, useTheme } from '../lib/theme';

/**
 * The light/dark switch.
 *
 * Two shapes, one behaviour:
 *   · `icon` — a round button for the navbar, where it sits beside the bell and
 *     the avatar and has no room for words.
 *   · `full` — icon plus a word, for the portal headers, where it stands next
 *     to "Back to Home" and "Log out" and a bare glyph would look unfinished.
 *
 * Both icons are always mounted and cross-fade with a quarter turn. Swapping
 * one for the other would make the button appear to blink; keeping both and
 * animating opacity plus rotation reads as the sun setting into the moon, which
 * is the transition the theme itself is doing.
 *
 * The label names the ACTION, never the current state. A button whose text is
 * the state it is already in ("Dark" while dark) leaves you guessing whether
 * pressing it means "you are dark" or "become dark".
 */
export default function ThemeToggle({
  variant = 'icon',
  className = '',
}: {
  variant?: 'icon' | 'full';
  className?: string;
}) {
  const theme = useTheme();
  const goingTo = theme === 'dark' ? 'light' : 'dark';
  const label = goingTo === 'light' ? 'Light mode' : 'Dark mode';

  const icon = (extra: string) => (
    <>
      <Sun
        size={15}
        aria-hidden="true"
        className={`absolute transition-all duration-300 ${
          theme === 'dark' ? 'opacity-100 rotate-0' : 'opacity-0 -rotate-90'
        } ${extra}`}
      />
      <Moon
        size={15}
        aria-hidden="true"
        className={`absolute transition-all duration-300 ${
          theme === 'dark' ? 'opacity-0 rotate-90' : 'opacity-100 rotate-0'
        } ${extra}`}
      />
    </>
  );

  if (variant === 'full') {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        title={`Switch to ${label.toLowerCase()}`}
        className={`inline-flex items-center gap-2 rounded-lg border border-gold-400/25 px-4 py-2.5 text-sm font-semibold text-cream-200 transition-colors hover:border-gold-400/50 hover:text-cream-50 ${className}`}
      >
        <span className="relative w-[15px] h-[15px] shrink-0">{icon('text-cream-200')}</span>
        {label}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={`Switch to ${label.toLowerCase()}`}
      title={`Switch to ${label.toLowerCase()}`}
      className={`relative w-9 h-9 flex items-center justify-center rounded-full border border-gold-400/20 hover:border-gold-400/50 transition-colors ${className}`}
    >
      {icon('text-cream-200')}
    </button>
  );
}
