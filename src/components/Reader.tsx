import { memo, useEffect, useRef } from 'react';
import { haptic } from '../lib/haptics.ts';

const HOLD = 450;
const SLOP = 8;
const fine = () => matchMedia('(hover: hover) and (pointer: fine)').matches;

export type LinkRef = { key: string; text: string; el: HTMLAnchorElement };

const Body = memo(function Body({ html }: { html: string }) {
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
});

export default function Reader({
  html,
  query,
  cursor,
  onGo,
  onPeek,
  onHover,
  onHits,
}: {
  html: string;
  query: string;
  cursor: number;
  onGo: (l: LinkRef) => void;
  onPeek: (l: LinkRef) => void;
  onHover: (l: LinkRef | null) => void;
  onHits: (n: number) => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const cbs = useRef({ onGo, onPeek, onHover, onHits });
  cbs.current = { onGo, onPeek, onHover, onHits };

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let hover: ReturnType<typeof setTimeout> | undefined;
    let start: { x: number; y: number; a: HTMLAnchorElement } | null = null;
    let fired = false;

    const linkOf = (t: EventTarget | null) =>
      (t as HTMLElement | null)?.closest?.<HTMLAnchorElement>('a[data-k]') ??
      null;
    const ref = (a: HTMLAnchorElement): LinkRef => ({
      key: a.dataset.k ?? '',
      text: (a.textContent ?? '').trim(),
      el: a,
    });
    const clear = () => {
      clearTimeout(timer);
      if (start) start.a.classList.remove('held');
      start = null;
    };

    const down = (e: PointerEvent) => {
      const a = linkOf(e.target);
      fired = false;
      if (!a || e.pointerType === 'mouse') return;
      start = { x: e.clientX, y: e.clientY, a };
      timer = setTimeout(() => {
        if (!start) return;
        fired = true;
        haptic.tick();
        start.a.classList.add('held');
        const r = ref(start.a);
        setTimeout(() => r.el.classList.remove('held'), 260);
        cbs.current.onPeek(r);
      }, HOLD);
    };
    const move = (e: PointerEvent) => {
      if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > SLOP)
        clear();
    };
    const up = () => {
      clearTimeout(timer);
      start = null;
    };
    const click = (e: MouseEvent) => {
      const a = linkOf(e.target);
      if (!a) return;
      e.preventDefault();
      if (fired) {
        fired = false;
        return;
      }
      if (e.metaKey || e.ctrlKey || e.shiftKey) return;
      clearTimeout(hover);
      cbs.current.onHover(null);
      cbs.current.onGo(ref(a));
    };
    const context = (e: MouseEvent) => {
      const a = linkOf(e.target);
      if (!a) return;
      e.preventDefault();
      clear();
      if (!fired) cbs.current.onPeek(ref(a));
      fired = true;
    };
    const over = (e: PointerEvent) => {
      if (!fine()) return;
      const a = linkOf(e.target);
      clearTimeout(hover);
      if (!a) return;
      hover = setTimeout(() => cbs.current.onHover(ref(a)), HOLD);
    };
    const out = (e: PointerEvent) => {
      const a = linkOf(e.target);
      if (!a || a.contains(e.relatedTarget as Node | null)) return;
      clearTimeout(hover);
      if (!(e.relatedTarget as HTMLElement | null)?.closest?.('[data-peek]'))
        cbs.current.onHover(null);
    };
    const focus = (e: FocusEvent) => {
      const a = linkOf(e.target);
      if (a?.matches(':focus-visible')) cbs.current.onHover(ref(a));
    };
    const blur = (e: FocusEvent) => {
      if (linkOf(e.target)) cbs.current.onHover(null);
    };

    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', clear);
    el.addEventListener('click', click);
    el.addEventListener('contextmenu', context);
    el.addEventListener('pointerover', over);
    el.addEventListener('pointerout', out);
    el.addEventListener('focusin', focus);
    el.addEventListener('focusout', blur);
    return () => {
      clearTimeout(timer);
      clearTimeout(hover);
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', clear);
      el.removeEventListener('click', click);
      el.removeEventListener('contextmenu', context);
      el.removeEventListener('pointerover', over);
      el.removeEventListener('pointerout', out);
      el.removeEventListener('focusin', focus);
      el.removeEventListener('focusout', blur);
    };
  }, []);

  useEffect(() => {
    const el = root.current;
    if (!el || !html) return;
    const links = [...el.querySelectorAll<HTMLAnchorElement>('a[data-k]')];
    for (const a of links) a.classList.remove('hit', 'now');
    const q = query.trim().toLowerCase();
    if (q.length < 2) {
      cbs.current.onHits(0);
      return;
    }
    const hits = links.filter((a) =>
      (a.textContent ?? '').toLowerCase().includes(q),
    );
    for (const a of hits) a.classList.add('hit');
    cbs.current.onHits(hits.length);
    if (hits.length) {
      const now = hits[((cursor % hits.length) + hits.length) % hits.length];
      if (now) {
        now.classList.add('now');
        now.scrollIntoView({
          block: 'center',
          behavior: matchMedia('(prefers-reduced-motion: reduce)').matches
            ? 'auto'
            : 'smooth',
        });
      }
    }
  }, [query, cursor, html]);

  return (
    <div ref={root} className="prose-kite">
      <Body html={html} />
    </div>
  );
}
