type IconName =
  | "arrow-right"
  | "balance"
  | "calendar"
  | "chart"
  | "check"
  | "chevron"
  | "clock"
  | "dashboard"
  | "history"
  | "leaf"
  | "lock"
  | "logout"
  | "map"
  | "package"
  | "prices"
  | "school"
  | "shield"
  | "spark"
  | "truck"
  | "users";

const paths: Record<IconName, React.ReactNode> = {
  "arrow-right": <><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></>,
  balance: <><path d="M4 19h16" /><path d="M12 4v15" /><path d="m5 8 7-4 7 4" /><path d="m3 14 3-6 3 6a3 3 0 0 1-6 0Z" /><path d="m15 14 3-6 3 6a3 3 0 0 1-6 0Z" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 11h18" /></>,
  chart: <><path d="M4 19V5" /><path d="M4 19h16" /><path d="m7 15 4-4 3 2 5-6" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  chevron: <path d="m9 18 6-6-6-6" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  dashboard: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
  history: <><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /><path d="M12 7v5l3 2" /></>,
  leaf: <><path d="M20 4c-7 0-13 3-14 9 0 4 3 7 7 7 6-1 7-8 7-16Z" /><path d="M4 21c3-6 7-9 12-12" /></>,
  lock: <><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
  logout: <><path d="M10 17l5-5-5-5" /><path d="M15 12H3" /><path d="M15 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" /></>,
  map: <><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3Z" /><path d="M9 3v15M15 6v15" /></>,
  package: <><path d="m4 7 8-4 8 4-8 4Z" /><path d="M4 7v10l8 4 8-4V7M12 11v10" /></>,
  prices: <><path d="M20 12V5a2 2 0 0 0-2-2h-7L4 10l10 10 6-6a3 3 0 0 0 0-2Z" /><circle cx="15.5" cy="7.5" r="1" /></>,
  school: <><path d="m3 10 9-6 9 6" /><path d="M5 10v9h14v-9M9 19v-5h6v5" /></>,
  shield: <><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z" /><path d="m9 12 2 2 4-4" /></>,
  spark: <><path d="m12 3 1.7 4.3L18 9l-4.3 1.7L12 15l-1.7-4.3L6 9l4.3-1.7Z" /><path d="m19 15 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8Z" /></>,
  truck: <><path d="M3 6h11v11H3Z" /><path d="M14 10h4l3 3v4h-7Z" /><circle cx="7" cy="18" r="2" /><circle cx="18" cy="18" r="2" /></>,
  users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" /></>,
};

export function Icon({ name, size = 20, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

export type { IconName };
