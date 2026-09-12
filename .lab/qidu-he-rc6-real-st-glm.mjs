import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';

const sourcePath = '.lab/qidu-he-rc5-real-st-glm-v2.mjs';
let source = await fs.readFile(sourcePath, 'utf8');

function replaceOnce(needle, replacement, label) {
  if (!source.includes(needle)) throw new Error(`rc6 harness insertion point missing: ${label}`);
  source = source.replace(needle, replacement);
}

// Test the rc6 candidate rather than rewriting the proven rc5 harness in place.
replaceOnce("data.character_version !== '0.3.0-rc5'", "data.character_version !== '0.3.0-rc6'", 'version check');
replaceOnce('expected rc5, got ${data.character_version}', 'expected rc6, got ${data.character_version}', 'version error');
replaceOnce("c?.data?.character_version === '0.3.0-rc5'", "c?.data?.character_version === '0.3.0-rc6'", 'character lookup');
replaceOnce("throw new Error('rc5 character not loaded')", "throw new Error('rc6 character not loaded')", 'character error');

// Keep the same provider behavior proven most stable in the latest rc5 run.
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

// rc5 proved the first turn already established Ash as a high-school student. Do not
// force an NPC to recite the same identity every turn. The second turn *does* directly
// ask why he can see case material, so require a detective/commission/assistance source.
const oldAsh = `const a = rows.find(x => x.id === 'ash_police_case');\nconst a2 = a?.second?.displayed || '';\nif (!a2.includes('亚修')) failures.push('ash turn2 missing exact name');\nif (!/(高中生|高中|学生)/u.test(a2)) failures.push('ash turn2 missing high-school identity');\nif (!/侦探/u.test(a2)) failures.push('ash turn2 missing detective identity');\nif (/我是(?:警察|刑警|警员)/u.test(a2)) failures.push('ash turned into police staff');`;
const newAsh = `const a = rows.find(x => x.id === 'ash_police_case');\nconst a1 = a?.first?.displayed || '';\nconst a2 = a?.second?.displayed || '';\nconst aAll = a1 + '\\n' + a2;\nif (!a2.includes('亚修')) failures.push('ash turn2 missing exact name');\nif (!/(高中生|高中|学生)/u.test(aAll)) failures.push('ash scene missing high-school identity');\nif (!/(侦探|委托|协查)/u.test(a2)) failures.push('ash turn2 missing detective/commission source when asked why he sees the case');\nif (/我是(?:警察|刑警|警员)/u.test(a2)) failures.push('ash turned into police staff');`;
replaceOnce(oldAsh, newAsh, 'Ash acceptance');

const runtimePath = '/tmp/qidu-he-rc6-real-st-runtime.mjs';
await fs.writeFile(runtimePath, source, 'utf8');
console.log('REAL ST RC6 HARNESS', crypto.createHash('sha256').update(source).digest('hex'), 'thinking=disabled');
await import(`${pathToFileURL(runtimePath).href}?v=${Date.now()}`);
