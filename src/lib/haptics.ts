const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

function buzz(pattern: number | number[]) {
  if (still() || !('vibrate' in navigator)) return;
  try {
    navigator.vibrate(pattern);
  } catch {}
}

export const haptic = {
  tap: () => buzz(8),
  tick: () => buzz(5),
  punch: () => buzz([20, 40, 20]),
  finish: () => buzz([30, 60, 30, 60, 60]),
  warn: () => buzz(40),
};
