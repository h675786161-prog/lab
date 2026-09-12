import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';

const sourcePath = '.lab/qidu-he-rc5-real-st-glm-v2.mjs';
let source = await fs.readFile(sourcePath, 'utf8');

const configNeedle = "    custom_prompt_post_processing: '',\n  });";
const configReplacement = "    custom_prompt_post_processing: '',\n    custom_include_body: 'thinking:\\n  type: disabled',\n  });";
if (!source.includes(configNeedle)) throw new Error('v2 config insertion point missing');
source = source.replace(configNeedle, configReplacement);

const evidenceNeedle = "    top_p: requestData?.top_p,\n    messageCount: messages.length,";
const evidenceReplacement = "    top_p: requestData?.top_p,\n    custom_include_body: requestData?.custom_include_body,\n    messageCount: messages.length,";
if (!source.includes(evidenceNeedle)) throw new Error('v2 request-evidence insertion point missing');
source = source.replace(evidenceNeedle, evidenceReplacement);

const configuredNeedle = "    mainHasBalanced: String(mainPrompt.content || '').includes('[平衡主导]'),\n  };";
const configuredReplacement = "    mainHasBalanced: String(mainPrompt.content || '').includes('[平衡主导]'),\n    thinkingDisabled: String(open.oai_settings.custom_include_body || '').includes('type: disabled'),\n  };";
if (!source.includes(configuredNeedle)) throw new Error('v2 configured-evidence insertion point missing');
source = source.replace(configuredNeedle, configuredReplacement);

const requestCheckNeedle = "    if (turn.request.source !== 'custom' || turn.request.model !== MODEL || turn.request.custom_url !== API_URL) failures.push(`${row.id}: ST generation request used wrong backend/model`);";
const requestCheckReplacement = `${requestCheckNeedle}\n    if (!String(turn.request.custom_include_body || '').includes('type: disabled')) failures.push(\`${'${row.id}'}: ST generation request did not carry thinking disabled\`);`;
if (!source.includes(requestCheckNeedle)) throw new Error('v2 request-check insertion point missing');
source = source.replace(requestCheckNeedle, requestCheckReplacement);

const runtimePath = '/tmp/qidu-he-rc5-real-st-glm-v3-runtime.mjs';
await fs.writeFile(runtimePath, source, 'utf8');
console.log('REAL ST V3 HARNESS', crypto.createHash('sha256').update(source).digest('hex'), 'thinking=disabled');
await import(`${pathToFileURL(runtimePath).href}?v=${Date.now()}`);
