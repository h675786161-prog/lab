import fs from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';

const parts = [
  '.lab/preset-three-person-13.active.part1a.b64',
  '.lab/preset-three-person-13.active.part1b.b64',
  '.lab/preset-three-person-13.active.part1c.b64',
  '.lab/preset-three-person-13.active.part1d.b64',
  '.lab/preset-three-person-13.active.part2.b64',
  '.lab/preset-three-person-13.active.part3.b64',
  '.lab/preset-three-person-13.active.part4.b64',
];
const packed = (await Promise.all(parts.map(p => fs.readFile(p, 'utf8')))).join('').replace(/\s+/g, '');
const compact = JSON.parse(gunzipSync(Buffer.from(packed, 'base64')).toString('utf8'));
if (compact.source !== '三人逆行13·复调长卷.json') throw new Error(`wrong source: ${compact.source}`);
if (!Array.isArray(compact.prompts) || compact.prompts.length !== 100) throw new Error(`expected 100 enabled prompts, got ${compact.prompts?.length}`);

const nullInjection = new Set(['main','nsfw','dialogueExamples','chatHistory','enhanceDefinitions']);
const systemPrompt = new Set(['main','nsfw','personaDescription','worldInfoBefore','charDescription','charPersonality','worldInfoAfter','scenario','dialogueExamples','chatHistory','enhanceDefinitions']);

const prompts = compact.prompts.map(row => {
  const [identifier, name, role, content, marker] = row;
  return {
    identifier,
    name,
    enabled: true,
    injection_position: identifier === 'prism-style-depth2' ? 1 : (nullInjection.has(identifier) ? null : 0),
    injection_depth: identifier === 'prism-style-depth2' ? 2 : (nullInjection.has(identifier) ? null : 4),
    injection_order: nullInjection.has(identifier) ? null : 100,
    role: role || 'system',
    content: content || '',
    system_prompt: systemPrompt.has(identifier),
    marker: Boolean(marker),
    forbid_overrides: false,
  };
});

const preset = {
  temperature: 1,
  frequency_penalty: 0,
  presence_penalty: 0,
  top_p: 0.98,
  top_k: 64,
  top_a: 0,
  min_p: 0,
  repetition_penalty: 1,
  max_context_unlocked: true,
  tool_reasoning_mode: 'disabled',
  openai_max_context: 2000000,
  openai_max_tokens: 30000,
  names_behavior: 0,
  send_if_empty: '',
  impersonation_prompt: '',
  new_chat_prompt: '这是一个故事的开始',
  new_group_chat_prompt: '',
  new_example_chat_prompt: '',
  continue_nudge_prompt: '',
  bias_preset_selected: 'Default (none)',
  wi_format: '{0}',
  scenario_format: '{{scenario}}',
  personality_format: '{{personality}}',
  group_nudge_prompt: '',
  stream_openai: true,
  prompts,
  prompt_order: [{ character_id: 100001, order: prompts.map(p => ({ identifier: p.identifier, enabled: true })) }],
  assistant_prefill: '',
  assistant_impersonation: '',
  use_sysprompt: true,
  squash_system_messages: false,
  media_inlining: false,
  inline_image_quality: 'auto',
  continue_prefill: false,
  continue_postfix: ' ',
  function_calling: false,
  tool_call_recurse_limit: 5,
  show_thoughts: true,
  reasoning_effort: 'auto',
  verbosity: 'auto',
  enable_web_search: false,
  seed: -1,
  n: 1,
  request_images: false,
  request_image_aspect_ratio: '',
  request_image_resolution: '',
  extensions: {},
};

const out = process.argv[2] || '/tmp/三人逆行13_核心启用项_ST.json';
await fs.writeFile(out, JSON.stringify(preset, null, 2), 'utf8');
console.log(JSON.stringify({ out, enabled_prompts: prompts.length, stream_openai: preset.stream_openai, note: 'core active prompts only; preset extension payload intentionally omitted in isolated base-ST capture' }));
