import { access, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const out = 'public/fonts/stencil';
const file = join(out, 'bespoke-stencil-800.woff2');

try {
  await access(file);
  process.exit(0);
} catch {}

try {
  const css = await (
    await fetch(
      'https://api.fontshare.com/v2/css?f[]=bespoke-stencil@800&display=swap',
    )
  ).text();
  const url = css.match(/url\('(\/\/cdn\.fontshare\.com[^']+\.woff2)'\)/)?.[1];
  if (!url) throw new Error('no woff2 in the Fontshare stylesheet');
  const res = await fetch(`https:${url}`);
  if (!res.ok) throw new Error(`${res.status}`);
  await mkdir(out, { recursive: true });
  await writeFile(file, Buffer.from(await res.arrayBuffer()));
  console.log('Bespoke Stencil fetched from Fontshare');
} catch (e) {
  console.warn(
    `Could not fetch Bespoke Stencil from Fontshare (${e.message}). The stencil text falls back to a system font.`,
  );
}
