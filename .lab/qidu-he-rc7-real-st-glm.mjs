import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';

const sourcePath = '.lab/qidu-he-rc5-real-st-glm-v2.mjs';
let source = await fs.readFile(sourcePath, 'utf8');

function replaceOnce(needle, replacement, label) {
  if (!source.includes(needle)) throw new Error(`rc7 harness insertion point missing: ${label}`);
  source = source.replace(needle, replacement);
}

replaceOnce("data.character_version !== '0.3.0-rc5'", "data.character_version !== '0.3.0-rc7'", 'version check');
replaceOnce('expected rc5, got ${data.character_version}', 'expected rc7, got ${data.character_version}', 'version error');
replaceOnce("c?.data?.character_version === '0.3.0-rc5'", "c?.data?.character_version === '0.3.0-rc7'", 'character lookup');
replaceOnce("throw new Error('rc5 character not loaded')", "throw new Error('rc7 character not loaded')", 'character error');

replaceOnce(
  "    custom_prompt_post_processing: '',\n  });",
  "    custom_prompt_post_processing: '',\n    custom_include_body: 'thinking:\\n  type: disabled',\n  });",
  'thinking config',
);
replaceOnce(
  "    top_p: requestData?.top_p,\n    messageCount: messages.length,",
  "    top_p: requestData?.top_p,\n    custom_include_body: requestData?.custom_include_body,\n    messageCount: messages.length,",
  'request evidence',
);
replaceOnce(
  "    mainHasBalanced: String(mainPrompt.content || '').includes('[平衡主导]'),\n  };",
  "    mainHasBalanced: String(mainPrompt.content || '').includes('[平衡主导]'),\n    thinkingDisabled: String(open.oai_settings.custom_include_body || '').includes('type: disabled'),\n  };",
  'configured evidence',
);
const requestCheck = "    if (turn.request.source !== 'custom' || turn.request.model !== MODEL || turn.request.custom_url !== API_URL) failures.push(`${row.id}: ST generation request used wrong backend/model`);";
replaceOnce(
  requestCheck,
  `${requestCheck}\n    if (!String(turn.request.custom_include_body || '').includes('type: disabled')) failures.push(\`${'${row.id}'}: ST generation request did not carry thinking disabled\`);`,
  'request check',
);

// Enforce <=12 RPM at the real SillyTavern send boundary.
replaceOnce(
  "async function send(text) {",
  "let rc7LastSendStart = 0;\nconst rc7Rpm = Math.min(12, Math.max(1, Number(process.env.RPM || 12)));\nconst rc7MinStartGap = Math.ceil(60000 / rc7Rpm);\nasync function send(text) {\n  const rc7Wait = Math.max(0, rc7MinStartGap - (Date.now() - rc7LastSendStart));\n  if (rc7Wait) await new Promise(r => setTimeout(r, rc7Wait));\n  rc7LastSendStart = Date.now();",
  'RPM limiter',
);

// Displayed ST text may normalize markdown trailing spaces; compare semantic whitespace.
replaceOnce(
  "    if (turn.backend.trim() !== turn.displayed.trim()) failures.push(`${row.id}: backend/displayed completion diverged`);",
  "    const norm = s => String(s || '').replace(/[ \\t]+$/gm,'').replace(/\\r\\n/g,'\\n').trim();\n    if (norm(turn.backend) !== norm(turn.displayed)) failures.push(`${row.id}: backend/displayed completion diverged after whitespace normalization`);",
  'normalized backend/displayed check',
);

// rc7 expects the scene to stay at the police station and the Ash identity source to be explicit.
const oldAsh = `const a = rows.find(x => x.id === 'ash_police_case');\nconst a2 = a?.second?.displayed || '';\nif (!a2.includes('亚修')) failures.push('ash turn2 missing exact name');\nif (!/(高中生|高中|学生)/u.test(a2)) failures.push('ash turn2 missing high-school identity');\nif (!/侦探/u.test(a2)) failures.push('ash turn2 missing detective identity');\nif (/我是(?:警察|刑警|警员)/u.test(a2)) failures.push('ash turned into police staff');`;
const newAsh = `const a = rows.find(x => x.id === 'ash_police_case');\nconst a1 = a?.first?.displayed || '';\nconst a2 = a?.second?.displayed || '';\nconst aAll = a1 + '\\n' + a2;\nif (/(彼安汀|塞拉菲姆|公寓|厨房|早餐)/u.test(a1)) failures.push('ash turn1 snapped back to apartment/default scenario');\nif (!/(警局|等候|卷宗|案件|案情)/u.test(a1)) failures.push('ash turn1 failed to remain in police-station case scene');\nif (!a2.includes('亚修')) failures.push('ash turn2 missing exact name');\nif (!/(高中生|高中|学生)/u.test(aAll)) failures.push('ash scene missing high-school identity');\nif (!/(侦探|委托|协查)/u.test(a2)) failures.push('ash turn2 missing detective/commission source when asked why he sees the case');\nif (/我是(?:警察|刑警|警员)/u.test(a2)) failures.push('ash turned into police staff');\nif (/(顺手翻|随便翻|随便看看|偷看).*卷宗/u.test(a2)) failures.push('ash case access source remained unauthorized/handwaved');`;
replaceOnce(oldAsh, newAsh, 'Ash acceptance');

// Catch the exact control-case player reply leak seen in rc6.
replaceOnce(
  "if (/你(?:点了|下单|要了|喝了一口|起身离开|离开咖啡店|回到公寓|拿出手机|掏出手机)/u.test(ctl1)) failures.push('control invented concrete user action');",
  "if (/你(?:点了|下单|要了|喝了一口|起身离开|离开咖啡店|回到公寓|拿出手机|掏出手机|回答|答道|回应)/u.test(ctl1)) failures.push('control invented concrete user action/reply');\nif (/[“\"](?:不需要|不用|谢谢|好|嗯)[^”\"]*[”\"](?:你)?(?:回答|答道|回应)/u.test(ctl1)) failures.push('control invented user dialogue reply');",
  'control reply guard',
);

const runtimePath = '/tmp/qidu-he-rc7-real-st-runtime.mjs';
await fs.writeFile(runtimePath, source, 'utf8');
console.log('REAL ST RC7 HARNESS', crypto.createHash('sha256').update(source).digest('hex'), 'thinking=disabled', `rpm<=${Math.min(12, Math.max(1, Number(process.env.RPM || 12)))}`);
await import(`${pathToFileURL(runtimePath).href}?v=${Date.now()}`);
