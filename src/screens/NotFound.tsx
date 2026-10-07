import { useEffect } from 'react';
import { navigate } from '../lib/route.ts';
import { Footer } from './Home.tsx';

export default function NotFound() {
  useEffect(() => {
    document.title = 'Not found · Kite';
  }, []);
  return (
    <main className="relative flex h-dvh flex-col overflow-hidden">
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 390 844"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        <path
          d="M-10 520 C 60 440 170 470 220 560 S 240 760 160 860 L -10 860 Z"
          fill="#c8e6b8"
        />
        <path
          d="M260 -10 C 280 80 360 120 400 110 L 400 -10 Z"
          fill="#c8e6b8"
        />
        <g fill="none" stroke="#c06a2b" strokeWidth="1.3" opacity=".75">
          <path d="M90 200 C 150 140 290 150 320 230 S 300 380 210 390 S 60 360 56 290 S 60 230 90 200 Z" />
          <path d="M120 222 C 170 180 270 188 292 244 S 276 352 210 360 S 92 338 88 290 S 96 244 120 222 Z" />
          <path
            d="M150 246 C 186 220 250 226 264 262 S 252 326 210 330 S 128 316 124 288 S 130 260 150 246 Z"
            strokeWidth="2.2"
          />
        </g>
        <circle
          cx="196"
          cy="288"
          r="40"
          fill="none"
          stroke="#ef6420"
          strokeWidth="3"
          strokeDasharray="8 7"
        />
        <text
          x="196"
          y="302"
          textAnchor="middle"
          className="stencil"
          fontSize="40"
          fill="#c04a0e"
        >
          ?
        </text>
      </svg>
      <div className="relative mt-auto flex flex-col gap-3 px-5 pb-[calc(28px+var(--sab))] tab:mx-auto tab:w-full tab:max-w-130 tab:pb-16">
        <span className="label">Checkpoint</span>
        <span className="stencil text-[96px] text-kite-text leading-[0.8]">
          404
        </span>
        <h1 className="m-0 mt-1.5 font-semibold text-[30px] leading-[1.1]">
          This checkpoint isn’t on the map.
        </h1>
        <p className="m-0 text-[16px] text-[#2c2a27] leading-normal">
          Someone moved the kite, or the link is old. Today’s course is still
          out there.
        </p>
        <a
          href="/"
          className="btn btn-kite press mt-2 w-full"
          onClick={(e) => {
            e.preventDefault();
            navigate('/today');
          }}
        >
          Back to today’s course
        </a>
        <Footer />
      </div>
    </main>
  );
}
