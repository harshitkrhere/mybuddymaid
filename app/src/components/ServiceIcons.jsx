// Custom SVG service icons — professional, consistent style
export function CleaningIcon({ size = 28, color = '#0D5C63' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2v6M5.5 8.5l3 3M18.5 8.5l-3 3" />
      <path d="M8 14h8l1 7H7l1-7z" />
      <path d="M10 14v4M14 14v4" />
    </svg>
  );
}

export function LiveInIcon({ size = 28, color = '#D97706' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 10.5L12 4l9 6.5" />
      <path d="M5 9.5V19a1 1 0 001 1h12a1 1 0 001-1V9.5" />
      <path d="M9 20v-6h6v6" />
      <circle cx="12" cy="12" r="1.5" />
    </svg>
  );
}

export function ElderCareIcon({ size = 28, color = '#DC2626' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
      <path d="M12 8v4M12 15v.01" />
    </svg>
  );
}

export function CookIcon({ size = 28, color = '#059669' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 4c-1.5 0-3 .5-3 2s1.5 2 3 2 3-.5 3-2-1.5-2-3-2z" />
      <path d="M4 14h16" />
      <path d="M6 14v4a2 2 0 002 2h8a2 2 0 002-2v-4" />
      <path d="M8 10v4M16 10v4M12 8v6" />
    </svg>
  );
}

export function NannyIcon({ size = 28, color = '#7C3AED' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M8.5 8h7" />
      <path d="M12 4v1" />
      <path d="M7 20c0-3 2-5 5-5s5 2 5 5" />
      <path d="M9 17l1.5 1.5M15 17l-1.5 1.5" />
    </svg>
  );
}

export function PostnatalIcon({ size = 28, color = '#DB2777' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="10" cy="8" r="3" />
      <path d="M6 20c0-2.5 1.8-4 4-4" />
      <circle cx="16" cy="12" r="2" />
      <path d="M14 18c0-1.5 1-2.5 2-2.5s2 1 2 2.5" />
      <path d="M12 12l2-1" />
    </svg>
  );
}

// Map service ID to icon component
export const SERVICE_ICONS = {
  'part-time': CleaningIcon,
  'full-time': LiveInIcon,
  'elderly-care': ElderCareIcon,
  'cook': CookIcon,
  'nanny': NannyIcon,
  'postnatal': PostnatalIcon,
};

// Map service ID to background color
export const SERVICE_COLORS = {
  'part-time': '#E8F5F6',
  'full-time': '#FFF3E0',
  'elderly-care': '#FDE8E8',
  'cook': '#E8F5E9',
  'nanny': '#EDE7F6',
  'postnatal': '#FCE4EC',
};
