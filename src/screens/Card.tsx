import { useEffect, useState } from 'react';
import { useDock, useMedia } from '../components/Bits.tsx';
import CourseMap from '../components/CourseMap.tsx';
import Icon from '../components/Icon.tsx';
import PunchCard, { type Box } from '../components/PunchCard.tsx';
import Sheet from '../components/Sheet.tsx';
import { clicks, clock, dateLabel, newSeed } from '../lib/course.ts';
import { haptic } from '../lib/haptics.ts';
import { navigate, param } from '../lib/route.ts';
import {
  decodeRival,
  discard,
  encodeRival,
  type Plan,
  type Result,
  splitOf,
  timedId,
  useResults,
  useRun,
} from '../lib/run.ts';
import { announce } from '../lib/toast.ts';
import { toTitle } from '../lib/wiki.ts';
import NotFound from './NotFound.tsx';

const ORIGIN = 'https://kite.ashwin.co.in';

async function share(text: string, url: string) {
  const coarse = matchMedia('(pointer: coarse)').matches;
  if (coarse && navigator.share) {
    try {
      await navigator.share({ text: `${text}\n${url}` });
      return;
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
    }
  }
  try {
    await navigator.clipboard.writeText(`${text}\n${url}`);
    haptic.tap();
    announce('Copied. Paste it anywhere.');
  } catch {
    announce('Couldn’t copy. Try again.');
  }
}

function legNote(clicks: number, shortest: number) {
  return clicks <= shortest ? 'spot on' : `+${clicks - shortest}`;
}

export default function Card({ plan: p }: { plan: Plan }) {
  const results = useResults();
  const run = useRun(p.id);
  const res: Result | null = results[p.id] ?? null;
  const [routeOpen, setRouteOpen] = useState(false);
  const wide = useMedia(
    '(min-width: 900px), (orientation: landscape) and (max-height: 520px)',
  );
  const dock = useDock();
  const rival = decodeRival(param('vs'));

  useEffect(() => {
    document.title = 'Your card · Kite';
    if (run?.done) discard(p.id);
  }, [run?.done, p.id]);

  if (!res) return <NotFound />;

  const first = p.points[0];
  const last = p.points[p.points.length - 1];
  const name =
    p.kind === 'timed' ? 'Timed run' : `${first?.title} to ${last?.title}`;
  const shortest = p.course?.shortest ?? 0;

  const boxes: Box[] =
    p.kind === 'timed'
      ? p.points.slice(1).map((pt, i) => ({
          label: String(i + 1),
          key: pt.key,
          state: res.punched.includes(pt.key) ? 'punched' : 'open',
        }))
      : p.points.map((pt, i) => ({
          label: i === 0 ? 'S' : i === p.points.length - 1 ? 'F' : String(i),
          key: pt.key,
          state: 'punched',
          showCode: true,
        }));

  const lines =
    p.kind === 'course'
      ? [
          `Kite${res.day ? ` · ${dateLabel(res.day)}` : ''}`,
          `${name} · ${clicks(res.clicks)} (${shortest}) · ${clock(res.time)}`,
          (p.course?.legs ?? [])
            .map(
              (l, i) =>
                `leg ${i + 1} ${legNote(res.legClicks[i] ?? 0, l.shortest)}`,
            )
            .join(' · '),
        ]
      : [
          'Kite · Timed run',
          `${res.punched.length} of ${p.points.length - 1} checkpoints · ${clicks(res.clicks)} · ${clock(res.time)}`,
        ];
  const text = lines.join('\n');
  const url = `${ORIGIN}/c/${p.id}`;
  const raceUrl = `${url}?vs=${encodeRival(res)}`;

  const legsTable = p.kind === 'course' && (
    <table className="w-full border-collapse text-[14px]">
      <caption className="sr-only">Legs</caption>
      <thead>
        <tr className="border-rule border-b">
          {['Leg', 'To', 'Clicks', 'Shortest', 'Time'].map((h, i) => (
            <th
              key={h}
              scope="col"
              className={`label py-1.5 font-medium ${i >= 2 ? 'text-right' : 'text-left'}`}
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="num">
        {(p.course?.legs ?? []).map((l, i) => {
          const c = res.legClicks[i] ?? 0;
          return (
            <tr
              key={p.points[i + 1]?.key ?? i}
              className="h-10 border-rule border-b last:border-b-0"
            >
              <td>{i + 1}</td>
              <td className="font-medium">{p.points[i + 1]?.title}</td>
              <td
                className={`text-right ${c <= l.shortest ? 'font-semibold text-kite-text' : ''}`}
              >
                {c}
              </td>
              <td className="text-right text-pencil">{l.shortest}</td>
              <td className="text-right">{clock(splitOf(res, i))}</td>
            </tr>
          );
        })}
        {rival && (
          <tr className="h-10 bg-kite-wash">
            <td colSpan={2} className="pl-1 font-medium">
              Your friend
            </td>
            <td className="text-right">{rival.c.reduce((a, b) => a + b, 0)}</td>
            <td />
            <td className="pr-1 text-right">
              {clock(rival.t.reduce((a, b) => a + b, 0))}
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );

  const timedList = p.kind === 'timed' && (
    <ul className="m-0 list-none p-0 text-[14px]">
      {p.points.slice(1).map((pt) => {
        const at = res.punched.indexOf(pt.key);
        return (
          <li
            key={pt.key}
            className="flex h-10 items-center justify-between border-rule border-b last:border-b-0"
          >
            <span className={at < 0 ? 'text-pencil' : 'font-medium'}>
              {pt.title}
            </span>
            <span className="num text-pencil">
              {at < 0 ? 'not reached' : clock(res.legTimes[at] ?? 0)}
            </span>
          </li>
        );
      })}
    </ul>
  );

  const head = (
    <>
      <div className="-mx-2.5 flex items-center justify-between">
        <button
          type="button"
          className="press flex h-11 w-11 items-center justify-center"
          aria-label="Home"
          onClick={() => navigate('/')}
        >
          <Icon name="close" size={22} />
        </button>
        <span className="font-semibold text-[15px]">
          {res.day
            ? 'Today’s course · finished'
            : p.kind === 'timed'
              ? res.time >= 600000
                ? 'Timed run · time’s up'
                : 'Timed run · finished'
              : 'Course · finished'}
        </span>
        <span className="w-11" />
      </div>
      <div className="flex items-end justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="label truncate">{name}</span>
          <span className="stencil num text-[58px] leading-[0.9] desk:text-[72px]">
            {clock(res.time)}
          </span>
        </div>
        <div className="flex flex-col items-end gap-0.5 pb-1">
          {p.kind === 'course' ? (
            <>
              <span className="num font-semibold text-[24px] leading-none">
                {clicks(res.clicks)}
              </span>
              <span className="text-[13px] text-pencil">
                shortest is {shortest}
              </span>
            </>
          ) : (
            <>
              <span className="num font-semibold text-[24px] leading-none">
                {res.punched.length} of {p.points.length - 1}
              </span>
              <span className="text-[13px] text-pencil">
                {clicks(res.clicks)}
              </span>
            </>
          )}
        </div>
      </div>
    </>
  );

  const body = (
    <>
      <div className="flex flex-col gap-2">
        <span className="label">Your card</span>
        <PunchCard boxes={boxes} height={66} dot={5} />
      </div>
      <div>{legsTable || timedList}</div>
      {p.kind === 'course' && (
        <button
          type="button"
          className="press flex min-h-13 w-full items-center gap-3 border-[1.5px] border-ink bg-white px-3.5 text-left"
          onClick={() => setRouteOpen(true)}
        >
          <Icon name="map" size={22} />
          <span className="flex-1 font-semibold text-[15px]">
            Your route and the shortest, on the map
          </span>
          <Icon name="chevron" size={18} />
        </button>
      )}
      <div className="border border-[#b9b4a8] border-dashed px-3.5 py-3 text-[14px] text-[#2c2a27] leading-normal">
        <span className="label mb-1 block">What sharing pastes</span>
        <span className="num whitespace-pre-line">{text}</span>
      </div>
    </>
  );

  const actions =
    p.kind === 'course' ? (
      <div className="grid grid-cols-[1fr_1.3fr] gap-2.5">
        <button
          type="button"
          className="btn press min-h-13"
          onClick={() =>
            share(
              `Race me on Kite: ${name}. My time: ${clicks(res.clicks)}, ${clock(res.time)}.`,
              raceUrl,
            )
          }
        >
          Race a friend
        </button>
        <button
          type="button"
          className="btn btn-kite press"
          onClick={() => share(text, url)}
        >
          <Icon name="share" size={18} />
          Share result
        </button>
      </div>
    ) : (
      <div className="grid grid-cols-[1fr_1.3fr] gap-2.5">
        <button
          type="button"
          className="btn press min-h-13"
          onClick={() => share(text, url)}
        >
          <Icon name="share" size={18} />
          Share
        </button>
        <button
          type="button"
          className="btn btn-kite press"
          onClick={() => navigate(`/c/${timedId(newSeed())}`)}
        >
          Another timed run
        </button>
      </div>
    );

  const routeSheet = p.kind === 'course' && (
    <Sheet
      open={routeOpen}
      onClose={() => setRouteOpen(false)}
      label="Your route and the shortest"
    >
      <div className="flex flex-col gap-4">
        <h2 className="m-0 font-semibold text-[22px]">
          Your route and the shortest
        </h2>
        <div className="relative aspect-4/3 border-[1.5px] border-ink">
          <CourseMap
            seed={p.id}
            kind="course"
            count={p.points.length}
            active={-1}
            punched={p.points.map((_, i) => i)}
            legs={(p.course?.legs ?? []).map((_, i) => ({
              hops: Math.max(1, (res.routes[i]?.length ?? 2) - 1),
              done: true,
            }))}
            current={0}
            draw
            className="absolute inset-0"
            pad={30}
          />
        </div>
        {(p.course?.legs ?? []).map((l, i) => (
          <section
            key={p.points[i + 1]?.key ?? i}
            className="flex flex-col gap-1.5 border-rule border-b pb-3 last:border-b-0"
          >
            <span className="font-semibold text-[15px]">
              Leg {i + 1} · to {p.points[i + 1]?.title}
            </span>
            <p className="m-0 text-[14px] leading-snug">
              <span className="label mr-1.5">
                Yours, {res.legClicks[i] ?? 0}
              </span>
              {(res.routes[i] ?? []).map(toTitle).join(' → ')}
            </p>
            <p className="m-0 text-[14px] leading-snug">
              <span className="label mr-1.5 text-kite-text">
                Shortest, {l.shortest}
              </span>
              {l.route.map(toTitle).join(' → ')}
            </p>
          </section>
        ))}
        <p className="m-0 text-[12px] text-pencil">
          The shortest route was worked out from the articles as they were when
          this course was made. Articles change, so yours might be shorter.
        </p>
      </div>
    </Sheet>
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
            punched={
              p.kind === 'course'
                ? p.points.map((_, i) => i)
                : [
                    0,
                    ...res.punched.map((k) =>
                      p.points.findIndex((pt) => pt.key === k),
                    ),
                  ]
            }
            legs={
              p.kind === 'course'
                ? (p.course?.legs ?? []).map((_, i) => ({
                    hops: Math.max(1, (res.routes[i]?.length ?? 2) - 1),
                    done: true,
                  }))
                : []
            }
            current={0}
            draw
            className="absolute inset-0"
            pad={60}
          />
        </div>
        <div className="flex min-h-0 flex-col">
          <div className="scroller flex min-h-0 flex-1 flex-col gap-5 px-10 pt-[calc(20px+var(--sat))] pb-6 land:gap-4 land:px-5 land:pt-3 land:pb-3">
            {head}
            {body}
          </div>
          <div
            ref={dock}
            className="flex-none border-rule border-t px-10 pt-3 pb-[calc(20px+var(--sab))] land:px-5 land:pt-2 land:pb-[calc(8px+var(--sab))]"
          >
            {actions}
          </div>
        </div>
        {routeSheet}
      </main>
    );

  return (
    <main className="flex h-dvh flex-col overflow-hidden pr-(--sar) pl-(--sal)">
      <div className="scroller flex min-h-0 flex-1 flex-col gap-4 px-4 pt-[calc(6px+var(--sat))] pb-4 tab:mx-auto tab:w-full tab:max-w-140 tab:pt-10">
        {head}
        {body}
      </div>
      <div
        ref={dock}
        className="flex-none px-4 pt-3 pb-[calc(14px+var(--sab))] tab:mx-auto tab:w-full tab:max-w-140 tab:pb-10"
      >
        {actions}
      </div>
      {routeSheet}
    </main>
  );
}
