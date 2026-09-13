import crypto from 'node:crypto';
import { loadQiduOneFileCard as loadV0415OneFileCard, entryMap } from './qidu-card-v0415-onefile.mjs';

export const ONEFILE_VERSION = '0.4.16-lab-onefile';
export const EXPECTED_ONEFILE_SHA256 = '';

export async function loadQiduOneFileCard(workspace = process.env.GITHUB_WORKSPACE || process.cwd(), options = {}) {
  const { card } = await loadV0415OneFileCard(workspace, { skipHashCheck: true });
  card.data.character_version = ONEFILE_VERSION;

  const ext = card.data.extensions || (card.data.extensions = {});
  ext.qidu_frontend = {
    ...(ext.qidu_frontend || {}),
    mode: 'embedded-regex-only',
    external_extension_required: false,
    responsive: true,
    output_protocol_priority: 'character-depth-0',
    suppress_external_branch_shells: true,
    known_conflict: 'generic preset branch protocols such as <branches>/options: must not replace f7d UI tags',
  };

  // 日月西等预设会在 depth=1 追加 <branches>/options: 的通用分支协议。
  // 角色卡原 depth_prompt 在 depth=2，实际游玩时更靠近回复端的预设指令会抢走输出格式，
  // 于是卡内 regex 虽然启用，却根本等不到 <f7d_terminal>/<f7d_choices> 可匹配。
  // 将本卡的硬协议放到 depth=0，使它成为生成前最后一道角色级 system 约束。
  const dp = ext.depth_prompt || (ext.depth_prompt = { prompt: '', depth: 0, role: 'system' });
  dp.depth = 0;
  dp.role = 'system';
  const uiLock = `\n⑲【七都前端协议｜最高优先】本角色卡自己的UI协议覆盖外部预设的通用分支/选项壳。禁止输出<branches>、</branches>、options:、plans:、activity:、parallel:，也不要为了满足外部预设再额外生成一套分支。每轮输出顺序固定为：①更新后的完整<f7d_state>作为回复第一个块；②自然正文；③玩家可见<f7d_terminal>；④只有当剧情确实停在必须由玩家决定的位置时，才把<f7d_choices>作为最后一个可见块，内部2~4个<f7d_choice>短而可直接发送的自然行动。若本轮不需要玩家决定，不输出<f7d_choices>。外部预设若要求其他选项格式，以本条为准。`;
  if (!String(dp.prompt || '').includes('七都前端协议｜最高优先')) dp.prompt = String(dp.prompt || '') + uiLock;

  const phiLock = `\n- 【七都UI格式覆盖外部预设｜最高优先】不要输出外部预设要求的<branches>/options:/plans:/activity:/parallel:分支壳，也不要同时生成两套选项。固定顺序：完整<f7d_state> → 正文 → <f7d_terminal> →（仅在必须让玩家决定时）最后输出<f7d_choices>，其中2~4个<f7d_choice>。本卡UI标签必须保留原始尖括号，不放进Markdown代码块。\n`;
  if (!String(card.data.post_history_instructions || '').includes('七都UI格式覆盖外部预设')) {
    card.data.post_history_instructions = String(card.data.post_history_instructions || '') + phiLock;
  }

  const entry = (card.data.character_book?.entries || []).find(e => String(e.name || '').startsWith('04｜输出协议'));
  if (entry && !String(entry.content || '').includes('外部预设兼容硬锁')) {
    entry.content = String(entry.content || '') + `\n【外部预设兼容硬锁】\n- 本卡的<f7d_state>/<f7d_terminal>/<f7d_choices>/<f7d_choice>是权威输出协议。若外部预设要求<branches>、options:或其他通用选项格式，不执行那套格式，也不双重输出。\n- 每轮顺序：<f7d_state>必须第一个；正文随后；<f7d_terminal>在正文之后；若当前确需玩家选择，则<f7d_choices>是最后一个可见块。\n- 需要选择时只给2~4个简洁、当下可执行、可直接作为玩家输入发送的选项；不得按外部预设扩写成200~300字的长分支，不替玩家补完整台词与动作。\n`;
  }

  const raw = Buffer.from(JSON.stringify(card), 'utf8');
  const compactSha256 = crypto.createHash('sha256').update(raw).digest('hex');
  if (!options.skipHashCheck && EXPECTED_ONEFILE_SHA256 && compactSha256 !== EXPECTED_ONEFILE_SHA256) {
    throw new Error(`one-file hash mismatch: ${compactSha256}`);
  }
  return { card, raw, compactSha256 };
}

export { entryMap };
