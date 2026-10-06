import { code, pins } from '../lib/course.ts';

export type Box = {
  label: string;
  key: string;
  state: 'punched' | 'next' | 'open';
  showCode?: boolean;
  fresh?: boolean;
};

const SPOTS = [
  [30, 32],
  [50, 32],
  [70, 32],
  [30, 52],
  [50, 52],
  [70, 52],
  [30, 72],
  [50, 72],
  [70, 72],
];

export function Pins({ seed, dot = 5 }: { seed: string; dot?: number }) {
  return (
    <>
      {pins(seed).map((p) => {
        const [x, y] = SPOTS[p] ?? [50, 50];
        return (
          <span
            key={p}
            className="absolute rounded-full bg-ink"
            style={{
              left: `calc(${x}% - ${dot / 2}px)`,
              top: `calc(${y}% - ${dot / 2}px)`,
              width: dot,
              height: dot,
            }}
          />
        );
      })}
    </>
  );
}

export default function PunchCard({
  boxes,
  height = 58,
  dot = 5,
  label,
}: {
  boxes: Box[];
  height?: number;
  dot?: number;
  label?: string;
}) {
  return (
    <ol
      className="grid gap-1.5"
      style={{ gridTemplateColumns: `repeat(${boxes.length}, minmax(0, 1fr))` }}
      aria-label={label ?? 'Your card'}
    >
      {boxes.map((b) => (
        <li
          key={`${b.label}-${b.key}`}
          className={`relative border-ink bg-white ${b.state === 'next' ? 'border-[2.5px] border-kite bg-kite-wash' : 'border-[1.5px]'} ${b.fresh ? 'punch-in' : ''}`}
          style={{ height }}
          aria-label={`${b.label === 'S' ? 'Start' : b.label === 'F' ? 'Finish' : `Checkpoint ${b.label}`}, ${b.state === 'punched' ? 'punched' : b.state === 'next' ? 'next' : 'not yet'}`}
        >
          <span
            className={`absolute top-0.5 left-1 text-[11px] font-semibold leading-none ${b.state === 'next' ? 'text-kite-text' : ''}`}
            aria-hidden="true"
          >
            {b.label}
          </span>
          {b.showCode && b.label !== 'S' && b.label !== 'F' && (
            <span
              className="stencil absolute right-1 bottom-0.5 text-[12px] text-kite-text"
              aria-hidden="true"
            >
              {code(b.key)}
            </span>
          )}
          {b.state === 'punched' && <Pins seed={b.key} dot={dot} />}
        </li>
      ))}
    </ol>
  );
}
