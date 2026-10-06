const PATHS = {
  find: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </>
  ),
  back: <path d="M10 6 4 12l6 6M4 12h16" />,
  next: <path d="M5 12h14M13 6l6 6-6 6" />,
  chevron: <path d="M9 6l6 6-6 6" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  map: (
    <>
      <path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z" />
      <path d="M9 4v14M15 6v14" />
    </>
  ),
  card: (
    <>
      <path d="M4 4h16v16H4z" />
      <circle cx="9" cy="9" r="1" />
      <circle cx="15" cy="9" r="1" />
      <circle cx="12" cy="14" r="1" />
    </>
  ),
  share: <path d="M12 3v12M7 8l5-5 5 5M5 14v6h14v-6" />,
  sound: (
    <>
      <path d="M4 9h4l5-4v14l-5-4H4z" />
      <path d="M17 9c1.5 1.5 1.5 4.5 0 6" />
    </>
  ),
  mute: (
    <>
      <path d="M4 9h4l5-4v14l-5-4H4z" />
      <path d="M17 10l4 4M21 10l-4 4" />
    </>
  ),
  timer: (
    <>
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l3 2M9 2h6" />
    </>
  ),
  friends: (
    <>
      <circle cx="8" cy="9" r="3" />
      <circle cx="17" cy="9" r="3" />
      <path d="M3 20c0-3 2-5 5-5s5 2 5 5M12 20c0-3 2-5 5-5s4 2 4 5" />
    </>
  ),
  expand: <path d="M4 10V4h6M20 14v6h-6M4 4l6 6M20 20l-6-6" />,
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6M12 7.5v.5" />
    </>
  ),
  copy: (
    <>
      <path d="M9 9h11v11H9z" />
      <path d="M5 15H4V4h11v1" />
    </>
  ),
} as const;

export type IconName = keyof typeof PATHS;

export default function Icon({
  name,
  size = 20,
  className,
}: {
  name: IconName;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="square"
      aria-hidden="true"
      className={className}
    >
      {PATHS[name]}
    </svg>
  );
}

export function Flag({
  size = 28,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 70 70"
      aria-hidden="true"
      className={className}
    >
      <path d="M2 2h66v66H2z" fill="#fff" />
      <path d="M68 2v66H2z" fill="#ef6420" />
      <path
        d="M2 2h66v66H2z"
        fill="none"
        stroke="#161616"
        strokeWidth={size < 30 ? 5 : 3}
      />
    </svg>
  );
}

export function Wordmark({
  className = 'text-[26px]',
}: {
  className?: string;
}) {
  return (
    <span className={`flex items-center gap-2.5 ${className}`}>
      <Flag size={26} />
      <span className="stencil leading-none">KITE</span>
    </span>
  );
}
