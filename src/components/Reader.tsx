import { memo, useEffect, useLayoutEffect, useRef } from 'react';
import { matchingLinks, revealFoundLink } from '../lib/find.ts';
import { haptic } from '../lib/haptics.ts';

const HOLD = 450;
const SLOP = 8;
const fine = () => matchMedia('(hover: hover) and (pointer: fine)').matches;

export type LinkRef = {
  key: string;
  text: string;
  el: HTMLAnchorElement;
  keyboard?: boolean;
};

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
  onIntent,
  disabled = false,
}: {
  html: string;
  query: string;
  cursor: number;
  onGo: (l: LinkRef) => void;
  onPeek: (l: LinkRef) => void;
  onHover: (l: LinkRef | null) => void;
  onHits: (n: number) => void;
  onIntent?: (l: LinkRef) => void;
  disabled?: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  const cbs = useRef({ onGo, onPeek, onHover, onHits, onIntent, disabled });
  cbs.current = { onGo, onPeek, onHover, onHits, onIntent, disabled };

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let hover: ReturnType<typeof setTimeout> | undefined;
    let intent: ReturnType<typeof setTimeout> | undefined;
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
    const dismissHover = () => {
      clearTimeout(hover);
      clearTimeout(intent);
      cbs.current.onHover(null);
    };
    const inPreview = (target: EventTarget | null) =>
      (target as HTMLElement | null)?.closest?.('[data-peek]');

    const down = (e: PointerEvent) => {
      const a = linkOf(e.target);
      fired = false;
      if (!a || cbs.current.disabled) return;
      cbs.current.onIntent?.(ref(a));
      if (e.pointerType === 'mouse') return;
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
    const touchEnd = (e: TouchEvent) => {
      if (fired && e.cancelable) e.preventDefault();
    };
    const click = (e: MouseEvent) => {
      const a = linkOf(e.target);
      if (!a) return;
      e.preventDefault();
      if (cbs.current.disabled) return;
      if (fired) {
        fired = false;
        return;
      }
      if (e.metaKey || e.ctrlKey || e.shiftKey) return;
      clearTimeout(hover);
      clearTimeout(intent);
      cbs.current.onHover(null);
      cbs.current.onGo({ ...ref(a), keyboard: e.detail === 0 });
    };
    const context = (e: MouseEvent) => {
      const a = linkOf(e.target);
      if (!a) return;
      e.preventDefault();
      if (cbs.current.disabled) return;
      clear();
      if (!fired) cbs.current.onPeek(ref(a));
      fired = true;
    };
    const over = (e: PointerEvent) => {
      if (!fine() || cbs.current.disabled) return;
      const a = linkOf(e.target);
      if (a?.contains(e.relatedTarget as Node | null)) return;
      clearTimeout(hover);
      clearTimeout(intent);
      if (!a) {
        cbs.current.onHover(null);
        return;
      }
      intent = setTimeout(() => cbs.current.onIntent?.(ref(a)), 120);
      hover = setTimeout(() => {
        if (a.isConnected) cbs.current.onHover(ref(a));
      }, HOLD);
    };
    const out = (e: PointerEvent) => {
      const a = linkOf(e.target);
      if (!a || a.contains(e.relatedTarget as Node | null)) return;
      clearTimeout(hover);
      clearTimeout(intent);
      if (!inPreview(e.relatedTarget)) cbs.current.onHover(null);
    };
    const leave = (e: PointerEvent) => {
      clearTimeout(hover);
      clearTimeout(intent);
      if (!inPreview(e.relatedTarget)) cbs.current.onHover(null);
    };
    const cancel = () => {
      clear();
      dismissHover();
    };
    const visibility = () => {
      if (document.hidden) dismissHover();
    };
    const scroll = (e: Event) => {
      if (!inPreview(e.target)) dismissHover();
    };
    const focus = (e: FocusEvent) => {
      const a = linkOf(e.target);
      if (a && !cbs.current.disabled) cbs.current.onIntent?.(ref(a));
      if (a?.matches(':focus-visible')) cbs.current.onHover(ref(a));
    };
    const blur = (e: FocusEvent) => {
      if (linkOf(e.target)) dismissHover();
    };

    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', cancel);
    el.addEventListener('touchend', touchEnd, { passive: false });
    el.addEventListener('click', click);
    el.addEventListener('contextmenu', context);
    el.addEventListener('pointerover', over);
    el.addEventListener('pointerout', out);
    el.addEventListener('pointerleave', leave);
    el.addEventListener('focusin', focus);
    el.addEventListener('focusout', blur);
    document.addEventListener('scroll', scroll, true);
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('blur', dismissHover);
    return () => {
      clearTimeout(timer);
      clearTimeout(hover);
      clearTimeout(intent);
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', cancel);
      el.removeEventListener('touchend', touchEnd);
      el.removeEventListener('click', click);
      el.removeEventListener('contextmenu', context);
      el.removeEventListener('pointerover', over);
      el.removeEventListener('pointerout', out);
      el.removeEventListener('pointerleave', leave);
      el.removeEventListener('focusin', focus);
      el.removeEventListener('focusout', blur);
      document.removeEventListener('scroll', scroll, true);
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('blur', dismissHover);
    };
  }, []);

  useLayoutEffect(() => {
    const el = root.current;
    if (!el || !html) return;
    const links = [...el.querySelectorAll<HTMLAnchorElement>('a[data-k]')];
    for (const a of links) a.classList.remove('hit', 'now');
    if (disabled || query.trim().length < 2) {
      cbs.current.onHits(0);
      return;
    }
    const hits = matchingLinks(el, query);
    for (const a of hits) a.classList.add('hit');
    cbs.current.onHits(hits.length);
    if (hits.length) {
      const now = hits[((cursor % hits.length) + hits.length) % hits.length];
      if (now) {
        now.classList.add('now');
        revealFoundLink(now);
      }
    }
  }, [query, cursor, html, disabled]);

  return (
    <div ref={root} className="prose-kite">
      <Body html={html} />
    </div>
  );
}
