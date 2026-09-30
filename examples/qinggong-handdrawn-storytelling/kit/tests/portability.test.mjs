import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = name => fs.readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
test('public templates and gallery have no branded asset dependencies', () => {
  for (const file of ['src/templates.mjs', 'scripts/build.mjs', 'theme.json']) {
    assert(!/assets\/brand\/|bullwhip-(concept|application)\.png|清工开悟|梅花8/.test(read(file)), file);
  }
});
test('public speech examples keep bookends neutral too', () => {
  const root=new URL('../../examples/bullwhip/',import.meta.url);
  const paths=['narration.json','expression-plan.json',...fs.readdirSync(new URL('ssml/',root)).map(n=>'ssml/'+n)];
  for(const p of paths)assert(!/清工开悟|一课到底/.test(fs.readFileSync(new URL(p,root),'utf8')),p);
});
test('browser launcher honors explicit CHROME_BIN across platforms', () => {
  const source = read('scripts/browser-test.mjs');
  assert(source.includes('CHROME_BIN'));
  assert(source.includes('LOCALAPPDATA'));
  assert(source.includes('PROGRAMFILES'));
});
test('placeholder card is derived from the local handdrawn blank card', () => {
  assert(read('assets/cards/placeholder.svg').includes('data-source="blank-card"'));
  assert(read('scripts/placeholders.mjs').includes("asset('blank-card')"));
});
