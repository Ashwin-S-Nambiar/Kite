import { useEffect, useState } from 'react';
import { useDock, useMedia } from '../components/Bits.tsx';
import CourseMap from '../components/CourseMap.tsx';
import Icon, { Wordmark } from '../components/Icon.tsx';
import { Pins } from '../components/PunchCard.tsx';
import Sheet from '../components/Sheet.tsx';
import { useOnline } from '../hooks/useOnline.ts';
import {
  byId,
  clicks,
  clock,
  daily,
  dateLabel,
  dayKey,
  type Level,
  pick,
  shiftDay,
} from '../lib/course.ts';
import { navigate } from '../lib/route.ts';
import { finishedDays, plan, streak, useResults, useRun } from '../lib/run.ts';
import { soundStore } from '../lib/sound.ts';
import { useStore } from '../lib/store.ts';
import About from './About.tsx';

export function Footer() {
  return (
    <p className="m-0 text-center text-[12px] text-pencil">
      A game played on Wikipedia articles, CC BY-SA ·{' '}
      <a
        href="https://ashwin.co.in"
        className="underline decoration-rule underline-offset-2"
      >
        Made by Ashwin
      </a>
    </p>
  );
}

export default function Home() {
  const today = dayKey();
  const course = daily(today);
  const results = useResults();
  const run = useRun(course.id);
  const done = results[course.id]?.day === today ? results[course.id] : null;
  const days = finishedDays(results);
  const n = streak(results, today);
  const sound = useStore(soundStore);
  const [levels, setLevels] = useState(false);
  const [friends, setFriends] = useState(false);
  const [cards, setCards] = useState(false);
  const [about, setAbout] = useState(false);
  const wide = useMedia(
    '(min-width: 900px), (orientation: landscape) and (max-height: 520px)',
  );
  const dock = useDock();
  const online = useOnline();
  const first = course.points[0];
  const last = course.points[course.points.length - 1];

  useEffect(() => {
    document.title = 'Kite · Race through Wikipedia, checkpoint to checkpoint';
  }, []);

  const week = Array.from({ length: 7 }, (_, i) => shiftDay(today, i - 6));
  const primary = done
    ? { text: 'See your card', go: `/c/${course.id}/card` }
    : run && !run.done
      ? { text: 'Carry on with today’s course', go: `/c/${course.id}/run` }
      : { text: 'Start today’s course', go: `/c/${course.id}` };

  const map = (
    <CourseMap
      seed={course.id}
      kind="course"
      count={course.points.length}
      active={-1}
      punched={[0]}
      legs={course.legs.map(() => ({ hops: 0, done: false }))}
      current={0}
      className="absolute inset-0"
      pad={wide ? 56 : 30}
    />
  );

  const todayCard = (
    <div className="flex flex-col gap-1.5 px-3.5 pt-3.5 pb-4">
      <span className="label">Today’s course · {dateLabel(today)}</span>
      <span className="font-semibold text-[26px] leading-[1.1] desk:text-[34px]">
        {first?.title} to {last?.title}
      </span>
      <span className="text-[14px] text-pencil">
        {done
          ? `Finished in ${clicks(done.clicks)}, ${clock(done.time)}. Shortest route: ${course.shortest}.`
          : run && !run.done
            ? `In progress · leg ${run.leg + 1} of ${course.legs.length}, ${clicks(run.clicks)} so far.`
            : `Two checkpoints on the way. Shortest route: ${course.shortest} clicks.`}
      </span>
    </div>
  );

  const weekStrip = (
    <div className="flex flex-col gap-2 short:hidden">
      <div className="flex items-baseline justify-between">
        <span className="label">This week</span>
        <span className="font-semibold text-[13px]">
          {n > 0
            ? `${n} day${n === 1 ? '' : 's'} in a row`
            : 'Finish today’s to start a streak'}
        </span>
      </div>
      <ol
        className="m-0 grid list-none grid-cols-7 gap-1.5 p-0"
        aria-label="Daily courses this week"
      >
        {week.map((d) => {
          const got = days.has(d);
          const isToday = d === today;
          const letter = new Date(`${d}T12:00:00`).toLocaleDateString('en-GB', {
            weekday: 'narrow',
          });
          return (
            <li
              key={d}
              className={`relative flex h-10 items-end justify-center pb-0.5 font-semibold text-[10px] ${isToday && !got ? 'border-[2.5px] border-kite bg-kite-wash text-kite-text' : 'border-[1.5px] border-ink bg-white text-pencil'}`}
              aria-label={`${dateLabel(d)}${got ? ', finished' : isToday ? ', today' : ''}`}
            >
              {got && <Pins seed={d} dot={3.5} />}
              <span aria-hidden="true">{letter}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );

  const modes = (
    <nav className="flex flex-col" aria-label="Other ways to play">
      <span className="label mb-0.5">Other ways to play</span>
      {[
        {
          icon: 'timer' as const,
          title: 'Timed run',
          d: '10 minutes, 5 checkpoints, any order',
          on: () => navigate('/timed'),
        },
        {
          icon: 'map' as const,
          title: 'New course',
          d: 'easy, medium or hard, as often as you like',
          on: () => setLevels(true),
        },
        {
          icon: 'friends' as const,
          title: 'Race a friend',
          d: 'send a course, they race your route',
          on: () => setFriends(true),
        },
      ].map((m, i) => (
        <button
          key={m.title}
          type="button"
          onClick={m.on}
          className={`press group grid min-h-14 grid-cols-[32px_1fr_20px] items-center gap-3 text-left ${i < 2 ? 'border-rule border-b' : ''}`}
        >
          <Icon name={m.icon} size={24} />
          <span className="flex flex-col py-2">
            <span className="font-semibold text-[16px] leading-tight">
              {m.title}
            </span>
            <span className="text-[13px] text-pencil leading-snug short:hidden">
              {m.d}
            </span>
          </span>
          <Icon
            name="chevron"
            size={18}
            className="transition-transform duration-150 group-hover:translate-x-0.5"
          />
        </button>
      ))}
    </nav>
  );

  const header = (
    <header className="flex items-center justify-between">
      <h1 className="m-0">
        <Wordmark />
        <span className="sr-only">Kite</span>
      </h1>
      <div className="flex items-center">
        {!online && (
          <span
            className="mr-1 border border-ink px-2 py-0.5 font-medium text-[12px]"
            role="status"
          >
            Offline
          </span>
        )}
        <button
          type="button"
          className="press flex h-11 w-11 items-center justify-center"
          aria-label="Your cards"
          data-tip="Your cards"
          onClick={() => setCards(true)}
        >
          <Icon name="card" size={22} />
        </button>
        <button
          type="button"
          className="press flex h-11 w-11 items-center justify-center"
          aria-label="How it works"
          data-tip="How it works"
          onClick={() => setAbout(true)}
        >
          <Icon name="info" size={22} />
        </button>
        <button
          type="button"
          className="press flex h-11 w-11 items-center justify-center"
          aria-label={sound ? 'Mute' : 'Sound on'}
          data-tip={sound ? 'Mute' : 'Sound on'}
          onClick={() => soundStore.set((v) => !v)}
        >
          <Icon name={sound ? 'sound' : 'mute'} size={22} />
        </button>
      </div>
    </header>
  );

  const cta = (
    <a
      href={primary.go}
      className="btn btn-kite press w-full"
      onClick={(e) => {
        e.preventDefault();
        navigate(primary.go);
      }}
    >
      {primary.text}
      <Icon name="next" size={18} />
    </a>
  );

  return (
    <>
      {wide ? (
        <main className="grid h-dvh grid-rows-[minmax(0,1fr)] grid-cols-[minmax(0,1.25fr)_minmax(420px,520px)] overflow-hidden land:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="relative border-ink border-r-[1.5px]">{map}</div>
          <div className="flex min-h-0 flex-col">
            <div className="scroller flex min-h-0 flex-1 flex-col gap-6 px-10 pt-[calc(28px+var(--sat))] pb-6 land:gap-4 land:px-5 land:pt-3 land:pb-3">
              {header}
              <div className="border-[1.5px] border-ink bg-white">
                {todayCard}
              </div>
              {weekStrip}
              {modes}
            </div>
            <div
              ref={dock}
              className="flex-none border-rule border-t px-10 pt-3 pb-[calc(20px+var(--sab))] land:px-5 land:pt-2 land:pb-[calc(8px+var(--sab))] flex flex-col gap-2.5"
            >
              {cta}
              <Footer />
            </div>
          </div>
        </main>
      ) : (
        <main className="flex h-dvh flex-col overflow-hidden pr-(--sar) pl-(--sal)">
          <div className="scroller flex min-h-0 flex-1 flex-col gap-4 px-4 pt-[calc(6px+var(--sat))] tab:mx-auto tab:w-full tab:max-w-140 tab:gap-6 tab:pt-10">
            <div className="-mr-2">{header}</div>
            <div className="border-[1.5px] border-ink bg-white">
              <div className="relative h-[clamp(110px,22dvh,200px)] border-ink border-b-[1.5px]">
                {map}
              </div>
              {todayCard}
            </div>
            {weekStrip}
            {modes}
          </div>
          <div
            ref={dock}
            className="flex flex-none flex-col gap-2.5 border-rule border-t bg-paper px-4 pt-3 pb-[calc(14px+var(--sab))] tab:mx-auto tab:w-full tab:max-w-140 tab:border-0 tab:pb-10"
          >
            {cta}
            <Footer />
          </div>
        </main>
      )}

      <Sheet open={levels} onClose={() => setLevels(false)} label="New course">
        <h2 className="m-0 mb-1 font-semibold text-[24px]">New course</h2>
        <p className="m-0 mb-4 text-[15px] text-pencil">
          Pick how far apart the checkpoints sit.
        </p>
        <div className="flex flex-col gap-2">
          {(
            [
              ['easy', 'Easy', 'shortest route 6 clicks'],
              ['medium', 'Medium', 'shortest route 7 clicks'],
              ['hard', 'Hard', 'shortest route 8 or more'],
            ] as [Level, string, string][]
          ).map(([l, t, d]) => (
            <button
              key={l}
              type="button"
              className="btn press min-h-14 justify-between px-4 text-left"
              onClick={() => {
                setLevels(false);
                const c = pick(l, [course.id]);
                if (c) setTimeout(() => navigate(`/c/${c.id}`), 60);
              }}
            >
              <span className="flex flex-col items-start gap-1">
                <span className="text-[17px]">{t}</span>
                <span className="font-normal text-[13px] text-pencil">{d}</span>
              </span>
              <Icon name="chevron" size={18} />
            </button>
          ))}
        </div>
      </Sheet>

      <Sheet
        open={friends}
        onClose={() => setFriends(false)}
        label="Race a friend"
        footer={
          <button
            type="button"
            className="btn btn-kite press w-full"
            onClick={() => {
              setFriends(false);
              setTimeout(() => navigate(primary.go), 60);
            }}
          >
            {primary.text}
          </button>
        }
      >
        <h2 className="m-0 mb-2 font-semibold text-[24px]">Race a friend</h2>
        <p className="m-0 text-[16px] text-[#2c2a27] leading-normal">
          Finish any course, then tap Race a friend on your card. They get the
          same course, with your clicks and leg times to beat.
        </p>
      </Sheet>

      <Sheet open={cards} onClose={() => setCards(false)} label="Your cards">
        <h2 className="m-0 mb-3 font-semibold text-[24px]">Your cards</h2>
        <CardList
          onOpen={(id) => {
            setCards(false);
            setTimeout(() => navigate(`/c/${id}/card`), 60);
          }}
        />
      </Sheet>

      <About open={about} onClose={() => setAbout(false)} />
    </>
  );
}

function CardList({ onOpen }: { onOpen: (id: string) => void }) {
  const results = useResults();
  const list = Object.values(results).sort((a, b) => b.at - a.at);
  if (!list.length)
    return (
      <p className="m-0 text-[15px] text-pencil">
        Nothing yet. Your finished cards will collect here.
      </p>
    );
  return (
    <ul className="m-0 flex list-none flex-col p-0">
      {list.map((r) => {
        const p = plan(r.id);
        if (!p) return null;
        const c = r.kind === 'course' ? byId(r.id) : null;
        const name =
          r.kind === 'timed'
            ? 'Timed run'
            : `${p.points[0]?.title} to ${p.points[p.points.length - 1]?.title}`;
        return (
          <li key={r.id} className="border-rule border-b last:border-b-0">
            <button
              type="button"
              className="press flex min-h-14 w-full items-center justify-between gap-3 py-2 text-left"
              onClick={() => onOpen(r.id)}
            >
              <span className="flex min-w-0 flex-col">
                <span className="truncate font-semibold text-[16px]">
                  {name}
                </span>
                <span className="text-[13px] text-pencil">
                  {r.day
                    ? dateLabel(r.day)
                    : new Date(r.at).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                      })}
                  {r.kind === 'timed'
                    ? ` · ${r.punched.length} of 5 checkpoints`
                    : c
                      ? ` · ${clicks(r.clicks)} (${c.shortest})`
                      : ''}
                </span>
              </span>
              <span className="num text-[15px]">{clock(r.time)}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
