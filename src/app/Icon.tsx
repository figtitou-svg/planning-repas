import type { ReactNode } from "react";

// Jeu d'icônes maison : même trait (1,75 px, bouts arrondis) partout, contrairement aux emojis
// qui changent d'aspect selon le système.
const PATHS = {
  home: <path d="M3.5 11 12 3.5 20.5 11v8.5a1 1 0 0 1-1 1H15v-6H9v6H4.5a1 1 0 0 1-1-1z" />,
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </>
  ),
  book: (
    <>
      <path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v14H6.5A1.5 1.5 0 0 0 5 18.5z" />
      <path d="M5 18.5A1.5 1.5 0 0 0 6.5 20H19M9 7.5h6" />
    </>
  ),
  cart: (
    <>
      <path d="M3 4h2.4l2.1 10.5h10.2L20 7.5H6.2" />
      <circle cx="9" cy="19" r="1.4" />
      <circle cx="17" cy="19" r="1.4" />
    </>
  ),
  box: <path d="m3.5 8 8.5-4.5L20.5 8v8.5L12 21l-8.5-4.5zM3.5 8 12 12.5 20.5 8M12 12.5V21" />,
  bell: <path d="M6 16.5V11a6 6 0 1 1 12 0v5.5l1.8 1.8H4.2zM10 21h4" />,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  x: <path d="m6 6 12 12M18 6 6 18" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  trash: <path d="M4 7h16M9 7V4.5h6V7M6.2 7l.9 13h9.8l.9-13" />,
  edit: <path d="m4 20 1-4L16 5l3 3L8 19zM14 7l3 3" />,
  heart: (
    <path d="M12 20.3s-7.6-4.6-7.6-10.4A4.4 4.4 0 0 1 12 7.3a4.4 4.4 0 0 1 7.6 2.6c0 5.8-7.6 10.4-7.6 10.4z" />
  ),
  list: <path d="M9 6.5h11M9 12h11M9 17.5h11M4.5 6.5h.01M4.5 12h.01M4.5 17.5h.01" />,
  "chevron-left": <path d="m15 5-7 7 7 7" />,
  "chevron-right": <path d="m9 5 7 7-7 7" />,
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof PATHS;

export function Icon({
  name,
  className,
  filled = false,
}: {
  name: IconName;
  className?: string;
  /** Remplit la forme (cœur plein d'une favorite). */
  filled?: boolean;
}) {
  return (
    <svg
      className={className ? `icon ${className}` : "icon"}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}
