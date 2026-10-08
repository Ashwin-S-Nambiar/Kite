import { useRef, useState } from 'react';
import Sheet from './Sheet.tsx';

export default function RunOptions({
  open,
  onClose,
  onRestart,
  onQuit,
  onLeave,
}: {
  open: boolean;
  onClose: () => void;
  onRestart: () => void;
  onQuit: () => void;
  onLeave?: () => void;
}) {
  const [confirm, setConfirm] = useState<'restart' | 'quit' | null>(null);
  const pending = useRef<(() => void) | null>(null);
  const closeThen = (action: () => void) => {
    pending.current = action;
    onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      onClosed={() => {
        const action = pending.current;
        pending.current = null;
        setConfirm(null);
        action?.();
      }}
      label={
        confirm === 'restart'
          ? 'Restart game?'
          : confirm === 'quit'
            ? 'Quit game?'
            : 'Game menu'
      }
      footer={
        confirm ? (
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              className="btn press min-h-13"
              onClick={() => setConfirm(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-kite press"
              onClick={() =>
                closeThen(confirm === 'restart' ? onRestart : onQuit)
              }
            >
              {confirm === 'restart' ? 'Restart game' : 'Quit game'}
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="btn btn-kite press w-full"
            onClick={onClose}
          >
            {onLeave ? 'Keep going' : 'Close'}
          </button>
        )
      }
    >
      <h2 className="m-0 mb-2 font-semibold text-[24px]">
        {confirm === 'restart'
          ? 'Restart game?'
          : confirm === 'quit'
            ? 'Quit game?'
            : 'Game menu'}
      </h2>
      {confirm ? (
        <p className="m-0 text-[16px] text-pencil">
          {confirm === 'restart'
            ? 'Start at the first article with zero clicks and a fresh clock. Your current progress will be discarded.'
            : 'Discard this run and return home. You can start a new run any time.'}{' '}
          Your finished cards stay saved.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {onLeave && (
            <button
              type="button"
              className="btn press min-h-13"
              onClick={() => closeThen(onLeave)}
            >
              Save and leave
            </button>
          )}
          <button
            type="button"
            className="btn press min-h-13"
            onClick={() => setConfirm('restart')}
          >
            Restart from scratch
          </button>
          <button
            type="button"
            className="btn press min-h-13"
            onClick={() => setConfirm('quit')}
          >
            Quit game
          </button>
          {onLeave && (
            <p className="m-0 mt-1 text-[14px] text-pencil">
              Save and leave stops your clock so you can carry on later.
            </p>
          )}
        </div>
      )}
    </Sheet>
  );
}
