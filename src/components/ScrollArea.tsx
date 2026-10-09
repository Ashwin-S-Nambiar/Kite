import {
  type ComponentProps,
  type RefObject,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import Icon from './Icon.tsx';

/** A scroll viewport with an actionable cue above any pinned footer. */
export default function ScrollArea({
  children,
  className = '',
  cue = 'More below',
  target,
  viewportRef,
  ...props
}: Omit<ComponentProps<'div'>, 'ref'> & {
  cue?: string;
  target?: RefObject<HTMLElement | null>;
  viewportRef?: RefObject<HTMLDivElement | null>;
}) {
  const localRef = useRef<HTMLDivElement>(null);
  const viewport = viewportRef ?? localRef;
  const content = useRef<HTMLDivElement>(null);
  const id = useId();
  const [overflow, setOverflow] = useState(false);
  const [more, setMore] = useState(false);

  useLayoutEffect(() => {
    const el = viewport.current;
    const inner = content.current;
    if (!el || !inner) return;
    const measure = () => {
      // Measure the content independently of the space reserved for the cue.
      // This prevents the cue itself from causing overflow or resize loops.
      setOverflow(
        el.clientHeight > 0 && inner.offsetHeight > el.clientHeight + 1,
      );
      setMore(el.scrollHeight - el.clientHeight - el.scrollTop > 2);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    observer.observe(inner);
    el.addEventListener('scroll', measure, { passive: true });
    measure();
    return () => {
      observer.disconnect();
      el.removeEventListener('scroll', measure);
    };
  }, [viewport]);

  // Reserving cue space changes scrollHeight without resizing the content.
  useLayoutEffect(() => {
    const el = viewport.current;
    if (el)
      setMore(overflow && el.scrollHeight - el.clientHeight - el.scrollTop > 2);
  }, [overflow, viewport]);

  function reveal() {
    const el = viewport.current;
    if (!el) return;
    const destination = target?.current;
    const top = destination
      ? el.scrollTop +
        destination.getBoundingClientRect().top -
        el.getBoundingClientRect().top -
        12
      : el.scrollTop + el.clientHeight * 0.75;
    el.scrollTo({
      top,
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'instant'
        : 'smooth',
    });
    destination?.focus({ preventScroll: true });
  }

  return (
    <div className="scroll-area">
      <div
        {...props}
        ref={viewport}
        id={props.id ?? id}
        className="scroller scroll-viewport"
        data-overflow={overflow || undefined}
      >
        <div ref={content} className={`scroll-content ${className}`}>
          {children}
        </div>
      </div>
      {overflow && more && (
        <div className="scroll-cue">
          <button
            type="button"
            className="scroll-cue-button"
            aria-controls={props.id ?? id}
            onClick={reveal}
          >
            <span>{cue}</span>
            <Icon name="down" size={16} className="shrink-0" />
          </button>
        </div>
      )}
    </div>
  );
}
