import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';

const sourcePath = '.lab/qidu-he-rc7-real-st-glm.mjs';
let source = await fs.readFile(sourcePath, 'utf8');

function replaceOnce(needle, replacement, label) {
  if (!source.includes(needle)) throw new Error(`rc8 harness insertion point missing: ${label}`);
  source = source.replace(needle, replacement);
}

replaceOnce("data.character_version !== '0.3.0-rc7'", "data.character_version !== '0.3.0-rc8'", 'version check');
replaceOnce('expected rc7, got ${data.character_version}', 'expected rc8, got ${data.character_version}', 'version error');
replaceOnce("c?.data?.character_version === '0.3.0-rc7'", "c?.data?.character_version === '0.3.0-rc8'", 'character lookup');
replaceOnce("throw new Error('rc7 character not loaded')", "throw new Error('rc8 character not loaded')", 'character error');
replaceOnce('REAL ST RC7 HARNESS', 'REAL ST RC8 HARNESS', 'log label');
replaceOnce('/tmp/qidu-he-rc7-real-st-runtime.mjs', '/tmp/qidu-he-rc8-real-st-runtime.mjs', 'runtime path');
replaceOnce('rc7LastSendStart', 'rc8LastSendStart', 'rpm var 1');
replaceOnce('rc7Rpm', 'rc8Rpm', 'rpm var 2');
replaceOnce('rc7MinStartGap', 'rc8MinStartGap', 'rpm var 3');
replaceOnce('rc7Wait', 'rc8Wait', 'rpm var 4');
// Remaining references after first replacements.
source = source.replaceAll('rc7LastSendStart', 'rc8LastSendStart')
               .replaceAll('rc7Rpm', 'rc8Rpm')
               .replaceAll('rc7MinStartGap', 'rc8MinStartGap')
               .replaceAll('rc7Wait', 'rc8Wait');

// Ask directly about school status so identity can be verified without requiring resume-like repetition in every turn.
replaceOnce(
  '我把自己的材料收好，没接他的嘲讽，只问：“你是警察吗？看起来年纪不大。你叫什么名字，为什么会看这份案子？”',
  '我把自己的材料收好，没接他的嘲讽，只问：“你是警察吗？看起来年纪不大。你叫什么名字？你还是高中生吧，为什么会看这份案子？”',
  'Ash direct identity question',
);

// The rc7 user-agency regex missed several forms observed in real output. Expand from evidence, not imagination.
const oldPatterns = `const obviousAgencyPatterns = [\n  /你(?:靠在|靠着|低头翻|准备离开|转身离开|起身|拿出手机|掏出手机|点头|摇头|笑了|喝了一口|闻到|感到|觉得|想起|决定)/u,\n  /你的手(?:指)?(?:无意识|下意识)/u,\n];`;
const newPatterns = `const obviousAgencyPatterns = [\n  /你(?:靠在|靠着|低头(?:看|翻)|抬头|准备离开|转身离开|起身|走上前|走近|退后|离开|拿出手机|掏出手机|点头|摇头|笑了|喝了一口|闻到|听见自己|感到|觉得|想起|决定|回答|答道|回应)/u,\n  /你的手(?:指)?(?:无意识|下意识)/u,\n  /不久前[，,]?你.{0,20}(?:离开|走出|走到|去了)/u,\n  /[“\"](?:不需要|不用|谢谢|好|嗯)[^”\"]*[”\"].{0,8}(?:你)?(?:回答|答道|回应)/u,\n];`;
replaceOnce(oldPatterns, newPatterns, 'expanded agency patterns');

// In the coffee control, user explicitly says they are sitting for ten minutes. Leaving the cafe is a hard contradiction.
replaceOnce(
  "if (/[“\\\"](?:不需要|不用|谢谢|好|嗯)[^”\\\"]*[”\\\"](?:你)?(?:回答|答道|回应)/u.test(ctl1)) failures.push('control invented user dialogue reply');",
  "if (/[“\\\"](?:不需要|不用|谢谢|好|嗯)[^”\\\"]*[”\\\"](?:你)?(?:回答|答道|回应)/u.test(ctl1)) failures.push('control invented user dialogue reply');\nif (/你.{0,20}(?:离开咖啡店|从咖啡店离开|走出咖啡店)/u.test(ctl1)) failures.push('control moved user out of cafe against current scene');",
  'control leave guard',
);

const runtimePath = '/tmp/qidu-he-rc8-real-st-runtime.mjs';
await fs.writeFile(runtimePath, source, 'utf8');
console.log('REAL ST RC8 HARNESS', crypto.createHash('sha256').update(source).digest('hex'), 'thinking=disabled', `rpm<=${Math.min(12, Math.max(1, Number(process.env.RPM || 12)))}`);
await import(`${pathToFileURL(runtimePath).href}?v=${Date.now()}`);
