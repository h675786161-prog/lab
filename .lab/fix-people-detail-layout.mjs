import fs from 'node:fs/promises';
import path from 'node:path';

const out = process.env.GUIDE_SITE_DIR || '/tmp/world-backstage-guide-site';
const cssFile = path.join(out, 'styles.css');
let css = await fs.readFile(cssFile, 'utf8');

css += String.raw`

/* ===== People detail: desktop should feel like an opened character dossier, not a squeezed phone preview ===== */
.detail-story{
  width:min(1080px,100%);
  margin:56px auto;
  padding:clamp(28px,4vw,50px);
  display:grid;
  grid-template-columns:minmax(300px,.82fr) minmax(430px,1.18fr);
  gap:clamp(34px,5vw,76px);
  align-items:center;
  border:1px solid rgba(106,78,120,.10);
  border-radius:34px;
  background:
    radial-gradient(circle at 85% 18%,rgba(221,202,246,.48),transparent 34%),
    linear-gradient(135deg,rgba(255,255,255,.98),rgba(250,242,249,.92));
  box-shadow:0 26px 72px rgba(63,43,76,.08);
  overflow:hidden;
}
.detail-story>div{max-width:430px;justify-self:end}
.detail-story>div small{display:inline-flex;padding:5px 10px;border-radius:999px;background:#f4e8f2;color:#b45183;font-weight:900;letter-spacing:.08em}
.detail-story>div h2{margin:12px 0 14px;font:700 clamp(27px,2.6vw,38px)/1.35 var(--serif);letter-spacing:.01em}
.detail-story>div p{margin:0;color:#786c7f;font-size:14px;line-height:1.9}
.detail-story img{
  display:block;
  width:min(100%,520px);
  max-width:520px;
  height:auto;
  justify-self:start;
  padding:10px;
  border-radius:27px;
  background:rgba(255,255,255,.78);
  border:1px solid rgba(94,73,110,.12);
  box-shadow:0 22px 60px rgba(48,35,65,.14);
}
@media(max-width:900px){
  .detail-story{grid-template-columns:1fr;gap:26px;padding:28px;margin:38px auto}
  .detail-story>div{max-width:650px;justify-self:start}
  .detail-story img{width:min(100%,560px);max-width:560px;justify-self:center}
}
@media(max-width:620px){
  .detail-story{padding:20px 16px;border-radius:24px;margin:30px auto}
  .detail-story>div h2{font-size:26px}
  .detail-story>div p{font-size:13px}
  .detail-story img{width:100%;padding:7px;border-radius:20px}
}
`;

await fs.writeFile(cssFile, css);
console.log('people detail layout widened');
