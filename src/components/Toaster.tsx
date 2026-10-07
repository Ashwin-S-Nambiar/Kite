import { useRef } from 'react';
import { useStore } from '../lib/store.ts';
import { dismiss, toastStore } from '../lib/toast.ts';

export default function Toaster() {
  const t = useStore(toastStore);
  const el = useRef<HTMLDivElement>(null);
  const x0 = useRef<number | null>(null);

  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-50 flex justify-center px-4"
      style={{
        bottom: 'calc(12px + var(--sab))',
        transform: 'translateY(calc(-1 * var(--drawer, 0px)))',
      }}
    >
      <div aria-live="polite" className="sr-only">
        {t?.text ?? ''}
      </div>
      {t && !t.quiet && (
        <div
          key={t.id}
          ref={el}
          className="fade-in pointer-events-auto max-w-105 touch-pan-y border-[1.5px] border-ink bg-ink px-4 py-3 font-medium text-[15px] text-paper"
          onPointerDown={(e) => {
            x0.current = e.clientX;
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (x0.current === null || !el.current) return;
            const dx = e.clientX - x0.current;
            el.current.style.transform = `translateX(${dx}px)`;
            el.current.style.opacity = String(
              Math.max(0, 1 - Math.abs(dx) / 160),
            );
          }}
          onPointerUp={(e) => {
            const dx = x0.current === null ? 0 : e.clientX - x0.current;
            x0.current = null;
            if (Math.abs(dx) > 70) dismiss();
            else if (el.current) {
              el.current.style.transform = '';
              el.current.style.opacity = '';
            }
          }}
          aria-hidden="true"
        >
          {t.text}
        </div>
      )}
    </div>
  );
}
