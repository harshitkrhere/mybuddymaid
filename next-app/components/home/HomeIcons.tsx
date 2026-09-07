// components/home/HomeIcons.tsx — inline 24px stroke icons for the landing page. Hand-written
// paths (no icon CDN, no icon-font script): a server component with zero runtime cost, so
// the home page keeps its "no third-party scripts" rule and stays free of a client boundary.

export type IconName =
  | 'shield'
  | 'tag'
  | 'clock'
  | 'map-pin'
  | 'broom'
  | 'medal'
  | 'search'
  | 'refresh'
  | 'house'
  | 'cook'
  | 'baby'
  | 'heart'
  | 'check'
  | 'arrow-right'
  | 'users';

const PATHS: Record<IconName, React.ReactNode> = {
  shield: (
    <>
      <path d="M12 3l7 3v5c0 4.6-3 8.4-7 10-4-1.6-7-5.4-7-10V6l7-3z" />
      <path d="M9 12l2 2 4-4" />
    </>
  ),
  tag: (
    <>
      <path d="M20.6 13.4L13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z" />
      <circle cx="7.5" cy="7.5" r="1.5" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  'map-pin': (
    <>
      <path d="M12 21s-6-5.3-6-10a6 6 0 0 1 12 0c0 4.7-6 10-6 10z" />
      <circle cx="12" cy="11" r="2.5" />
    </>
  ),
  broom: (
    <>
      <path d="M15 3l6 6" />
      <path d="M11 7l6 6" />
      <path d="M13 9L6 16" />
      <path d="M6 16l-3 5 5-3 3-3-2-2-3 3z" />
    </>
  ),
  medal: (
    <>
      <circle cx="12" cy="14" r="5" />
      <path d="M9 9.5L6 3h4l2 4 2-4h4l-3 6.5" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </>
  ),
  refresh: (
    <>
      <path d="M20 12a8 8 0 0 1-14.3 4.9" />
      <path d="M4 12a8 8 0 0 1 14.3-4.9" />
      <path d="M20 4v4h-4" />
      <path d="M4 20v-4h4" />
    </>
  ),
  house: (
    <>
      <path d="M3 11l9-8 9 8" />
      <path d="M5 10v10h14V10" />
      <path d="M10 20v-6h4v6" />
    </>
  ),
  cook: (
    <>
      <path d="M8 3.5a4 4 0 0 1 8 0 3.5 3.5 0 0 1 2 6.5v4H6v-4a3.5 3.5 0 0 1 2-6.5z" />
      <path d="M6 14h12v6H6z" />
    </>
  ),
  baby: (
    <>
      <circle cx="12" cy="9" r="5" />
      <path d="M9 9h.01M15 9h.01" />
      <path d="M10 12a3 3 0 0 0 4 0" />
      <path d="M6 21a6 6 0 0 1 12 0" />
    </>
  ),
  heart: (
    <>
      <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />
      <path d="M8 12h2l1.5-2 2 4 1.5-2h2" />
    </>
  ),
  check: <path d="M20 6L9 17l-5-5" />,
  'arrow-right': (
    <>
      <path d="M5 12h14" />
      <path d="M13 6l6 6-6 6" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      <path d="M16 4.5a3.5 3.5 0 0 1 0 7" />
      <path d="M17.5 13.5a6.5 6.5 0 0 1 4 6.5" />
    </>
  ),
};

export function Icon({ name, size = 24, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}
