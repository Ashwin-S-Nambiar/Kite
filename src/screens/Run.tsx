import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import {
  CourseRows,
  Credit,
  IconButton,
  NextBar,
  PeekText,
  Stat,
  useMedia,
  usePeek,
} from '../components/Bits.tsx';
import CourseMap, { type MapLeg } from '../components/CourseMap.tsx';
import Drawer from '../components/Drawer.tsx';
import Icon, { Flag, Wordmark } from '../components/Icon.tsx';
import PunchCard, { type Box } from '../components/PunchCard.tsx';
import Reader, { type LinkRef } from '../components/Reader.tsx';
import Sheet from '../components/Sheet.tsx';
import { useArticle, useDelayed } from '../hooks/useArticle.ts';
import { clicks, clock, code, spoken } from '../lib/course.ts';
import { haptic } from '../lib/haptics.ts';
import { navigate } from '../lib/route.ts';
import {
  arrive,
  back,
  canBack,
  elapsed,
  go,
  hold,
  type Plan,
  type Run as RunState,
  resume,
  splitOf,
  start,
  TIMED_LIMIT,
  timeUp,
  unpause,
  useRun,
} from '../lib/run.ts';
import { sfx, soundStore } from '../lib/sound.ts';
import { useStore } from '../lib/store.ts';
import { announce } from '../lib/toast.ts';
import { type Article, toTitle } from '../lib/wiki.ts';

function useNow(running: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [running]);
  return now;
}

function boxes(p: Plan, r: RunState, fresh: string | null): Box[] {
  if (p.kind === 'timed')
    return p.points.slice(1).map((pt, i) => ({
      label: String(i + 1),
      key: pt.key,
      state: r.punched.includes(pt.key) ? 'punched' : 'open',
      fresh: fresh === pt.key,
    }));
  return p.points.map((pt, i) => {
    const last = i === p.points.length - 1;
    const label = i === 0 ? 'S' : last ? 'F' : String(i);
    const got = i === 0 || i <= r.punched.length;
    return {
      label,
      key: pt.key,
      state: got ? 'punched' : i === r.leg + 1 ? 'next' : 'open',
      fresh: fresh === pt.key,
    };
  });
}

function mapProps(p: Plan, r: RunState) {
  if (p.kind === 'timed') {
    const punched = [
      0,
      ...r.punched.map((k) => p.points.findIndex((pt) => pt.key === k)),
    ];
    return {
      kind: 'timed' as const,
      count: p.points.length,
      active: -1,
      punched,
      legs: [{ hops: r.stack.length - 1, done: false }],
      current: 0,
    };
  }
  const legs: MapLeg[] = (p.course?.legs ?? []).map((_, i) => {
    if (i < r.punched.length)
      return { hops: Math.max(1, (r.routes[i]?.length ?? 2) - 1), done: true };
    if (i === r.leg) return { hops: r.stack.length - 1, done: false };
    return { hops: 0, done: false };
  });
  return {
    kind: 'course' as const,
    count: p.points.length,
    active: r.done ? -1 : r.leg,
    punched: Array.from({ length: r.punched.length + 1 }, (_, i) => i),
    legs,
    current: r.leg,
  };
}

export default function RunScreen({ plan: p }: { plan: Plan }) {
  const existing = useRun(p.id);
  useEffect(() => {
    if (!existing) start(p);
  }, [existing, p]);
  if (!existing) return <div className="h-dvh bg-paper" />;
  return <Playing p={p} r={existing} />;
}

function Playing({ p, r }: { p: Plan; r: RunState }) {
  const id = p.id;
  const sound = useStore(soundStore);
  const top = r.stack[r.stack.length - 1] ?? {
    key: p.points[0]?.key ?? '',
    title: '',
  };
  const [attempt, setAttempt] = useState(0);
  const loaded = useArticle(top.key, attempt);
  const [shown, setShown] = useState<Article | null>(null);
  const busy = useDelayed(loaded.status === 'loading' && shown !== null);
  const [peek, setPeek] = useState<LinkRef | null>(null);
  const [hover, setHover] = useState<{
    link: LinkRef;
    x: number;
    y: number;
  } | null>(null);
  const [findOpen, setFindOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const [hits, setHits] = useState(0);
  const [punchOpen, setPunchOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [keysOpen, setKeysOpen] = useState(false);
  const [fresh, setFresh] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const findInput = useRef<HTMLInputElement>(null);
  const arrived = useRef('');
  const running = !r.done && !r.paused && r.since !== null;
  const now = useNow(running);
  const time = elapsed(r, now);
  const phone = useMedia('(max-width: 599px)');
  const land = useMedia('(orientation: landscape) and (max-height: 520px)');
  const desk = useMedia('(min-width: 1200px)');

  const target = p.kind === 'course' ? p.points[r.leg + 1] : null;
  const isLast = p.kind === 'course' && r.leg + 1 === p.points.length - 1;
  const legSplit =
    p.kind === 'course' ? time - (r.legTimes[r.leg - 1] ?? 0) : time;
  const left = TIMED_LIMIT - time;

  useEffect(() => {
    if (loaded.status !== 'ready' || loaded.key !== top.key) return;
    const a = loaded.article;
    setShown(a);
    if (scroller.current) scroller.current.scrollTop = 0;
    const mark = `${r.stack.length}:${a.key}:${r.punched.length}`;
    if (arrived.current === mark) return;
    arrived.current = mark;
    document.title = `${a.title} · Kite`;
    const outcome = arrive(id, p, { key: a.key, title: a.title });
    if (outcome === 'punch') {
      sfx.punch();
      haptic.punch();
      setFresh(a.key);
      if (p.kind === 'course') setPunchOpen(true);
      else {
        const leftN = p.points.length - 1 - ((r.punched.length ?? 0) + 1);
        announce(`Checkpoint punched: ${a.title}. ${leftN} to go.`);
      }
    } else if (outcome === 'finish') {
      sfx.finish();
      haptic.finish();
      setFresh(a.key);
      announce(`Finished at ${a.title}.`, 2800, true);
      setTimeout(() => navigate(`/c/${id}/card`, true), 900);
    } else resume(id);
  }, [loaded, id, p, r.stack.length, r.punched.length, top.key]);

  const ready = useRef(false);
  ready.current = shown !== null;

  useEffect(() => {
    const vis = () => {
      if (document.hidden) hold(id);
      else if (ready.current) resume(id);
    };
    document.addEventListener('visibilitychange', vis);
    return () => {
      document.removeEventListener('visibilitychange', vis);
      hold(id);
    };
  }, [id]);

  useEffect(() => {
    if (p.kind === 'timed' && !r.done && left <= 0) {
      timeUp(id);
      sfx.finish();
      haptic.finish();
      navigate(`/c/${id}/card`, true);
    }
  }, [left, p.kind, r.done, id]);

  useEffect(() => {
    if (r.done && !fresh) navigate(`/c/${id}/card`, true);
  }, [r.done, fresh, id]);

  useEffect(() => {
    if (p.kind !== 'timed' || r.done || !('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    navigator.wakeLock.request('screen').then(
      (l) => {
        lock = l;
      },
      () => {},
    );
    return () => {
      lock?.release().catch(() => {});
    };
  }, [p.kind, r.done]);

  useEffect(() => {
    const off = () => announce('You’re offline. Reconnect to carry on.', 4000);
    addEventListener('offline', off);
    return () => removeEventListener('offline', off);
  }, []);

  const latest = useRef(r);
  latest.current = r;

  const doBack = useCallback(() => {
    if (!canBack(latest.current)) return;
    back(id);
    sfx.step();
    haptic.tap();
    setPeek(null);
    setHover(null);
  }, [id]);

  useEffect(() => {
    if ((history.state as { guard?: string } | null)?.guard !== id)
      history.pushState({ guard: id }, '');
    const onPop = (e: PopStateEvent) => {
      if ((e.state as { guard?: string } | null)?.guard === id) return;
      if (location.pathname !== `/c/${id}/run`) return;
      history.pushState({ guard: id }, '');
      if (canBack(latest.current)) doBack();
      else if (!latest.current.done) setLeaveOpen(true);
    };
    addEventListener('popstate', onPop);
    return () => removeEventListener('popstate', onPop);
  }, [id, doBack]);

  const follow = useCallback(
    (l: LinkRef) => {
      const cur = latest.current;
      if (cur.done || cur.paused) return;
      go(id, { key: l.key, title: toTitle(l.key) });
      sfx.step();
      haptic.tap();
      setPeek(null);
      setHover(null);
      setFindOpen(false);
      setQuery('');
    },
    [id],
  );

  const openFind = useCallback(() => setFindOpen(true), []);

  useLayoutEffect(() => {
    if (findOpen) findInput.current?.focus();
  }, [findOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (
        t.closest('input, textarea, dialog[open]') ||
        e.metaKey ||
        e.ctrlKey ||
        e.altKey
      )
        return;
      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        openFind();
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        doBack();
      } else if (e.key === 'm' || e.key === 'M') setMapOpen(true);
      else if (e.key === '?') setKeysOpen(true);
      else if (e.key === 's' || e.key === 'S') soundStore.set((v) => !v);
      else if (e.key === 'Enter' && hover && !t.closest('a, button'))
        follow(hover.link);
      else if (e.key === 'Escape') setHover(null);
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [openFind, doBack, follow, hover]);

  const onHover = useCallback((l: LinkRef | null) => {
    if (!l) {
      setHover(null);
      return;
    }
    const rect = l.el.getBoundingClientRect();
    setHover({ link: l, x: rect.left, y: rect.bottom });
  }, []);

  const cardBoxes = boxes(p, r, fresh);
  const mp = mapProps(p, r);
  const times: (number | null)[] = p.points.map((_, i) =>
    p.kind === 'course' && i > 0 && i <= r.punched.length
      ? splitOf(r, i - 1)
      : null,
  );
  const activeRow = p.kind === 'course' ? r.leg + 1 : -1;
  const label =
    p.kind === 'course'
      ? `Leg ${r.leg + 1} of ${p.points.length - 1}`
      : `Timed run · ${r.punched.length} of ${p.points.length - 1}`;

  const peekData = usePeek(peek?.key ?? null);
  const hoverData = usePeek(hover?.link.key ?? null);

  const article = shown ?? (loaded.status === 'ready' ? loaded.article : null);
  const settled =
    article && article.key !== top.key && r.stack.length > 1
      ? r.stack.slice(0, -1)
      : r.stack;
  const failed = loaded.status === 'error' ? loaded.kind : null;

  const body = (
    <div className="relative">
      {busy && (
        <div
          className="absolute inset-x-0 -top-px h-0.5 origin-left animate-pulse bg-kite"
          aria-hidden="true"
        />
      )}
      <div
        aria-busy={loaded.status === 'loading'}
        aria-live="polite"
        className="sr-only"
      >
        {loaded.status === 'ready' ? `${loaded.article.title} loaded` : ''}
      </div>
      {failed && (
        <div
          className="mb-4 flex items-center justify-between gap-3 border-[1.5px] border-ink bg-white p-3"
          role="alert"
        >
          <span className="text-[15px]">
            {failed === 'offline'
              ? "You're offline. Reconnect to carry on."
              : failed === 'busy'
                ? 'Wikipedia asked us to slow down. Try again in a moment.'
                : failed === 'missing'
                  ? "That article doesn't exist any more. Go back and try another link."
                  : "Couldn't load that article."}
          </span>
          {failed === 'missing' ? (
            <button type="button" className="btn press" onClick={doBack}>
              Back
            </button>
          ) : (
            <button
              type="button"
              className="btn press"
              onClick={() => setAttempt((n) => n + 1)}
            >
              Retry
            </button>
          )}
        </div>
      )}
      {article ? (
        <div key={article.key} className="fade-in">
          <p className="label mb-1.5">
            {settled.length > 1
              ? `From ${settled[settled.length - 2]?.title ?? ''} · click ${r.clicks}`
              : p.kind === 'course' && r.leg > 0
                ? `Checkpoint ${r.leg} · click ${r.clicks}`
                : r.clicks > 0
                  ? `Click ${r.clicks}`
                  : 'Start'}
          </p>
          <h1 className="m-0 mb-3 font-semibold text-[28px] leading-[1.05] tab:text-[40px] desk:text-[48px]">
            {article.title}
          </h1>
          <Reader
            html={article.html}
            query={findOpen ? query : ''}
            cursor={cursor}
            onGo={follow}
            onPeek={(l) => setPeek(l)}
            onHover={onHover}
            onHits={setHits}
          />
          <div className="mt-8 border-rule border-t pt-3">
            <Credit title={article.title} />
          </div>
        </div>
      ) : (
        !failed && (
          <div className="skeleton" aria-hidden="true">
            <span style={{ width: '30%' }} />
            <span style={{ width: '70%', height: '1.6em' }} />
            <span style={{ width: '100%' }} />
            <span style={{ width: '94%' }} />
            <span style={{ width: '98%' }} />
            <span style={{ width: '60%' }} />
          </div>
        )
      )}
    </div>
  );

  const findBar = findOpen && (
    <div className="flex items-center gap-2 border-rule border-b bg-white px-3 py-2 tab:px-6">
      <Icon name="find" size={18} />
      <label className="sr-only" htmlFor="find">
        Find a link on this page
      </label>
      <input
        id="find"
        ref={findInput}
        type="search"
        inputMode="search"
        enterKeyHint="next"
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        placeholder="Find a link on this page"
        className="min-w-0 flex-1 bg-transparent py-2 text-[16px] outline-none"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setCursor(0);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            setCursor((c) => c + (e.shiftKey ? -1 : 1));
          } else if (e.key === 'Escape') {
            setFindOpen(false);
            setQuery('');
          }
        }}
      />
      <span
        className="num w-16 text-right text-[13px] text-pencil"
        aria-live="polite"
      >
        {query.trim().length >= 2 ? `${hits} link${hits === 1 ? '' : 's'}` : ''}
      </span>
      <IconButton
        icon="close"
        label="Close find"
        bordered={false}
        onClick={() => {
          setFindOpen(false);
          setQuery('');
        }}
      />
    </div>
  );

  const nextBar =
    p.kind === 'course' && target ? (
      <NextBar
        label={isLast ? 'Finish' : 'Next checkpoint'}
        title={target.title}
        codeKey={isLast ? null : target.key}
        big={!phone}
      >
        {!phone && (
          <>
            <span className="num mr-1 font-semibold text-[20px]">
              {clock(legSplit)}
            </span>
            <button
              type="button"
              className="btn press"
              onClick={openFind}
              data-tip="Find a link on this page"
              data-key="F"
            >
              Find <span className="kbd kbd-fine">F</span>
            </button>
            <button
              type="button"
              className="btn press"
              onClick={doBack}
              disabled={!canBack(r)}
              aria-label="Back one article, adds a click"
              data-tip="Back one article, adds a click"
              data-key="⌫"
            >
              Back
            </button>
          </>
        )}
      </NextBar>
    ) : p.kind === 'timed' ? (
      <TimedHead
        p={p}
        r={r}
        left={left}
        phone={phone}
        onFind={openFind}
        onBack={doBack}
      />
    ) : null;

  const card = (
    <PunchCard
      boxes={cardBoxes}
      height={phone ? 34 : 56}
      dot={phone ? 3.5 : 4.5}
    />
  );
  const clicksLine = (
    <span className="num w-19 flex-none text-left text-[12px] text-pencil leading-tight">
      {r.clicks} click{r.clicks === 1 ? '' : 's'}
      <br />
      {clock(p.kind === 'timed' ? left : time).padStart(5, '\u2007')}{' '}
      {p.kind === 'timed' ? 'left' : 'total'}
    </span>
  );

  const map = (cls: string, focus = false) => (
    <CourseMap
      seed={id}
      {...mp}
      focus={focus}
      className={cls}
      pad={phone ? 26 : 40}
      labels
    />
  );

  const legChip = p.kind === 'course' && (
    <div className="absolute top-[calc(10px+var(--sat))] left-[calc(10px+var(--sal))] flex flex-col border-[1.5px] border-ink bg-paper px-2 py-1">
      <span className="label text-[12px]">{label}</span>
      <span
        className="num font-semibold text-[19px] leading-tight"
        role="timer"
        aria-label={spoken(legSplit)}
      >
        {clock(legSplit)}
      </span>
    </div>
  );

  let layout: React.ReactNode;
  if (phone && !land) {
    layout = (
      <div className="flex h-dvh flex-col overflow-hidden">
        {p.kind === 'course' && (
          <div className="relative h-[clamp(120px,22dvh,214px)] flex-none border-ink border-b-[1.5px]">
            {map('absolute inset-0', true)}
            {legChip}
            <button
              type="button"
              className="press control absolute top-[calc(8px+var(--sat))] right-2 flex h-11 w-11 items-center justify-center"
              aria-label="Open the map"
              onClick={() => setMapOpen(true)}
            >
              <span className="flex h-8 w-8 items-center justify-center border-[1.5px] border-ink bg-paper">
                <Icon name="expand" size={16} />
              </span>
            </button>
          </div>
        )}
        {nextBar}
        {findBar}
        <div
          ref={scroller}
          className="scroller min-h-0 flex-1 px-4 pt-4 pb-[calc(var(--drawer,96px)+24px)]"
        >
          {body}
        </div>
        <Drawer
          label="Your card"
          peek={
            <div className="flex items-center gap-2.5">
              <div className="min-w-0 flex-1">{card}</div>
              {clicksLine}
              <IconButton
                icon="back"
                label="Back one article, adds a click"
                onClick={doBack}
                disabled={!canBack(r)}
              />
            </div>
          }
          more={
            <div className="flex flex-col gap-3">
              <CourseRows
                points={p.points}
                active={activeRow}
                times={times}
                live={p.kind === 'course' ? legSplit : null}
                compact
              />
              <div className="grid grid-cols-3 gap-2">
                <button type="button" className="btn press" onClick={openFind}>
                  <Icon name="find" size={18} /> Find
                </button>
                <button
                  type="button"
                  className="btn press"
                  onClick={() => setMapOpen(true)}
                >
                  <Icon name="map" size={18} /> Map
                </button>
                <button
                  type="button"
                  className="btn press"
                  onClick={() => setLeaveOpen(true)}
                >
                  Leave
                </button>
              </div>
            </div>
          }
        />
      </div>
    );
  } else if (land) {
    layout = (
      <div className="grid h-dvh grid-rows-[minmax(0,1fr)] grid-cols-[minmax(260px,38%)_1fr] overflow-hidden">
        <div className="relative border-ink border-r-[1.5px] pl-(--sal)">
          {map('absolute inset-0')}
          {legChip}
          <div className="absolute right-2.5 bottom-[calc(10px+var(--sab))] left-[calc(10px+var(--sal))] flex items-center gap-2 border-[1.5px] border-ink bg-paper p-1.5">
            <div className="min-w-0 flex-1">{card}</div>
            {clicksLine}
          </div>
        </div>
        <div className="flex min-w-0 flex-col pr-(--sar)">
          {p.kind === 'course' && target ? (
            <NextBar
              label={`${isLast ? 'Finish' : 'Next checkpoint'}${isLast ? '' : ` · ${code(target.key)}`}`}
              title={target.title}
              codeKey={null}
            >
              <IconButton
                icon="find"
                label="Find a link on this page"
                keyHint="F"
                onClick={openFind}
              />
              <IconButton
                icon="back"
                label="Back one article, adds a click"
                keyHint="⌫"
                onClick={doBack}
                disabled={!canBack(r)}
              />
            </NextBar>
          ) : (
            nextBar
          )}
          {findBar}
          <div
            ref={scroller}
            className="scroller min-h-0 flex-1 px-4 pt-3 pb-[calc(16px+var(--sab))]"
          >
            {body}
          </div>
        </div>
      </div>
    );
  } else if (!desk) {
    layout = (
      <div className="grid h-dvh grid-rows-[minmax(0,1fr)] grid-cols-[300px_1fr] overflow-hidden">
        <aside className="flex min-h-0 flex-col border-ink border-r-[1.5px]">
          <div className="flex items-center justify-between px-4 pt-[calc(20px+var(--sat))] pb-3">
            <a
              href="/"
              onClick={(e) => {
                e.preventDefault();
                setLeaveOpen(true);
              }}
              aria-label="Kite home"
            >
              <Wordmark className="text-[24px]" />
            </a>
            <IconButton
              icon={sound ? 'sound' : 'mute'}
              label={sound ? 'Mute' : 'Sound on'}
              keyHint="S"
              bordered={false}
              onClick={() => soundStore.set((v) => !v)}
            />
          </div>
          <div className="relative aspect-square flex-none border-ink border-y-[1.5px]">
            {map('absolute inset-0')}
            {legChip}
          </div>
          <div className="scroller min-h-0 flex-1 px-4 pt-3">
            <span className="label">
              {p.kind === 'course'
                ? "Today's course"
                : 'Checkpoints, any order'}
            </span>
            <CourseRows
              points={p.points}
              active={activeRow}
              times={times}
              live={p.kind === 'course' ? legSplit : null}
            />
          </div>
          <div className="flex flex-col gap-2 border-ink border-t-[1.5px] px-4 pt-3.5 pb-[calc(20px+var(--sab))]">
            <div className="flex justify-between">
              <span className="label">Your card</span>
              <span className="num w-28 text-left text-[12px] text-pencil">
                {clicks(r.clicks)} ·{' '}
                {clock(p.kind === 'timed' ? left : time).padStart(5, '\u2007')}
              </span>
            </div>
            {card}
          </div>
        </aside>
        <div className="flex min-w-0 flex-col">
          {nextBar}
          {findBar}
          <div
            ref={scroller}
            className="scroller min-h-0 flex-1 px-6 pt-6 pb-10 tab:px-10"
          >
            {body}
          </div>
        </div>
      </div>
    );
  } else {
    layout = (
      <div className="grid h-dvh grid-rows-[minmax(0,1fr)] grid-cols-[minmax(0,1.1fr)_minmax(560px,1fr)] overflow-hidden wide:grid-cols-[minmax(0,1.6fr)_minmax(640px,1fr)]">
        <div className="relative border-ink border-r-[1.5px]">
          {map('absolute inset-0')}
          <div className="absolute top-6 left-6 w-85 border-[1.5px] border-ink bg-paper">
            <div className="flex items-center justify-between border-ink border-b-[1.5px] p-2.5">
              <a
                href="/"
                onClick={(e) => {
                  e.preventDefault();
                  setLeaveOpen(true);
                }}
                aria-label="Kite home"
              >
                <Wordmark className="text-[22px]" />
              </a>
              <IconButton
                icon={sound ? 'sound' : 'mute'}
                label={sound ? 'Mute' : 'Sound on'}
                keyHint="S"
                bordered={false}
                onClick={() => soundStore.set((v) => !v)}
              />
            </div>
            <div className="px-3">
              <CourseRows
                points={p.points}
                active={activeRow}
                times={times}
                live={p.kind === 'course' ? legSplit : null}
                compact
              />
            </div>
          </div>
          <div className="absolute bottom-6 left-6 flex w-85 flex-col gap-2 border-[1.5px] border-ink bg-paper p-2.5">
            <div className="flex justify-between">
              <span className="label">Your card</span>
              <span className="num w-28 text-left text-[12px] text-pencil">
                {clicks(r.clicks)} ·{' '}
                {clock(p.kind === 'timed' ? left : time).padStart(5, '\u2007')}
              </span>
            </div>
            {card}
          </div>
        </div>
        <div className="flex min-w-0 flex-col">
          {nextBar}
          {findBar}
          <div
            ref={scroller}
            className="scroller min-h-0 flex-1 px-14 pt-9 pb-12"
          >
            {body}
          </div>
          <div className="flex justify-end gap-3 border-rule border-t px-8 py-2.5 text-[12px] text-pencil">
            <span>
              <span className="kbd">Tab</span> moves through links ·{' '}
              <span className="kbd">M</span> map ·{' '}
              <span className="kbd">?</span> keys
            </span>
          </div>
        </div>
      </div>
    );
  }

  const legIndex = Math.max(0, r.punched.length - 1);
  const punchedPoint = p.points[r.punched.length] ?? null;
  const legClicks = r.legClicks[legIndex] ?? 0;
  const legShortest = p.course?.legs[legIndex]?.shortest ?? 0;

  return (
    <>
      {layout}

      {hover && !phone && (
        <div
          data-peek
          role="tooltip"
          className="fixed z-40 flex w-[320px] flex-col border-[1.5px] border-ink bg-paper shadow-[0_10px_24px_rgba(22,22,22,0.14)]"
          style={{
            left: Math.min(hover.x, innerWidth - 336),
            top: Math.min(hover.y + 8, innerHeight - 220),
          }}
        >
          <div className="flex flex-col gap-1 px-3.5 py-3">
            <span className="label">Link preview</span>
            <span className="font-semibold text-[20px]">
              {hoverData?.data?.title ?? toTitle(hover.link.key)}
            </span>
            <span className="line-clamp-3 min-h-[4.2em] text-[14px] text-[#2c2a27] leading-snug">
              {hoverData?.data?.extract ??
                (hoverData?.failed ? "Couldn't load a preview." : '')}
            </span>
          </div>
          <div className="flex items-center justify-between border-rule border-t px-3.5 py-2 text-[12px] text-pencil">
            <span>Click to go, the clock keeps running</span>
            <span className="kbd">Enter</span>
          </div>
        </div>
      )}

      <Sheet
        open={peek !== null}
        onClose={() => setPeek(null)}
        label="Link preview"
        footer={
          <div className="grid grid-cols-[1fr_1.7fr] gap-2.5">
            <button
              type="button"
              className="btn press min-h-13"
              onClick={() => setPeek(null)}
            >
              Stay
            </button>
            <button
              type="button"
              className="btn btn-kite press"
              onClick={() => peek && follow(peek)}
            >
              <span className="truncate">
                Go to {peekData?.data?.title ?? (peek ? toTitle(peek.key) : '')}
              </span>
            </button>
          </div>
        }
      >
        {peek && (
          <div className="flex flex-col gap-4">
            <PeekText title={toTitle(peek.key)} peek={peekData} />
            <div className="border-rule border-y py-2.5 text-[13px] text-pencil">
              The clock keeps running
            </div>
          </div>
        )}
      </Sheet>

      <Sheet
        open={punchOpen && !r.done}
        onClose={() => {
          setPunchOpen(false);
          setFresh(null);
          unpause(id);
        }}
        label="Checkpoint reached"
        footer={
          <button
            type="button"
            className="btn btn-kite press w-full"
            onClick={() => {
              setPunchOpen(false);
              setFresh(null);
              unpause(id);
            }}
          >
            Keep going
          </button>
        }
      >
        {punchedPoint && (
          <div className="flex flex-col gap-3.5" role="status">
            <div className="flex items-center gap-3">
              <Flag size={44} />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="label text-kite-text">
                  Checkpoint {r.punched.length} punched · clock paused
                </span>
                <span className="font-semibold text-[26px] leading-[1.05]">
                  {punchedPoint.title}
                </span>
              </div>
              <span className="stencil text-[30px] text-kite-text">
                {code(punchedPoint.key)}
              </span>
            </div>
            <PunchCard boxes={cardBoxes} height={72} dot={5} />
            <div className="grid grid-cols-3 border-[1.5px] border-ink">
              <Stat label="Leg time" value={clock(splitOf(r, legIndex))} />
              <Stat
                label="Clicks"
                value={String(legClicks)}
                tone={legClicks === legShortest ? 'kite' : undefined}
              />
              <Stat label="Shortest" value={String(legShortest)} />
            </div>
            <p className="m-0 text-[15px] text-[#2c2a27] leading-snug">
              {legClicks <= legShortest
                ? "Spot on, that's the shortest route for this leg."
                : `${legClicks - legShortest} more than the shortest for this leg.`}{' '}
              {target &&
                (isLast ? (
                  <>
                    Last leg: on to{' '}
                    <b className="font-semibold">{target.title}</b>, the finish.
                  </>
                ) : (
                  <>
                    Next: <b className="font-semibold">{target.title}</b>.
                  </>
                ))}
            </p>
          </div>
        )}
      </Sheet>

      <Sheet
        open={leaveOpen}
        onClose={() => setLeaveOpen(false)}
        label="Leave the course"
        footer={
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              className="btn press min-h-13"
              onClick={() => {
                setLeaveOpen(false);
                hold(id);
                navigate('/');
              }}
            >
              Leave
            </button>
            <button
              type="button"
              className="btn btn-kite press"
              onClick={() => setLeaveOpen(false)}
            >
              Keep going
            </button>
          </div>
        }
      >
        <div className="flex flex-col gap-2">
          <h2 className="m-0 font-semibold text-[24px]">Leave the course?</h2>
          <p className="m-0 text-[16px] text-[#2c2a27]">
            Your clock stops. Come back any time to carry on from here.
          </p>
        </div>
      </Sheet>

      <Sheet open={mapOpen} onClose={() => setMapOpen(false)} label="The map">
        <div className="flex flex-col gap-3">
          <span className="label">
            {p.kind === 'course' ? label : 'Checkpoints, any order'}
          </span>
          <div className="relative aspect-4/3 border-[1.5px] border-ink">
            <CourseMap
              seed={id}
              {...mp}
              className="absolute inset-0"
              pad={30}
            />
          </div>
          <CourseRows
            points={p.points}
            active={activeRow}
            times={times}
            live={p.kind === 'course' ? legSplit : null}
          />
        </div>
      </Sheet>

      <Sheet
        open={keysOpen}
        onClose={() => setKeysOpen(false)}
        label="Keyboard shortcuts"
      >
        <h2 className="m-0 mb-3 font-semibold text-[22px]">Keys</h2>
        <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[15px]">
          {[
            ['Tab', 'Move through the links'],
            ['Enter', 'Go to the link'],
            ['F', 'Find a link on this page'],
            ['⌫', 'Back one article, adds a click'],
            ['M', 'Open the map'],
            ['S', 'Sound on or off'],
            ['Esc', 'Close'],
          ].map(([k, v]) => (
            <div key={k} className="contents">
              <dt>
                <span className="kbd">{k}</span>
              </dt>
              <dd className="m-0">{v}</dd>
            </div>
          ))}
        </dl>
      </Sheet>
    </>
  );
}

function TimedHead({
  p,
  r,
  left,
  phone,
  onFind,
  onBack,
}: {
  p: Plan;
  r: RunState;
  left: number;
  phone: boolean;
  onFind: () => void;
  onBack: () => void;
}) {
  const total = p.points.length - 1;
  return (
    <div
      className={`border-ink border-b-[1.5px] ${phone ? 'pt-[calc(10px+var(--sat))]' : ''}`}
    >
      <div className="flex items-end justify-between px-4 pb-3 tab:px-6 tab:pt-4">
        <div className="flex flex-col">
          <span className="label">Timed run · any order</span>
          <span
            className={`stencil num leading-[0.9] ${phone ? 'text-[44px]' : 'text-[52px]'}`}
            role="timer"
            aria-label={`${spoken(left)} left`}
          >
            {clock(left)}
          </span>
          <span className="mt-1.5 text-[13px] text-pencil">left of 10:00</span>
        </div>
        <div className="flex items-end gap-2">
          {!phone && (
            <>
              <button type="button" className="btn press" onClick={onFind}>
                Find <span className="kbd kbd-fine">F</span>
              </button>
              <button
                type="button"
                className="btn press"
                onClick={onBack}
                disabled={!canBack(r)}
              >
                Back
              </button>
            </>
          )}
          <div className="flex flex-col items-end">
            <span className="label">Punched</span>
            <span className="num font-semibold text-[28px] leading-none">
              {r.punched.length} of {total}
            </span>
          </div>
        </div>
      </div>
      <div className="relative h-2 bg-rule">
        <div
          className="absolute inset-0 origin-left bg-ink"
          style={{
            transform: `scaleX(${r.punched.length / total})`,
            transition: 'transform 300ms var(--ease-out)',
          }}
        />
      </div>
      <ul className="m-0 flex list-none flex-wrap gap-1.5 px-4 py-3 tab:px-6">
        {p.points.slice(1).map((pt) => {
          const got = r.punched.includes(pt.key);
          return (
            <li
              key={pt.key}
              className={`flex h-10 items-center gap-2 border-[1.5px] border-ink px-2.5 font-semibold text-[14px] ${got ? 'bg-done text-pencil line-through' : 'bg-white'}`}
            >
              <span className="stencil text-[14px] text-kite-text no-underline">
                {code(pt.key)}
              </span>
              {pt.title}
              <span className="sr-only">{got ? ', punched' : ''}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
