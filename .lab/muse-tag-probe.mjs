// Isolated, public-safe Muse tag-format probe. Does not include private/user presets.
// Offline by default; live requires explicit, separate opt-in.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

const TAGS = ['electric', 'think', 'thinking'];
const TITLES = [
  '角色与任务', '演绎权限', '输入分析', '世界与连续性', '人物动机',
  '文字风格', '情感与尺度', '细节点缀', '格式校准', '下一幕规划', '顺序复核',
];
const OUT_DIR = process.env.LAB_EVIDENCE_DIR || 'lab-evidence-muse';
const args = new Set(process.argv.slice(2));
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function readStructure(raw, tag) {
  const text = String(raw || '');
  const open = '<' + tag + '>';
  const close = '</' + tag + '>';
  const start = text.indexOf(open);
  const end = start < 0 ? -1 : text.indexOf(close, start + open.length);
  const contentAt = text.indexOf('<content>');
  const errors = [];
  if (start < 0) errors.push('missing_open');
  if (end < 0) errors.push('missing_close');
  if (contentAt < 0) errors.push('missing_content');
  if (start >= 0 && start > 0 && text.slice(0, start).trim()) errors.push('unexpected_prefix');
  if (start >= 0 && contentAt >= 0 && contentAt < start) errors.push('content_before_plan');
  if (end >= 0 && contentAt >= 0 && contentAt < end) errors.push('premature_content');
  const plan = start >= 0 && end >= 0 ? text.slice(start + open.length, end) : '';
  const entries = [...plan.matchAll(/(?:^|\n)\s*(?:#{1,3}\s*)?Vol[.\s]*(\d{1,2})(?:\s|[:：]|$)/g)].map(m => Number(m[1]));
  const expected = Array.from({ length: 11 }, (_, i) => i + 1);
  if (JSON.stringify(entries) !== JSON.stringify(expected)) errors.push('vols_missing_duplicate_or_out_of_order');
  if (end >= 0 && contentAt >= 0 && contentAt < end + close.length) errors.push('content_inside_plan');
  if (contentAt >= 0 && !text.includes('</content>')) errors.push('missing_content_close');
  return { pass: errors.length === 0, errors, vols: entries, plan_characters: plan.length };
}

function fixture(tag, endAt = 11) {
  const plan = TITLES.slice(0, endAt).map((t, i) => 'Vol.' + (i + 1) + ' ' + t + '\n给出当前剧情的一句话可见规划。').join('\n\n');
  return '<' + tag + '>\n' + plan + '\n</' + tag + '>\n\n<content>\n沈岚把忘拿叉子的泡面盖子又盖了回去。\n</content>';
}

function offline() {
  const checks = [];
  for (const tag of TAGS) {
    const good = readStructure(fixture(tag), tag);
    assert.equal(good.pass, true, 'valid ' + tag + ': ' + good.errors);
    checks.push({ tag, case: 'valid_11_vols', pass: true });
    const broken = fixture(tag, 5);
    const incomplete = readStructure(broken, tag);
    assert.equal(incomplete.pass, false, 'missed premature content for ' + tag);
    checks.push({ tag, case: 'early_after_vol_5_rejected', pass: true });
    const missingClose = readStructure(fixture(tag).replace('</' + tag + '>', ''), tag);
    assert.equal(missingClose.pass, false, 'missed unclosed tag for ' + tag);
    checks.push({ tag, case: 'unclosed_tag_rejected', pass: true });
    const double = readStructure(fixture(tag).replace('Vol.11', 'Vol.10'), tag);
    assert.equal(double.pass, false, 'missed duplicate Vol for ' + tag);
    checks.push({ tag, case: 'duplicated_vol_rejected', pass: true });
  }
  return checks;
}

function promptFor(tag) {
  const titles = TITLES.map((x, i) => 'Vol.' + (i + 1) + ' ' + x).join('\n');
  return [
    {
      role: 'system',
      content: '你要进行公开可见的小说写作规划。这不是内部推理，也不要求提供隐藏思维链。必须先输出完整的11条可见剧情规划，每条用一句实在的场景决定，不要跳过或重复。11条全部结束后才可输出正文。不能把正文塞进规划标签。只输出要求的格式。',
    },
    {
      role: 'user',
      content: '短篇场景：周三中午，31岁的沈岚在办公室茶水间发现泡面没有叉子，朋友林遥刚推门进来。写一段80～150字的平实剧情，不代理林遥的下一步决定。\n使用这个唯一的输出协议：\n<' + tag + '>\n' + titles + '\n</' + tag + '>\n<content>\n正文\n</content>\n每个Vol都必须有一句具体规划，禁止直接复制标题后跳正文。',
    },
  ];
}

function completionUrl(base) {
  if (!base || !base.startsWith('https://')) throw new Error('MUSE_API_BASE must be an HTTPS URL');
  return base.replace(/\/+$/, '').endsWith('/chat/completions')
    ? base.replace(/\/+$/, '')
    : base.replace(/\/+$/, '') + '/chat/completions';
}

async function live() {
  const explicit = process.env.MUSE_LIVE_CONSENT === '1';
  const key = process.env.MUSE_API_KEY || '';
  const base = process.env.MUSE_API_BASE || '';
  const model = process.env.MUSE_MODEL || '';
  if (!explicit || !key || !base || !model) return { skipped: true, reason: 'explicit_opt_in_or_provider_configuration_missing', requests: 0 };
  const url = completionUrl(base);
  const reports = [];
  // Deliberately 65 seconds AFTER each completed request. No concurrency or automatic retries.
  for (const [i, tag] of TAGS.entries()) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 75_000);
    let result = { tag, request_number: i + 1 };
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          model,
          messages: promptFor(tag),
          temperature: 0.7,
          top_p: 0.9,
          max_tokens: 2800,
          stream: false,
        }),
      });
      result.http_status = response.status;
      const raw = await response.text();
      let data = {};
      try { data = JSON.parse(raw); } catch {}
      if (!response.ok) {
        result.pass = false;
        result.error_class = response.status === 429 ? 'rate_limited' : 'http_error';
        reports.push(result);
        // 429 and all errors are terminal. No retries, no more calls.
        break;
      }
      const choice = data?.choices?.[0] || {};
      const body = typeof choice?.message?.content === 'string' ? choice.message.content : '';
      const evaluation = readStructure(body, tag);
      result = { ...result, ...evaluation, finish_reason: choice.finish_reason || null,
        usage: data.usage ? {
          prompt_tokens: data.usage.prompt_tokens ?? null,
          completion_tokens: data.usage.completion_tokens ?? null,
        } : null };
      reports.push(result);
      // Do not save raw responses to public artifacts.
    } catch (error) {
      result.pass = false;
      result.error_class = error?.name === 'AbortError' ? 'timeout' : 'network_error';
      reports.push(result);
      break;
    } finally {
      clearTimeout(timer);
    }
    if (i < TAGS.length - 1) await sleep(65_000);
  }
  return { skipped: false, requests: reports.length, reports, live_model_name: 'redacted' };
}

await fs.mkdir(OUT_DIR, { recursive: true });
const checks = offline();
const result = {
  title: 'Muse visible story-planning tags | LAB isolated',
  generated_at: new Date().toISOString(),
  offline_checks: checks,
  offline_status: checks.every(x => x.pass) ? 'pass' : 'fail',
  rpm_limit_assumed: 2,
  min_wait_between_completed_requests_seconds: 65,
  live: args.has('--live') ? await live() : { skipped: true, reason: 'offline_only', requests: 0 },
};
await fs.writeFile(path.join(OUT_DIR, 'muse-tag-probe.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ offline_status: result.offline_status, check_count: checks.length, live: result.live }, null, 2));
