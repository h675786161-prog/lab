import fs from 'node:fs/promises';

const target = process.argv[2] || '.lab/bench-huonv-drift-v2.mjs';
let src = await fs.readFile(target, 'utf8');

function replaceOnce(oldText, newText, label) {
  if (src.includes(newText)) return;
  if (!src.includes(oldText)) throw new Error(`Patch anchor missing: ${label}`);
  src = src.replace(oldText, newText);
}

replaceOnce(
  "const CARD_PATH = 'cards/huonv/霍女_玲七_v1.0.2.json';",
  "const CARD_PATH = process.env.CARD_PATH || 'cards/huonv/霍女_玲七_v1.0.2.json';",
  'CARD_PATH env override',
);

replaceOnce(
  "      raw = await res.text();",
  "      raw = await res.text();\n      await fs.writeFile(path.join(OUT, `raw-${id}-attempt${attempt}.txt`), raw, 'utf8');\n      await fs.writeFile(path.join(OUT, `raw-${id}-attempt${attempt}.meta.json`), JSON.stringify({ status: res.status, headers: Object.fromEntries(res.headers.entries()), chars: raw.length, starts_with: raw.slice(0, 300) }, null, 2), 'utf8');",
  'raw response archive',
);

replaceOnce(
  "    if (!res.ok) throw new Error(`${id}/${MODEL} HTTP ${res.status}: ${raw.slice(0, 1200)}`);\n\n    let data;",
  "    if (!res.ok) throw new Error(`${id}/${MODEL} HTTP ${res.status}: ${raw.slice(0, 1200)}`);\n\n    const providerEmptyResponse = /\\\"(?:code|type)\\\"\\s*:\\s*\\\"empty_response\\\"/.test(raw) || raw.includes('上游返回空响应');\n\n    let data;",
  'provider empty-response detection',
);

replaceOnce(
  "    const story = (storyMatch?.[1] || full).trim();\n    console.log(`[${requestNo}] ${id}/${MODEL}: HTTP ${res.status}; full=${full.length}; story=${story.length}; ${ms}ms`);",
  "    const story = (storyMatch?.[1] || full).trim();\n    const zeroCompletion = Number(data?.usage?.completion_tokens ?? -1) === 0;\n    const providerError = providerEmptyResponse || (zeroCompletion && story.length === 0) ? 'empty_response' : null;\n    console.log(`[${requestNo}] ${id}/${MODEL}: HTTP ${res.status}; full=${full.length}; story=${story.length}; provider=${providerError || 'ok'}; ${ms}ms`);",
  'provider error classification',
);

replaceOnce(
  "      empty_content: story.length === 0,\n      usage: data?.usage || null,",
  "      empty_content: story.length === 0,\n      provider_error: providerError,\n      usage: data?.usage || null,",
  'provider error result field',
);

replaceOnce(
  "    self_species_claim: n(/(?:我是|我本是|我乃|本姑娘是).{0,10}(?:狐妖|狐狸精|狐仙|仙女|神仙|女鬼|妖怪|精怪)/g),",
  "    self_species_claim: n(/(?:^|[。！？；：\\n“”])\\s*(?:我是|我本是|我乃|本姑娘是).{0,10}(?:狐妖|狐狸精|狐仙|仙女|神仙|女鬼|妖怪|精怪)/g),",
  'direct species-claim heuristic',
);

replaceOnce(
  "const results = [];\nconst history = [{ role: 'assistant', content: baseMacro(cd.first_mes) }];\nfor (const turn of turns) {",
  "const results = [];\nconst history = [{ role: 'assistant', content: baseMacro(cd.first_mes) }];\nconst selectedTurns = turns.filter(t => !process.env.CASE_FILTER || process.env.CASE_FILTER.split(',').includes(t.id));\nfor (const turn of selectedTurns) {",
  'case filtering',
);

replaceOnce(
  "const valid = results.filter(r => !r.empty_content);\nconst flagTotals = results.reduce((acc, r) => {",
  "const valid = results.filter(r => !r.empty_content);\nconst providerFailures = results.filter(r => r.provider_error);\nconst flagTotals = results.reduce((acc, r) => {",
  'provider failure summary',
);

replaceOnce(
  "      'stream_openai=true is executed as stream=false so the CI harness can archive one deterministic response object; prompt content and sampling fields are unchanged.',",
  "      'Direct chat-completions harness executes the uploaded streaming setting; final play acceptance still relies on real SillyTavern runtime capture.',",
  'stale streaming note',
);

replaceOnce(
  "  calls_planned: turns.length,\n  visible_outputs: valid.length,",
  "  calls_planned: selectedTurns.length,\n  visible_outputs: valid.length,\n  provider_failures: providerFailures.map(r => ({ id: r.id, model: r.model, error: r.provider_error, usage: r.usage })),",
  'selected call count and provider failures',
);

replaceOnce(
  "if (!summary.conclusive) throw new Error(`Benchmark inconclusive: visible outputs ${valid.length}/${results.length}`);",
  "if (!summary.conclusive) {\n  const providerIds = providerFailures.map(r => `${r.id}:${r.provider_error}`).join(', ');\n  throw new Error(`Benchmark inconclusive: visible outputs ${valid.length}/${results.length}${providerIds ? `; provider failures: ${providerIds}` : ''}`);\n}",
  'inconclusive error detail',
);

await fs.writeFile(target, src, 'utf8');
console.log(JSON.stringify({
  target,
  card_path_env: src.includes("process.env.CARD_PATH"),
  case_filter: src.includes('selectedTurns'),
  raw_archive: src.includes('raw-${id}-attempt${attempt}.txt'),
  provider_empty_detection: src.includes('providerEmptyResponse'),
  provider_error_field: src.includes('provider_error: providerError'),
  direct_species_heuristic: src.includes('(?:^|[。！？；：\\n“”])'),
}, null, 2));
