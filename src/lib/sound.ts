import { createStore } from './store.ts';

export const soundStore = createStore('kite:sound', true);

type Nav = Navigator & {
  audioSession?: { type: string };
  userActivation?: { hasBeenActive: boolean };
};

let ctx: AudioContext | null = null;
let white: AudioBuffer | null = null;

function audio() {
  const nav = navigator as Nav;
  if (nav.userActivation && !nav.userActivation.hasBeenActive) return null;
  if (!ctx) {
    if (!('AudioContext' in window)) return null;
    if (nav.audioSession) nav.audioSession.type = 'ambient';
    ctx = new AudioContext();
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

function tone(o: {
  freq: number;
  to?: number;
  dur: number;
  type?: OscillatorType;
  gain?: number;
  delay?: number;
}) {
  const c = audio();
  if (!c) return;
  const t = c.currentTime + (o.delay ?? 0);
  const osc = c.createOscillator();
  const amp = c.createGain();
  osc.type = o.type ?? 'sine';
  osc.frequency.setValueAtTime(o.freq, t);
  if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + o.dur);
  amp.gain.setValueAtTime(0.0001, t);
  amp.gain.exponentialRampToValueAtTime(o.gain ?? 0.05, t + 0.004);
  amp.gain.setValueAtTime(o.gain ?? 0.05, t + o.dur * 0.7);
  amp.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
  osc.connect(amp).connect(c.destination);
  osc.start(t);
  osc.stop(t + o.dur + 0.03);
}

function noise(o: {
  dur: number;
  gain?: number;
  freq?: number;
  q?: number;
  type?: BiquadFilterType;
  delay?: number;
}) {
  const c = audio();
  if (!c) return;
  if (!white) {
    white = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const d = white.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const t = c.currentTime + (o.delay ?? 0);
  const src = c.createBufferSource();
  src.buffer = white;
  const f = c.createBiquadFilter();
  f.type = o.type ?? 'lowpass';
  f.frequency.value = o.freq ?? 200;
  f.Q.value = o.q ?? 0.8;
  const amp = c.createGain();
  amp.gain.setValueAtTime(0.0001, t);
  amp.gain.exponentialRampToValueAtTime(o.gain ?? 0.1, t + 0.006);
  amp.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
  src.connect(f).connect(amp).connect(c.destination);
  src.start(t, Math.random() * 0.5);
  src.stop(t + o.dur + 0.02);
}

const play =
  <A extends unknown[]>(fn: (...a: A) => void) =>
  (...a: A) => {
    if (!soundStore.get() || document.hidden) return;
    try {
      fn(...a);
    } catch {}
  };

export const sfx = {
  article: play(() => {
    noise({ dur: 0.055, gain: 0.07, freq: 1800, type: 'bandpass', q: 0.6 });
    tone({ freq: 440, to: 620, dur: 0.055, gain: 0.025 });
    tone({ freq: 740, to: 660, dur: 0.045, gain: 0.018, delay: 0.035 });
  }),
  punch: play(() => {
    noise({ dur: 0.03, gain: 0.08, freq: 2400, type: 'bandpass', q: 2 });
    tone({ freq: 2700, dur: 0.09, type: 'square', gain: 0.022, delay: 0.02 });
  }),
  finish: play(() => {
    tone({ freq: 2700, dur: 0.42, type: 'square', gain: 0.02 });
  }),
  rustle: play(() => {
    noise({ dur: 0.12, gain: 0.05, freq: 3200, type: 'bandpass', q: 0.6 });
    noise({
      dur: 0.1,
      gain: 0.035,
      freq: 4200,
      type: 'bandpass',
      q: 0.8,
      delay: 0.05,
    });
  }),
  thud: play(() => {
    noise({ dur: 0.08, gain: 0.2, freq: 140 });
    noise({ dur: 0.08, gain: 0.16, freq: 120, delay: 0.11 });
  }),
  tap: play(() => tone({ freq: 880, to: 640, dur: 0.03, gain: 0.018 })),
};
export function initSoundFeedback() {
  document.addEventListener('click', (event) => {
    if (!(event.target instanceof Element)) return;
    const control = event.target.closest<HTMLElement>(
      'button, a[href], [role="button"]',
    );
    if (
      !control ||
      control.matches(':disabled, [aria-disabled="true"]') ||
      control.closest('[inert], [data-sound="handled"]') ||
      control.matches('a[data-k]')
    )
      return;
    sfx.tap();
  });
}
