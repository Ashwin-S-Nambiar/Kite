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
import FindBar from '../components/FindBar.tsx';
import Icon, { Flag, Wordmark } from '../components/Icon.tsx';
import LinkPreview from '../components/LinkPreview.tsx';
import PunchCard, { type Box } from '../components/PunchCard.tsx';
import Reader, { type LinkRef } from '../components/Reader.tsx';
import RunOptions from '../components/RunOptions.tsx';
import Sheet from '../components/Sheet.tsx';
import { useArticle } from '../hooks/useArticle.ts';
import { clicks, clock, code, spoken } from '../lib/course.ts';
import { normaliseFind } from '../lib/find.ts';
import { haptic } from '../lib/haptics.ts';
import { navigate } from '../lib/route.ts';
import {
  arrive,
  back,
  canBack,
  discard,
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
import {
  type Article,
  article as loadArticle,
  prefetchArticle,
  toTitle,
} from '../lib/wiki.ts';

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

function PreviousArticle({
  onClick,
  disabled,
}: {
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      className="btn press min-h-11 flex-none flex-col gap-1 px-2 text-[13px]"
      onClick={onClick}
      disabled={disabled}
      aria-label="Previous article, adds a click"
      data-tip="Previous article, adds a click"
      data-key="⌫"
    >
      <span>Previous article</span>
      <span className="font-normal text-[11px] text-pencil">+1 click</span>
    </button>
  );
}

export default function RunScreen({ plan: p }: { plan: Plan }) {
  const existing = useRun(p.id);
  const [generation, setGeneration] = useState(0);
  const [exiting, setExiting] = useState(false);
  useEffect(() => {
    if (!existing && !exiting) start(p);
  }, [existing, exiting, p]);
  if (!existing || exiting) return <div className="h-dvh bg-paper" />;
  return (
    <Playing
      key={generation}
      p={p}
      r={existing}
      onRestart={() => {
        start(p);
        setGeneration((n) => n + 1);
      }}
      onQuit={() => {
        setExiting(true);
        discard(p.id);
        navigate('/');
      }}
    />
  );
}

function Playing({
  p,
  r,
  onRestart,
  onQuit,
}: {
  p: Plan;
  r: RunState;
  onRestart: () => void;
  onQuit: () => void;
}) {
  const id = p.id;
  const sound = useStore(soundStore);
  const top = r.stack[r.stack.length - 1] ?? {
    key: p.points[0]?.key ?? '',
    title: '',
  };
  const [attempt, setAttempt] = useState(0);
  const loaded = useArticle(top.key, attempt);
  const [shown, setShown] = useState<Article | null>(null);
  const busy = loaded.status === 'loading';
  const navigation = useRef<string | null>(null);
  const interactionReady = useRef(false);
  interactionReady.current =
    loaded.status === 'ready' && loaded.key === top.key;
  const [motion, setMotion] = useState(false);
  const [peek, setPeek] = useState<LinkRef | null>(null);
  const [hover, setHover] = useState<{
    link: LinkRef;
  } | null>(null);
  const [findOpen, setFindOpen] = useState(false);
  const [findMotion, setFindMotion] = useState(false);
  const [query, setQuery] = useState('');
  const [settledQuery, setSettledQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const [hits, setHits] = useState(0);
  const [punchOpen, setPunchOpen] = useState(r.paused && !r.done);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [keysOpen, setKeysOpen] = useState(false);
  const [fresh, setFresh] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const findInput = useRef<HTMLInputElement>(null);
  const findOpener = useRef<HTMLElement | null>(null);
  const arrived = useRef('');
  const running = !r.done && !r.paused && r.since !== null;
  const now = useNow(running);
  const time = elapsed(r, now);
  const phone = useMedia('(max-width: 599px)');
  const naturalLand = useMedia(
    '(orientation: landscape) and (max-height: 520px)',
  );
  const [keyboardLayout, setKeyboardLayout] = useState<{
    land: boolean;
    width: number;
    height: number;
  } | null>(null);
  const land = keyboardLayout?.land ?? naturalLand;
  const desk = useMedia('(min-width: 1200px)');
  const normalisedQuery = normaliseFind(query);
  const searching =
    normalisedQuery.length >= 2 && normalisedQuery !== settledQuery;

  useEffect(() => {
    if (!findOpen || normalisedQuery.length < 2) {
      setSettledQuery('');
      return;
    }
    const timer = setTimeout(() => setSettledQuery(normalisedQuery), 200);
    return () => clearTimeout(timer);
  }, [findOpen, normalisedQuery]);

  useLayoutEffect(() => {
    if (!keyboardLayout) return;
    const resize = () => {
      // A software keyboard changes height, not device orientation. Keep the
      // reader mounted until it closes; a physical rotation can change layout.
      if (
        Math.abs(innerWidth - keyboardLayout.width) > 8 ||
        (!findOpen && innerHeight >= keyboardLayout.height - 80)
      )
        setKeyboardLayout(null);
    };
    resize();
    addEventListener('resize', resize);
    return () => removeEventListener('resize', resize);
  }, [findOpen, keyboardLayout]);

  const target = p.kind === 'course' ? p.points[r.leg + 1] : null;
  const isLast = p.kind === 'course' && r.leg + 1 === p.points.length - 1;
  const legSplit =
    p.kind === 'course' ? time - (r.legTimes[r.leg - 1] ?? 0) : time;
  const left = TIMED_LIMIT - time;

  useEffect(() => {
    if (r.paused && !r.done) setPunchOpen(true);
  }, [r.paused, r.done]);

  useLayoutEffect(() => {
    if (loaded.key === top.key && loaded.status !== 'loading')
      navigation.current = null;
  });

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
    navigation.current = latest.current.stack.at(-2)?.key ?? null;
    setAttempt(0);
    setMotion(false);
    back(id);
    sfx.step();
    haptic.tap();
    setPeek(null);
    setHover(null);
  }, [id]);

  const closeFind = useCallback((animate: boolean, restoreFocus = true) => {
    const active = document.activeElement;
    if (active instanceof HTMLElement && active.closest('[data-find-panel]'))
      active.blur();
    setFindMotion(animate);
    setFindOpen(false);
    setQuery('');
    setSettledQuery('');
    setCursor(0);
    if (restoreFocus && findOpener.current?.isConnected) {
      findOpener.current.focus({ preventScroll: true });
    }
  }, []);

  useEffect(() => {
    if ((history.state as { guard?: string } | null)?.guard !== id)
      history.pushState({ guard: id }, '');
    const onPop = (e: PopStateEvent) => {
      if ((e.state as { guard?: string } | null)?.guard === id) return;
      if (location.pathname !== `/c/${id}/run`) return;
      history.pushState({ guard: id }, '');
      if (!latest.current.done) setLeaveOpen(true);
    };
    addEventListener('popstate', onPop);
    return () => removeEventListener('popstate', onPop);
  }, [id]);

  const follow = useCallback(
    (l: LinkRef) => {
      const cur = latest.current;
      if (
        cur.done ||
        cur.paused ||
        navigation.current !== null ||
        !interactionReady.current
      )
        return;
      // Lock synchronously: two clicks can arrive before React renders loading.
      navigation.current = l.key;
      setAttempt(0);
      setMotion(!l.keyboard);
      loadArticle(l.key).catch(() => {});
      go(id, { key: l.key, title: toTitle(l.key) });
      sfx.step();
      haptic.tap();
      setPeek(null);
      setHover(null);
      closeFind(false, false);
    },
    [id, closeFind],
  );

  const openFind = useCallback(
    (event?: { detail: number; currentTarget?: EventTarget | null }) => {
      if (!findOpen) {
        findOpener.current =
          event?.currentTarget instanceof HTMLElement
            ? event.currentTarget
            : (document.activeElement as HTMLElement | null);
        if (matchMedia('(pointer: coarse)').matches) {
          setKeyboardLayout({
            land: naturalLand,
            width: innerWidth,
            height: innerHeight,
          });
        }
      }
      setFindMotion(event !== undefined && event.detail !== 0);
      setFindOpen(true);
      setHover(null);
      findInput.current?.focus({ preventScroll: true });
    },
    [findOpen, naturalLand],
  );

  const toggleFind = useCallback(
    (event?: { detail: number; currentTarget?: EventTarget | null }) => {
      if (findOpen) closeFind((event?.detail ?? 0) !== 0);
      else openFind(event);
    },
    [findOpen, closeFind, openFind],
  );

  useLayoutEffect(() => {
    if (findOpen) findInput.current?.focus({ preventScroll: true });
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
        follow({ ...hover.link, keyboard: true });
      else if (e.key === 'Escape') setHover(null);
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [openFind, doBack, follow, hover]);

  const onHover = useCallback((l: LinkRef | null) => {
    if (!l || !interactionReady.current || navigation.current !== null) {
      setHover(null);
      return;
    }
    setHover({ link: l });
  }, []);
  const onIntent = useCallback((l: LinkRef) => prefetchArticle(l.key), []);

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

  const article = loaded.status === 'ready' ? loaded.article : shown;
  const settled =
    article && article.key !== top.key && r.stack.length > 1
      ? r.stack.slice(0, -1)
      : r.stack;
  const failed = loaded.status === 'error' ? loaded.kind : null;

  const loadingStatus = busy && (
    <div className="sticky top-0 z-10 h-0">
      <div
        className="relative overflow-hidden border-[1.5px] border-ink bg-paper px-3 py-2 shadow-[0_4px_12px_rgba(22,22,22,0.08)]"
        role="status"
        aria-live="polite"
      >
        <span className="block truncate font-medium text-[14px]">
          Opening {top.title || toTitle(top.key)}…
        </span>
        <span
          className="article-progress absolute inset-x-0 bottom-0 h-0.5 bg-kite-wash"
          aria-hidden="true"
        />
      </div>
    </div>
  );

  const body = (
    <div className="relative">
      <div aria-live="polite" className="sr-only">
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
            <PreviousArticle onClick={doBack} disabled={!canBack(r)} />
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
        <div
          key={article.key}
          className="article-content"
          data-loading={busy || failed !== null}
          data-motion={motion}
          aria-busy={busy}
          inert={busy || failed !== null}
        >
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
            query={
              findOpen && normalisedQuery.length >= 2 && !searching
                ? settledQuery
                : ''
            }
            cursor={cursor}
            onGo={follow}
            onPeek={(l) => setPeek(l)}
            onHover={onHover}
            onHits={setHits}
            onIntent={onIntent}
            disabled={busy || failed !== null}
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

  const findBar = (
    <FindBar
      open={findOpen}
      animate={findMotion}
      query={query}
      searching={searching}
      hits={hits}
      cursor={cursor}
      inputRef={findInput}
      onChange={(value) => {
        setQuery(value);
        if (normaliseFind(value) !== normalisedQuery) {
          setSettledQuery('');
          setCursor(0);
        }
      }}
      onStep={(direction) => setCursor((c) => c + direction)}
      onClose={closeFind}
    />
  );

  const readerPane = (padding: string) => (
    <div className="relative min-h-0 flex-1" data-reader-viewport>
      {findBar}
      <div
        ref={scroller}
        data-article-scroller
        className={`scroller h-full ${padding}`}
      >
        {loadingStatus}
        {body}
      </div>
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
        {desk && !land && (
          <>
            <span className="num mr-1 font-semibold text-[20px]">
              {clock(legSplit)}
            </span>
            <button
              type="button"
              className="btn press"
              onClick={toggleFind}
              data-tip="Find a link on this page"
              data-key="F"
            >
              Find <span className="kbd kbd-fine">F</span>
            </button>
            <PreviousArticle onClick={doBack} disabled={!canBack(r)} />
          </>
        )}
      </NextBar>
    ) : p.kind === 'timed' ? (
      <TimedHead
        p={p}
        r={r}
        left={left}
        phone={phone || land || !desk}
        onFind={toggleFind}
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
        {readerPane('px-4 pt-4 pb-[calc(var(--drawer,96px)+24px)]')}
        <Drawer
          label="Your card"
          peek={
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2.5">
                <div className="min-w-0 flex-1">{card}</div>
                {clicksLine}
              </div>
              <div className="grid grid-cols-[minmax(0,1fr)_44px_minmax(0,1fr)] gap-2">
                <PreviousArticle onClick={doBack} disabled={!canBack(r)} />
                <IconButton
                  icon="find"
                  label="Find a link on this page"
                  onClick={toggleFind}
                />
                <button
                  type="button"
                  className="btn press px-2 text-[13px]"
                  onClick={() => setLeaveOpen(true)}
                >
                  Game menu
                </button>
              </div>
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
              <button
                type="button"
                className="btn press"
                onClick={() => setMapOpen(true)}
              >
                <Icon name="map" size={18} /> Map
              </button>
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
            ></NextBar>
          ) : (
            nextBar
          )}
          {readerPane('px-4 pt-3 pb-[calc(16px+var(--sab))]')}
          <div className="flex flex-none items-center justify-end gap-2 border-rule border-t px-4 py-2 pb-[calc(8px+var(--sab))]">
            <PreviousArticle onClick={doBack} disabled={!canBack(r)} />
            <IconButton
              icon="find"
              label="Find a link on this page"
              onClick={toggleFind}
            />
            <button
              type="button"
              className="btn press text-[13px]"
              onClick={() => setLeaveOpen(true)}
            >
              Game menu
            </button>
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
              aria-label="Game menu"
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
            <div className="grid grid-cols-[minmax(0,1fr)_44px] gap-2">
              <PreviousArticle onClick={doBack} disabled={!canBack(r)} />
              <IconButton
                icon="find"
                label="Find a link on this page"
                onClick={toggleFind}
              />
            </div>
            <button
              type="button"
              className="press min-h-11 text-[14px] underline decoration-rule underline-offset-2"
              onClick={() => setLeaveOpen(true)}
            >
              Game menu
            </button>
          </div>
        </aside>
        <div className="flex min-w-0 flex-col">
          {nextBar}
          {readerPane('px-6 pt-6 pb-10 tab:px-10')}
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
                aria-label="Game menu"
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
            <button
              type="button"
              className="press min-h-11 text-[14px] underline decoration-rule underline-offset-2"
              onClick={() => setLeaveOpen(true)}
            >
              Game menu
            </button>
          </div>
        </div>
        <div className="flex min-w-0 flex-col">
          {nextBar}
          {readerPane('px-14 pt-9 pb-12')}
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
        <LinkPreview
          link={hover.link}
          summary={hoverData?.data ?? null}
          failed={hoverData?.failed ?? false}
          onDismiss={() => setHover(null)}
        />
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

      <RunOptions
        open={leaveOpen}
        onClose={() => setLeaveOpen(false)}
        onRestart={onRestart}
        onQuit={onQuit}
        onLeave={() => {
          hold(id);
          navigate('/');
        }}
      />

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
            ['↑ / ↓', 'Previous / next match in Find'],
            ['⌫', 'Previous article, adds a click'],
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
              <PreviousArticle onClick={onBack} disabled={!canBack(r)} />
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
