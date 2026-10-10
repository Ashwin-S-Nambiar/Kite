import type { RefObject } from 'react';
import { IconButton } from './Bits.tsx';
import Icon from './Icon.tsx';

export default function FindBar({
  open,
  animate,
  query,
  searching,
  hits,
  cursor,
  inputRef,
  onChange,
  onStep,
  onClose,
}: {
  open: boolean;
  animate: boolean;
  query: string;
  searching: boolean;
  hits: number;
  cursor: number;
  inputRef: RefObject<HTMLInputElement | null>;
  onChange: (value: string) => void;
  onStep: (direction: number) => void;
  onClose: (animate: boolean) => void;
}) {
  const active = query.trim().length >= 2;
  const canStep = active && !searching && hits > 0;
  const index = hits > 0 ? (((cursor % hits) + hits) % hits) + 1 : 0;

  return (
    <div
      className="find-panel absolute inset-x-0 top-0 z-20 flex items-center gap-1 border-rule border-b bg-paper px-3 py-2 shadow-[0_4px_12px_rgba(22,22,22,0.08)] tab:gap-2 tab:px-6"
      data-find-panel
      data-open={open}
      data-animate={animate}
      aria-hidden={!open}
      inert={!open}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          onClose(false);
        } else if (['Enter', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
          if (e.key === 'Enter' && (e.target as HTMLElement).closest('button'))
            return;
          e.preventDefault();
          if (canStep)
            onStep(
              e.key === 'ArrowUp' || (e.key === 'Enter' && e.shiftKey) ? -1 : 1,
            );
        }
      }}
    >
      <Icon name="find" size={18} className="hidden flex-none tab:block" />
      <label className="sr-only" htmlFor="find">
        Find a link on this page
      </label>
      <input
        id="find"
        ref={inputRef}
        type="search"
        inputMode="search"
        enterKeyHint="next"
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        placeholder="Find a link"
        className="min-w-0 flex-1 bg-transparent py-2 text-[16px] outline-none"
        value={query}
        onChange={(e) => onChange(e.target.value)}
      />
      <span
        className="num w-12 flex-none text-center text-[12px] text-pencil"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        aria-label={
          active
            ? searching
              ? 'Searching links'
              : hits > 0
                ? `Match ${index} of ${hits} links`
                : 'No matching links'
            : undefined
        }
      >
        {active
          ? searching
            ? '…'
            : hits > 0
              ? `${index}/${hits}`
              : 'No links'
          : ''}
      </span>
      <IconButton
        icon="up"
        label="Previous matching link"
        keyHint="↑"
        disabled={!canStep}
        onClick={() => onStep(-1)}
      />
      <IconButton
        icon="down"
        label="Next matching link"
        keyHint="↓"
        disabled={!canStep}
        onClick={() => onStep(1)}
      />
      <button
        type="button"
        className="press control flex h-11 w-11 flex-none items-center justify-center"
        aria-label="Close find"
        data-tip="Close find"
        onClick={(e) => onClose(e.detail !== 0)}
      >
        <Icon name="close" size={20} />
      </button>
    </div>
  );
}
