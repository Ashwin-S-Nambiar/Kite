export function normaliseFind(value: string) {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

export function matchingLinks(root: HTMLElement, query: string) {
  const q = normaliseFind(query);
  if (q.length < 2) return [];
  return [...root.querySelectorAll<HTMLAnchorElement>('a[data-k]')].filter(
    (link) =>
      link.getClientRects().length > 0 &&
      normaliseFind(link.textContent ?? '').includes(q),
  );
}

export function revealFoundLink(link: HTMLAnchorElement) {
  const scroller = link.closest<HTMLElement>('[data-article-scroller]');
  if (!scroller) return;
  const view = scroller.getBoundingClientRect();
  const panel = scroller.parentElement?.querySelector<HTMLElement>(
    '[data-find-panel][data-open="true"]',
  );
  const dock = document.querySelector<HTMLElement>('[data-reader-dock]');
  const dockRect = dock?.getBoundingClientRect();
  const viewport = window.visualViewport;
  const top =
    Math.max(
      view.top,
      panel?.getBoundingClientRect().bottom ?? view.top,
      viewport?.offsetTop ?? 0,
    ) + 12;
  const bottom =
    Math.min(
      view.bottom,
      viewport ? viewport.offsetTop + viewport.height : view.bottom,
      dockRect && dockRect.left < view.right && dockRect.right > view.left
        ? dockRect.top
        : view.bottom,
    ) - 12;
  if (bottom <= top) return;
  const table = link.closest<HTMLElement>('.table-wrap');
  if (table && table.scrollWidth > table.clientWidth) {
    const bounds = table.getBoundingClientRect();
    const rect = link.getBoundingClientRect();
    if (rect.left < bounds.left || rect.right > bounds.right) {
      table.scrollTo({
        left:
          table.scrollLeft +
          (rect.left + rect.right - bounds.left - bounds.right) / 2,
        behavior: 'instant',
      });
    }
  }
  const rect = link.getBoundingClientRect();
  if (rect.top >= top && rect.bottom <= bottom) return;
  const delta = (rect.top + rect.bottom - top - bottom) / 2;
  scroller.scrollTo({
    top: Math.max(0, scroller.scrollTop + delta),
    behavior: 'instant',
  });
}
