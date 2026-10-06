import Sheet from '../components/Sheet.tsx';

export function Rules() {
  return (
    <ol className="m-0 flex list-none flex-col gap-2.5 p-0">
      {[
        'Move only by tapping links inside the article. No search.',
        'Reach the checkpoints in order. Each one punches your card.',
        'Fewest clicks wins, the clock breaks ties. Going back counts as a click.',
      ].map((t, i) => (
        <li
          key={t}
          className="grid grid-cols-[22px_1fr] gap-2.5 text-[15px] text-[#2c2a27] leading-snug"
        >
          <b className="num font-semibold text-ink">{i + 1}</b>
          <span>{t}</span>
        </li>
      ))}
    </ol>
  );
}

export default function About({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Sheet open={open} onClose={onClose} label="How it works">
      <div className="flex flex-col gap-6">
        <section className="flex flex-col gap-3">
          <h2 className="m-0 font-semibold text-[24px]">How it works</h2>
          <Rules />
          <p className="m-0 text-[15px] text-pencil leading-snug">
            Long press a link, or hover it on a computer, to read its first line
            before you go. The clock keeps running while you look.
          </p>
        </section>
        <section className="flex flex-col gap-2">
          <h3 className="m-0 font-semibold text-[18px]">
            Where the words come from
          </h3>
          <p className="m-0 text-[15px] text-[#2c2a27] leading-snug">
            Kite borrows from orienteering, where you race across a forest from
            checkpoint to checkpoint with a map and a card.
          </p>
          <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[15px]">
            {[
              ['Checkpoint', 'a control'],
              ['Leg time', 'a split'],
              ['Your card', 'the control card you punch at each one'],
              ['Timed run', 'a score event, any order against the clock'],
              ['The kite', 'the orange and white flag at every checkpoint'],
            ].map(([a, b]) => (
              <div key={a} className="contents">
                <dt className="font-semibold">{a}</dt>
                <dd className="m-0 text-pencil">{b}</dd>
              </div>
            ))}
          </dl>
        </section>
        <section className="flex flex-col gap-1.5 text-[13px] text-pencil leading-snug">
          <p className="m-0">
            Articles come from{' '}
            <a
              className="underline decoration-rule underline-offset-2"
              href="https://en.wikipedia.org"
              target="_blank"
              rel="noopener noreferrer"
            >
              Wikipedia
            </a>{' '}
            under{' '}
            <a
              className="underline decoration-rule underline-offset-2"
              href="https://creativecommons.org/licenses/by-sa/4.0/"
              target="_blank"
              rel="noopener noreferrer"
            >
              CC BY-SA 4.0
            </a>
            , restyled for the game. Kite isn’t made by or connected to the
            Wikimedia Foundation.
          </p>
          <p className="m-0">
            Set in Familjen Grotesk and Bespoke Stencil. Your cards stay on this
            device.
          </p>
          <p className="m-0">
            <a
              className="underline decoration-rule underline-offset-2"
              href="https://ashwin.co.in"
            >
              Made by Ashwin
            </a>
          </p>
        </section>
      </div>
    </Sheet>
  );
}
