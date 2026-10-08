import { useLayoutEffect, useRef } from 'react';
import { previewPosition } from '../lib/preview.ts';
import { type Summary, toTitle } from '../lib/wiki.ts';
import type { LinkRef } from './Reader.tsx';

export default function LinkPreview({
  link,
  summary,
  failed,
  onDismiss,
}: {
  link: LinkRef;
  summary: Summary | null;
  failed: boolean;
  onDismiss: () => void;
}) {
  const card = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = card.current;
    if (!el) return;
    const place = () => {
      const viewport = window.visualViewport;
      const bounds = {
        left: viewport?.offsetLeft ?? 0,
        top: viewport?.offsetTop ?? 0,
        width: viewport?.width ?? window.innerWidth,
        height: viewport?.height ?? window.innerHeight,
      };
      el.style.width = `${Math.min(320, Math.max(0, bounds.width - 24))}px`;
      el.style.maxHeight = 'none';
      const position = previewPosition(
        link.el.getBoundingClientRect(),
        el.getBoundingClientRect(),
        bounds,
      );
      el.style.visibility = position ? 'visible' : 'hidden';
      if (!position) return;
      el.style.left = `${position.left}px`;
      el.style.top = `${position.top}px`;
      el.style.maxHeight = `${position.maxHeight}px`;
      el.dataset.side = position.side;
    };
    place();
    const observer = new ResizeObserver(place);
    observer.observe(el);
    window.addEventListener('resize', place);
    window.visualViewport?.addEventListener('resize', place);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', place);
      window.visualViewport?.removeEventListener('resize', place);
    };
  }, [link]);

  return (
    <div
      ref={card}
      data-peek
      role="tooltip"
      className="fixed z-40 flex w-80 flex-col overflow-hidden border-[1.5px] border-ink bg-paper shadow-[0_10px_24px_rgba(22,22,22,0.14)]"
      style={{ visibility: 'hidden' }}
      onPointerLeave={(e) => {
        if (!link.el.contains(e.nativeEvent.relatedTarget as Node | null))
          onDismiss();
      }}
    >
      <div className="scroller flex min-h-0 flex-col gap-1 px-3.5 py-3">
        <span className="label">Link preview</span>
        <span className="font-semibold text-[20px]">
          {summary?.title ?? toTitle(link.key)}
        </span>
        <span className="line-clamp-3 min-h-[4.2em] text-[14px] text-[#2c2a27] leading-snug">
          {summary?.extract ?? (failed ? "Couldn't load a preview." : '')}
        </span>
      </div>
      <div className="flex flex-none items-center justify-between border-rule border-t px-3.5 py-2 text-[12px] text-pencil">
        <span>Click to go, the clock keeps running</span>
        <span className="kbd">Enter</span>
      </div>
    </div>
  );
}
