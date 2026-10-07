import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseHTML } from 'linkedom';
import { canonicalOf, normalise, playable } from './links.ts';

const page = `<!doctype html><html><head><title>Tea</title>
<link rel="dc:isVersionOf" href="//en.wikipedia.org/wiki/Tea"/></head><body>
<section><p><a rel="mw:WikiLink" href="./Camellia_sinensis">plant</a>
<a rel="mw:WikiLink" href="./China#History">China</a>
<a rel="mw:WikiLink" href="./File:Tea.jpg">file</a>
<a rel="mw:WikiLink" class="new" href="./Missing_page">red</a>
<a rel="mw:ExtLink" href="https://example.com">out</a>
<a rel="mw:WikiLink" href="./green%20tea">green tea</a></p>
<table class="infobox"><tr><td><a rel="mw:WikiLink" href="./Infobox_only">x</a></td></tr></table>
<figure><img src="x.jpg"/><figcaption><a rel="mw:WikiLink" href="./Caption_only">c</a></figcaption></figure>
<div class="hatnote"><a rel="mw:WikiLink" href="./Hatnote_only">h</a></div>
<sup class="mw-ref"><a rel="mw:WikiLink" href="./Ref_only">1</a></sup>
<div class="navbox"><a rel="mw:WikiLink" href="./Navbox_only">n</a></div></section>
<section><h2>See also</h2><p><a rel="mw:WikiLink" href="./See_also_only">s</a></p></section>
</body></html>`;

function doc() {
  return parseHTML(page).document as unknown as Document;
}

test('playable keeps body links and drops everything else', () => {
  const links = playable(doc());
  assert.deepEqual([...links].sort(), [
    'Camellia_sinensis',
    'China',
    'Green_tea',
  ]);
});

test('canonical title comes from dc:isVersionOf', () => {
  assert.equal(canonicalOf(doc()), 'Tea');
});

test('normalise uses underscores and a capital first letter', () => {
  assert.equal(normalise('green tea'), 'Green_tea');
  assert.equal(normalise(' Black_hole '), 'Black_hole');
});
