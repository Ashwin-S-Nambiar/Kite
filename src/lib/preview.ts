type Anchor = { left: number; right: number; top: number; bottom: number };
type Viewport = { left: number; top: number; width: number; height: number };

export function previewPosition(
  anchor: Anchor,
  card: { width: number; height: number },
  viewport: Viewport,
) {
  const margin = 12;
  const gap = 8;
  const right = viewport.left + viewport.width;
  const bottom = viewport.top + viewport.height;
  if (
    anchor.bottom <= viewport.top ||
    anchor.top >= bottom ||
    anchor.right <= viewport.left ||
    anchor.left >= right
  )
    return null;
  const aboveBottom = Math.min(anchor.top - gap, bottom - margin);
  const belowTop = Math.max(anchor.bottom + gap, viewport.top + margin);
  const above = Math.max(0, aboveBottom - viewport.top - margin);
  const below = Math.max(0, bottom - margin - belowTop);
  const side =
    card.height <= below
      ? 'below'
      : card.height <= above
        ? 'above'
        : below >= above
          ? 'below'
          : 'above';
  const maxHeight = side === 'below' ? below : above;
  if (maxHeight < 64) return null;
  const height = Math.min(card.height, maxHeight);
  const width = Math.min(card.width, Math.max(0, viewport.width - margin * 2));
  return {
    side,
    left: Math.max(
      viewport.left + margin,
      Math.min(anchor.left, right - margin - width),
    ),
    top: side === 'below' ? belowTop : aboveBottom - height,
    maxHeight,
  };
}
