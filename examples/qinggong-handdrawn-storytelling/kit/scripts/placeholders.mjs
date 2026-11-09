import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {asset, PALETTE} from '../src/assets.mjs';
import {labelPaths} from '../src/compile.mjs';

// Deterministic generic card, not a replacement claim for any course artwork.
export function writePlaceholders() {
  const card = asset('blank-card');
  const title = labelPaths('示例卡片', 23, PALETTE.purple);
  const caption = labelPaths('填写你的知识点', 13, PALETTE.ink);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="35 14 171 215" data-source="blank-card">${card.markup}<g transform="translate(${120-title.width/2} 101)">${title.markup}</g><g transform="translate(${120-caption.width/2} 139)">${caption.markup}</g></svg>`;
  const target = new URL('../assets/cards/placeholder.svg', import.meta.url);
  fs.mkdirSync(fileURLToPath(new URL('.', target)), {recursive: true});
  fs.writeFileSync(target, svg);
}
