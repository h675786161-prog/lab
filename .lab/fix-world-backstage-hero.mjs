import fs from 'node:fs/promises';
import path from 'node:path';

const out = process.env.GUIDE_SITE_DIR || '/tmp/world-backstage-guide-site';
const indexFile = path.join(out, 'index.html');
let html = await fs.readFile(indexFile, 'utf8');
html = html.replace(
  '<section class="hero"><div class="hero-stars"></div>',
  '<section class="hero"><img class="hero-art" src="assets/hero.webp" width="900" height="506" alt="" aria-hidden="true" fetchpriority="high" decoding="async"><div class="hero-wash" aria-hidden="true"></div><div class="hero-stars" aria-hidden="true"></div>'
);
await fs.writeFile(indexFile, html);

const cssFile = path.join(out, 'styles.css');
let css = await fs.readFile(cssFile, 'utf8');
css += String.raw`

/* Hero image is a real element so loading can be verified, and the decorative layer must not consume a grid cell. */
.hero{background:linear-gradient(155deg,#fff9fb 0%,#f9eef6 48%,#37345f 100%);grid-template-columns:minmax(0,.98fr) minmax(320px,1.02fr)}
.hero-art{position:absolute;inset:0;z-index:0;width:100%;height:100%;object-fit:cover;object-position:center center;max-width:none;pointer-events:none;user-select:none}
.hero-wash{position:absolute;inset:0;z-index:1;pointer-events:none;background:linear-gradient(90deg,rgba(255,250,252,.96) 0%,rgba(255,250,252,.88) 28%,rgba(255,250,252,.42) 47%,rgba(255,250,252,.02) 68%),linear-gradient(0deg,rgba(39,38,72,.30) 0%,rgba(39,38,72,0) 41%)}
.hero-stars{position:absolute;inset:0;z-index:1;pointer-events:none}
.hero-copy,.hero-card{position:relative;z-index:2}
.hero-copy{grid-column:1;justify-self:start}
.hero-card{grid-column:2;justify-self:start;align-self:end}
.hero:before,.hero:after{z-index:2;pointer-events:none}
@media(max-width:900px){.hero{grid-template-columns:1fr}.hero-copy,.hero-card{grid-column:1}.hero-art{object-position:62% center}.hero-wash{background:linear-gradient(90deg,rgba(255,250,252,.94),rgba(255,250,252,.68) 64%,rgba(255,250,252,.22)),linear-gradient(0deg,rgba(41,39,73,.30),transparent 44%)}}
@media(max-width:620px){.hero-art{object-position:60% center}.hero-wash{background:linear-gradient(90deg,rgba(255,250,252,.94),rgba(255,250,252,.73) 64%,rgba(255,250,252,.32)),linear-gradient(0deg,rgba(41,39,73,.32),transparent 46%)}}
`;
await fs.writeFile(cssFile, css);
console.log('hero layout fixed');
