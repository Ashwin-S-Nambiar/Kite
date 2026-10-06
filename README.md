<p align="center">
  <a href="https://steno.ashwin.co.in">
    <img src="./docs/screenshots/Steno.webp" width="100%" alt="steno on desktop: a green steno pad with a spiral binding, markdown for a hampi trip on the left of a red centre line and the same page formatted on the right, with the list of pages on the desk beside it">
  </a>
</p>

<p align="center">
  <a href="https://steno.ashwin.co.in"><strong>steno.ashwin.co.in</strong></a>
  &nbsp;·&nbsp;
  <a href="#how-it-works">how it works</a>
  &nbsp;·&nbsp;
  <a href="#the-design">the design</a>
  &nbsp;·&nbsp;
  <a href="#running-it">running it</a>
</p>

<br>

the source of **[steno.ashwin.co.in](https://steno.ashwin.co.in)**, a markdown pad. write shorthand on the left, read it back as a page on the right. your pages stay in your browser, keep their own history, and go out as a link when you want to share one.

this is a rebuild of my first markdown editor. that one kept every visitor's notes in one shared firebase list; this one keeps yours on your device and nowhere else.

## how it works

<p align="center">
  <img src="./docs/screenshots/Steno-2.webp" width="32%" alt="steno on a phone, shorthand side: the markdown for the hampi page with a row of format keys above the keyboard">
  &nbsp;
  <img src="./docs/screenshots/Steno-3.webp" width="32%" alt="steno on a phone, longhand side: the same page formatted, with ticked tasks crossed out in red and a table of opening times">
  &nbsp;
  <img src="./docs/screenshots/Steno-4.webp" width="32%" alt="the pages sheet on a phone: a pinned page at the top, then the other pages with a line from each">
</p>

- **two sides, one line.** markdown on the left, the page on the right, split by the pad's red centre line. drag the line to give either side more room, double click it to centre it, or click a side's name to read or write full width.
- **they keep up.** scroll one side and the other follows to the same place. the block your cursor is in gets a small red tick on the page side.
- **tick it either side.** tasks tick from the markdown or straight from the page, and ticked ones get crossed out in red.
- **writing helps.** `⌘B`, `⌘I`, `⌘K` for bold, italic and links, lists carry on when you press enter, and pasting a link over some words turns them into a link.
- **on a phone** the two sides become tabs you can swipe between, with a row of format keys for the marks that are hard to reach on a phone keyboard.
- **find anything.** `⌘O` searches every page by title and text, and runs commands too.
- **page history.** every page keeps snapshots as you write, a few minutes apart. step back through them and restore one, with undo.
- **share as a link.** the page itself is compressed into the link, so nothing is uploaded anywhere. whoever opens it reads it on the pad and can keep a copy.
- **pictures.** paste or drop an image into a page. it's shrunk and kept on your device.
- **code, maths and diagrams.** code blocks are highlighted, `$` maths renders with katex, and ` ```mermaid ` blocks draw as diagrams. each loads only when a page needs it.
- **in and out.** drop `.md` files on the pad to open them as pages. download a page as `.md` or `.html`, copy it as rich text for a mail or a doc, or print it as a clean page.
- **pin, duplicate, delete with undo**, and a pad that works offline once it has loaded.

## the design

the page is a steno pad.

- **the pad.** pale green eye-ease paper with ruled lines, a wire spiral along the top and the red rule down the middle that splits shorthand from longhand. it sits on grey chipboard, like the back of the pad.
- **one grid.** both sides sit on the same 28 px rules. headings, lists, tables, code, pictures and diagrams all snap to whole lines, so the two sides line up.
- **marks in pencil.** the markdown marks print in a faint green so the words stand out, the way shorthand reads.
- **one red.** the centre line, the cursor, links, crossed out tasks and the current-block tick. nothing else is coloured.
- **type.** ibm plex mono for the markdown, literata for the page, instrument sans for everything around it. all self-hosted with metric-matched fallbacks.
- **a night pad.** with your system in dark mode the paper turns dark green and the ink light. there is no toggle; it follows your system.
- **turning pages.** switching pages flips the old one up over the spiral.
- **fits every screen.** from a 320 px phone to a 2560 px monitor, portrait or landscape, the page itself never scrolls; only the pad does. phones get tabs, landscape phones and tablets get both sides, desktops add the pages beside the pad, and wide screens add an outline of the page.
- **nothing jumps.** the page fades in once its fonts are ready, and layout shift measures 0 on load.

<details>
<summary><strong>more screenshots</strong></summary>

<br>

![steno's night pad on desktop: dark green paper, light ink and the red centre line](./docs/screenshots/Steno-5.webp)

![finding a page: the search box with "vittala" typed and the hampi page matched by a line from its text](./docs/screenshots/Steno-6.webp)

![page history: earlier versions of the hampi page down the side and the one from yesterday shown, with a restore button](./docs/screenshots/Steno-7.webp)

![a shared link opened on desktop: the hampi page read only on the pad, with a keep a copy button](./docs/screenshots/Steno-8.webp)

![the 404: this page was torn out, with a button back to your pages](./docs/screenshots/Steno-9.webp)

</details>

## the stack

| layer | choices |
| --- | --- |
| ui | [react 19](https://react.dev), [typescript 7](https://www.typescriptlang.org) and [vite 8](https://vite.dev) |
| editor | [codemirror 6](https://codemirror.net) with its markdown language |
| page | [react-markdown](https://github.com/remarkjs/react-markdown) with [gfm](https://github.github.com/gfm/) and maths, [shiki](https://shiki.style), [katex](https://katex.org) and [mermaid](https://mermaid.js.org) on demand |
| storage | indexeddb through [idb](https://github.com/jakearchibald/idb) |
| style | [tailwind css 4](https://tailwindcss.com) |
| motion | [motion](https://motion.dev) for sheets, menus and toasts |
| type | [ibm plex mono](https://fonts.google.com/specimen/IBM+Plex+Mono), [literata](https://fonts.google.com/specimen/Literata) and [instrument sans](https://fonts.google.com/specimen/Instrument+Sans), self-hosted |
| icons | [phosphor](https://phosphoricons.com) |
| lint and format | [biome](https://biomejs.dev) |
| hosting | [vercel](https://vercel.com/) |

## running it

```sh
git clone https://github.com/Ashwin-S-Nambiar/Markdown-Editor.git
cd Markdown-Editor
npm install
npm run dev
```

then open http://localhost:5173. `npm run typecheck` runs the typescript 7 compiler, `npm run check` runs biome, `npm test` runs the unit tests, and `npm run build` typechecks and writes `dist/` with a matching `404.html`.

## the shape of it

```
src/
  App.tsx              the desk: top bar, pages, the pad, the outline, sheets and shortcuts
  components/
    Pad.tsx            the pad: spiral, centre line, both sides, scroll sync, the page flip
    Source.tsx         the codemirror editor, keeping each page's own undo
    Preview.tsx        the page side: markdown to react, tasks, pictures
    Code.tsx           highlighted code and mermaid diagrams
    Snap.tsx           keeps pictures and diagrams on whole lines
    PageList.tsx       your pages
    Outline.tsx        headings, words and tasks for wide screens
    Palette.tsx        find a page or a command
    HistorySheet.tsx   earlier versions of a page
    Shared.tsx         a page opened from a link
    Keys.tsx           format keys on phones
    Kbd.tsx            shortcut hints
    Sheet.tsx, Menu.tsx, Toaster.tsx, Footer.tsx, Mark.tsx, NotFound.tsx
  lib/
    pages.ts           the pages store, saving and syncing between tabs
    history.ts         snapshots
    images.ts          pictures on the device
    share.ts           pages in and out of links
    editor.ts          codemirror setup, paste and drop
    format.ts          bold, links, lists and the rest
    text.ts            titles, snippets, counts and tasks
    actions.ts         export, copy, print, share and import
    route.ts, db.ts, seed.ts, keys.ts, tip.ts, toast.ts, types.ts
public/
  fonts/               plex mono, literata and instrument sans
  sw.js                offline support
```

## known rough edges

- **pages stay on one device.** they live in your browser, so clearing site data clears them. download the ones you care about.
- **shared links carry words, not pictures.** a picture in a shared page shows as missing on someone else's device.
- **very long pages make long links.** past a few thousand characters some chat apps may cut a shared link short.
