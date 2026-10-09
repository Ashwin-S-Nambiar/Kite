import { useEffect, useRef } from 'react';
import { Glyph, useDock, useMedia, usePeek } from '../components/Bits.tsx';
import CourseMap from '../components/CourseMap.tsx';
import Icon from '../components/Icon.tsx';
import ScrollArea from '../components/ScrollArea.tsx';
import {
  clicks,
  clock,
  code,
  daily,
  dayKey,
  type Point,
} from '../lib/course.ts';
import { navigate, param } from '../lib/route.ts';
import {
  decodeRival,
  discard,
  type Plan,
  useResults,
  useRun,
} from '../lib/run.ts';
import { article } from '../lib/wiki.ts';
import { Rules } from './About.tsx';

function Row({
  p,
  i,
  n,
  kind,
}: {
  p: Point;
  i: number;
  n: number;
  kind: Plan['kind'];
}) {
  const s = usePeek(p.key);
  const last = kind === 'course' && i === n - 1;
  const g = i === 0 ? 'start' : last ? 'finish' : 'cp';
  const line = s?.data?.extract.split(/(?<=\.)\s/)[0] ?? '';
  return (
    <li className="grid grid-cols-[36px_minmax(0,1fr)_auto] items-start gap-3 py-2.5">
      <span className="relative z-10 bg-paper pt-0.5">
        <Glyph kind={g} n={i} />
      </span>
      <div className="min-w-0">
        <span className="label">
          {i === 0 ? 'Start' : last ? 'Finish' : `Checkpoint ${i}`}
        </span>
        <div className="font-semibold text-[19px] leading-tight">{p.title}</div>
        <div className="mt-0.5 line-clamp-2 min-h-[2.8em] text-[14px] text-pencil leading-snug">
          {line}
        </div>
      </div>
      <span className="stencil pt-0.5 text-[18px] text-kite-text">
        {g === 'cp' ? code(p.key) : ''}
      </span>
    </li>
  );
}

export default function Brief({ plan: p }: { plan: Plan }) {
  const results = useResults();
  const run = useRun(p.id);
  const result = results[p.id] ?? null;
  const rival = decodeRival(param('vs'));
  const isDaily = p.kind === 'course' && daily(dayKey()).id === p.id;
  const wide = useMedia(
    '(min-width: 900px), (orientation: landscape) and (max-height: 520px)',
  );
  const dock = useDock();
  const rulesHeading = useRef<HTMLHeadingElement>(null);
  const first = p.points[0];
  const last = p.points[p.points.length - 1];
  const name =
    p.kind === 'timed' ? 'Timed run' : `${first?.title} to ${last?.title}`;

  useEffect(() => {
    document.title = `${name} · Kite`;
  }, [name]);

  useEffect(() => {
    if (first) article(first.key).catch(() => {});
  }, [first]);

  const go = () => navigate(`/c/${p.id}/run`);
  const again = () => {
    discard(p.id);
    navigate(`/c/${p.id}/run`);
  };

  const meta =
    p.kind === 'timed'
      ? '5 checkpoints in any order · 10 minutes'
      : `${p.course?.legs.length ?? 3} legs · shortest route ${p.course?.shortest} clicks`;

  const list = (
    <div className="relative">
      <div
        className="absolute top-8 bottom-8 left-4.25 w-[2.5px] bg-kite"
        style={{ display: p.kind === 'course' ? 'block' : 'none' }}
        aria-hidden="true"
      />
      <ol className="m-0 list-none p-0">
        {p.points.map((pt, i) => (
          <Row key={pt.key} p={pt} i={i} n={p.points.length} kind={p.kind} />
        ))}
      </ol>
    </div>
  );

  const actions = (
    <div className="flex flex-col gap-2">
      {result && !run ? (
        <>
          <button
            type="button"
            className="btn btn-kite press w-full"
            onClick={() => navigate(`/c/${p.id}/card`)}
          >
            See your card
          </button>
          <button
            type="button"
            className="btn press min-h-12 w-full"
            onClick={again}
          >
            Run it again
          </button>
          <span className="text-center text-[12px] text-pencil">
            {result.day
              ? 'Your first finish stays on today’s card.'
              : 'A new run replaces this card.'}
          </span>
        </>
      ) : run && !run.done ? (
        <>
          <button
            type="button"
            className="btn btn-kite press w-full"
            onClick={go}
          >
            Carry on · {clicks(run.clicks)}, {clock(run.elapsed)}
          </button>
          <button
            type="button"
            className="btn press min-h-12 w-full"
            onClick={again}
          >
            Start over
          </button>
        </>
      ) : (
        <>
          <button
            type="button"
            className="btn btn-kite press w-full"
            onClick={go}
          >
            Start the clock
          </button>
          <span className="text-center text-[12px] text-pencil">
            The clock starts once {first?.title} has loaded.
          </span>
        </>
      )}
    </div>
  );

  const top = (
    <>
      <div className="-ml-2.5 flex items-center gap-1">
        <button
          type="button"
          className="press flex h-11 w-11 items-center justify-center"
          aria-label="Back to home"
          onClick={() =>
            history.length > 1 && history.state === null
              ? history.back()
              : navigate('/')
          }
        >
          <Icon name="back" size={22} />
        </button>
        <span className="font-semibold text-[17px]">
          {isDaily
            ? 'Today’s course'
            : p.kind === 'timed'
              ? 'Timed run'
              : 'Course'}
        </span>
      </div>
      <div className="flex flex-col gap-1">
        <h1 className="m-0 font-semibold text-[30px] leading-[1.05] desk:text-[40px]">
          {name}
        </h1>
        <span className="text-[14px] text-pencil">{meta}</span>
      </div>
      {rival && p.kind === 'course' && (
        <div className="border-[1.5px] border-ink bg-kite-wash p-3 text-[15px]">
          <span className="label block text-kite-text">
            A friend sent you this course
          </span>
          They finished in{' '}
          <b className="num font-semibold">
            {clicks(rival.c.reduce((a, b) => a + b, 0))}
          </b>
          ,{' '}
          <b className="num font-semibold">
            {clock(rival.t.reduce((a, b) => a + b, 0))}
          </b>
          . Beat it.
        </div>
      )}
    </>
  );

  const rules = (
    <div className="flex flex-col gap-2.5 border-[1.5px] border-ink bg-white p-3.5">
      <h2
        ref={rulesHeading}
        tabIndex={-1}
        className="m-0 font-semibold text-[15px]"
      >
        How it works
      </h2>
      {p.kind === 'timed' ? (
        <ol className="m-0 flex list-none flex-col gap-2.5 p-0 text-[15px] text-[#2c2a27] leading-snug">
          <li className="grid grid-cols-[22px_minmax(0,1fr)] gap-2.5">
            <b className="num font-semibold text-ink">1</b>Move only by tapping
            links inside the article. No search.
          </li>
          <li className="grid grid-cols-[22px_minmax(0,1fr)] gap-2.5">
            <b className="num font-semibold text-ink">2</b>Reach as many
            checkpoints as you can, in any order.
          </li>
          <li className="grid grid-cols-[22px_minmax(0,1fr)] gap-2.5">
            <b className="num font-semibold text-ink">3</b>Ten minutes on the
            clock. Going back counts as a click.
          </li>
        </ol>
      ) : (
        <Rules />
      )}
    </div>
  );

  if (wide)
    return (
      <main className="grid h-dvh grid-rows-[minmax(0,1fr)] grid-cols-[minmax(0,1.2fr)_minmax(440px,560px)] overflow-hidden land:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="relative border-ink border-r-[1.5px]">
          <CourseMap
            seed={p.id}
            kind={p.kind}
            count={p.points.length}
            active={-1}
            punched={[0]}
            legs={[]}
            current={0}
            className="absolute inset-0"
            pad={60}
          />
        </div>
        <div className="flex min-h-0 min-w-0 flex-col">
          <ScrollArea
            cue="How it works"
            target={rulesHeading}
            className="flex flex-col gap-5 px-10 pt-[calc(24px+var(--sat))] pb-6 land:gap-4 land:px-5 land:pt-3 land:pb-3"
          >
            {top}
            <div className="border-ink border-t-[1.5px]">{list}</div>
            {rules}
          </ScrollArea>
          <div
            ref={dock}
            className="flex-none border-rule border-t px-10 pt-3 pb-[calc(20px+var(--sab))] land:px-5 land:pt-2 land:pb-[calc(8px+var(--sab))]"
          >
            {actions}
          </div>
        </div>
      </main>
    );

  return (
    <main className="flex h-dvh flex-col overflow-hidden pr-(--sar) pl-(--sal)">
      <ScrollArea
        cue="How it works"
        target={rulesHeading}
        className="flex flex-col gap-3 px-4 pt-[calc(6px+var(--sat))] pb-4 tab:mx-auto tab:w-full tab:max-w-140 tab:pt-10"
      >
        {top}
        <div className="border-ink border-t-[1.5px]">{list}</div>
        {rules}
      </ScrollArea>
      <div
        ref={dock}
        className="flex-none bg-paper px-4 pt-3 pb-[calc(14px+var(--sab))] tab:mx-auto tab:w-full tab:max-w-140 tab:pb-10"
      >
        {actions}
      </div>
    </main>
  );
}
