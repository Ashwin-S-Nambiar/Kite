import type { ReactNode } from 'react';
import { useMedia } from './Bits.tsx';

export const MAP_PADDING = 56;

export function useSplitLayout() {
  return useMedia(
    '(min-width: 900px), (min-width: 600px) and (orientation: landscape) and (max-height: 520px)',
  );
}
export default function SplitLayout({
  map,
  children,
}: {
  map: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className="split-layout">
      <div className="split-map">{map}</div>
      <div className="split-panel">{children}</div>
    </main>
  );
}
