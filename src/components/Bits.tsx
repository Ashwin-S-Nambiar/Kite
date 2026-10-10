import {
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { clock, code, type Point } from '../lib/course.ts';
import { type Summary, summary } from '../lib/wiki.ts';
import Icon, { Flag } from './Icon.tsx';

export function useMedia(query: string) {
  const [on, setOn] = useState(() => matchMedia(query).matches);
  useEffect(() => {
    const m = matchMedia(query);
    const fn = () => setOn(m.matches);
    fn();
    m.addEventListener('change', fn);
    return () => m.removeEventListener('change', fn);
  }, [query]);
  return on;
}

export function Glyph({
  kind,
  n,
  hot,
}: {
  kind: 'start' | 'cp' | 'finish';
  n?: number;
  hot?: boolean;
}) {
  const w = hot ? 3 : 2.4;
  return (
    <svg
      width="36"
      height="32"
      viewBox="0 0 44 40"
      aria-hidden="true"
      className="flex-none"
    >
      {kind === 'start' && (
        <path
          d="M8 34 L 22 8 L 36 34 Z"
          fill="#fcfcf8"
          stroke="#ef6420"
          strokeWidth={w}
        />
      )}
      {kind === 'cp' && (
        <>
          <circle
            cx="22"
            cy="20"
            r="15"
            fill="#fcfcf8"
            stroke="#ef6420"
            strokeWidth={w}
          />
          <text
            x="22"
            y="25"
            textAnchor="middle"
            fontFamily="Familjen Grotesk, sans-serif"
            fontWeight="600"
            fontSize="14"
            fill="#161616"
          >
            {n}
          </text>
        </>
      )}
      {kind === 'finish' && (
        <>
          <circle
            cx="22"
            cy="20"
            r="17"
            fill="#fcfcf8"
            stroke="#ef6420"
            strokeWidth={w}
          />
          <circle
            cx="22"
            cy="20"
            r="10"
            fill="none"
            stroke="#ef6420"
            strokeWidth={w}
          />
        </>
      )}
    </svg>
  );
}

export function CourseRows({
  points,
  active,
  times,
  live,
  compact = false,
}: {
  points: Point[];
  active: number;
  times: (number | null)[];
  live: number | null;
  compact?: boolean;
}) {
  return (
    <ol className="flex flex-col">
      {points.map((p, i) => {
        const last = i === points.length - 1;
        const hot = i === active;
        const t = times[i];
        return (
          <li
            key={p.key}
            className={`grid grid-cols-[28px_1fr_34px_56px] items-center gap-2 border-rule border-b last:border-b-0 ${compact ? 'min-h-10' : 'min-h-11'} ${hot ? 'relative isolate before:absolute before:inset-y-0 before:-inset-x-3 before:-z-10 before:bg-kite-wash' : ''}`}
          >
            <span
              className={`text-[14px] font-semibold ${hot ? 'text-kite-text' : ''}`}
            >
              {i === 0 ? '▲' : last ? '◎' : i}
              <span className="sr-only">
                {i === 0 ? 'Start' : last ? 'Finish' : `Checkpoint ${i}`}
              </span>
            </span>
            <span
              className={`truncate text-[15px] ${hot || i === 0 ? 'font-semibold' : ''}`}
            >
              {p.title}
            </span>
            <span className="stencil text-[13px] text-kite-text">
              {i > 0 && !last ? code(p.key) : ''}
            </span>
            <span className="num text-left text-[13px] text-pencil">
              {i === 0
                ? 'start'
                : t != null
                  ? clock(t)
                  : hot && live != null
                    ? `${clock(live)}…`
                    : last
                      ? 'finish'
                      : ''}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function NextBar({
  label,
  title,
  codeKey,
  children,
  big = false,
}: {
  label: string;
  title: string;
  codeKey: string | null;
  children?: ReactNode;
  big?: boolean;
}) {
  return (
    <div className="reader-toolbar flex flex-none items-center gap-3 border-rule border-b px-4 py-2 tab:px-6">
      <Flag size={big ? 36 : 28} />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="label">{label}</span>
        <span
          className={`truncate font-semibold leading-tight ${big ? 'text-[22px]' : 'text-[18px]'}`}
        >
          {title}
        </span>
      </div>
      {codeKey && (
        <span
          className={`stencil inline-block text-left text-kite-text ${big ? 'w-[1.7em] text-[30px]' : 'w-[1.7em] text-[24px]'}`}
        >
          {code(codeKey)}
        </span>
      )}
      {children}
    </div>
  );
}

export function usePeek(key: string | null) {
  const [s, setS] = useState<{
    key: string;
    data: Summary | null;
    failed: boolean;
  } | null>(null);
  useEffect(() => {
    if (!key) return;
    let live = true;
    setS({ key, data: null, failed: false });
    summary(key)
      .then((d) => live && setS({ key, data: d, failed: false }))
      .catch(() => live && setS({ key, data: null, failed: true }));
    return () => {
      live = false;
    };
  }, [key]);
  return s?.key === key ? s : null;
}

export function PeekText({
  title,
  peek,
}: {
  title: string;
  peek: ReturnType<typeof usePeek>;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="label">Link preview</span>
      <span className="font-semibold text-[26px] leading-[1.08]">
        {peek?.data?.title ?? title}
      </span>
      <p className="m-0 line-clamp-5 min-h-[4.5em] text-[16px] text-[#2c2a27] leading-normal">
        {peek?.data ? (
          peek.data.extract || 'No summary for this one.'
        ) : peek?.failed ? (
          "Couldn't load a preview. You can still go there."
        ) : (
          <span className="skeleton block" aria-hidden="true">
            <span style={{ width: '96%' }} />
            <span style={{ width: '88%' }} />
            <span style={{ width: '60%' }} />
          </span>
        )}
      </p>
    </div>
  );
}

export function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'kite';
}) {
  return (
    <div className="flex flex-col gap-0.5 border-rule border-r px-3 py-2.5 last:border-r-0">
      <span className="label">{label}</span>
      <span
        className={`num font-semibold text-[22px] leading-tight ${tone === 'kite' ? 'text-kite-text' : ''}`}
      >
        {value}
      </span>
    </div>
  );
}

export function IconButton({
  icon,
  label,
  onClick,
  tip,
  keyHint,
  disabled,
  bordered = true,
}: {
  icon: Parameters<typeof Icon>[0]['name'];
  label: string;
  onClick: () => void;
  tip?: string;
  keyHint?: string;
  disabled?: boolean;
  bordered?: boolean;
}) {
  return (
    <button
      type="button"
      className={`press control flex h-11 w-11 flex-none items-center justify-center ${bordered ? 'border-[1.5px] border-ink bg-paper disabled:border-rule disabled:text-pencil' : ''}`}
      aria-label={label}
      data-tip={tip ?? label}
      data-key={keyHint}
      onClick={onClick}
      disabled={disabled}
    >
      <Icon name={icon} size={20} />
    </button>
  );
}

export function Credit({ title }: { title: string }) {
  return (
    <p className="m-0 text-[12px] text-pencil">
      Text from the Wikipedia article “{title}”,{' '}
      <a
        className="underline decoration-rule underline-offset-2"
        href="https://creativecommons.org/licenses/by-sa/4.0/"
        target="_blank"
        rel="noopener noreferrer"
      >
        CC BY-SA 4.0
      </a>
      , restyled.
    </p>
  );
}

export function useDock() {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const root = document.documentElement.style;
    const set = () => root.setProperty('--drawer', `${el.offsetHeight}px`);
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => {
      ro.disconnect();
      root.removeProperty('--drawer');
    };
  }, []);
  return ref;
}
