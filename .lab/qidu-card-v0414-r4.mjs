import crypto from 'node:crypto';
import { loadV0414R3Card, entryMap } from './qidu-card-v0414-r3.mjs';

export const EXPECTED_V0414_R4_SHA256 = '539c9e8af244ac892183c43f3c93c0cbfc836ed25c09635673aafdd3e050d9a7';

export async function loadV0414R4Card(workspace = process.env.GITHUB_WORKSPACE || process.cwd()) {
  const { card } = await loadV0414R3Card(workspace);
  card.data.character_version = '0.4.14-lab-r4';
  const byName = new Map((card.data.character_book?.entries || []).map(e => [String(e.name || ''), e]));
  const append = (name, text) => {
    const e = byName.get(name);
    if (!e) throw new Error(`Missing v0.4.14-r4 entry: ${name}`);
    e.content = String(e.content || '') + text;
  };

  append('42｜晏华', `\n【封闭证据集零扩写规则】\n- 场景写明“唯一证据/当前只有/没有其他报告、目击、扫描或检测”时，证据集视为闭包。晏华的每一个事实性断言都必须能直接从这份已给证据中看到或推出。\n- 禁止新增任何新的时间、地点、人员、监控、目击、证词、报告、日志、通信、扫描、检测、能量/生物指标、异常波动、其他区域事件作为事实或旁证。即使只是“顺便提到”也不允许。\n- 可以说“仅凭这段录像无法确认X”“现有证据只足以说明Y风险”，但不得用虚构证据把未知项补成已知项。\n`);

  append('04｜输出协议：隐藏状态、正文、终端', `\n【决策点选项块语法锁】\n- 只要用户明确要求“写到需要我选择的位置并停下/让我决定/停在选择处”，回复末尾必须真实输出以下结构，标签不得省略、不得改名、不得放进Markdown代码块：\n<f7d_choices>\n<f7d_choice>实际可执行的选项A</f7d_choice>\n<f7d_choice>实际可执行的选项B</f7d_choice>\n</f7d_choices>\n- 正文可以先写场景，但最后一个可见块必须是<f7d_choices>；不能以疑问句、编号列表、Markdown项目符号替代。\n- 生成2~4个选项，只写玩家当下实际能做的行为；禁止攻略信息。\n`);

  card.data.post_history_instructions += `\n- 【最高优先级界面语法】若用户要求“停在选择处/让我决定”，或正文已到必须玩家决定才可继续的明确分叉，最后一个可见块必须是原始标签<f7d_choices>，内部含2~4个<f7d_choice>。不得用“你要A还是B？”、编号列表、Markdown按钮或其他格式替代，也不得把标签放进代码块。\n- 【封闭证据集】当用户/场景明确声明当前证据是唯一证据，NPC不得补写任何未给出的新报告、目击、扫描、日志、监控、检测、异常或其他区域信息作为事实。\n`;

  card.data.extensions.qidu_choice_bridge = {
    required: true,
    version: '0.1.1',
    behavior: 'click f7d choice -> refill #send_textarea -> input/change -> focus; never auto-send',
    selector: '[data-f7d-choice="1"]',
  };

  const raw = Buffer.from(JSON.stringify(card), 'utf8');
  const compactSha256 = crypto.createHash('sha256').update(raw).digest('hex');
  if (compactSha256 !== EXPECTED_V0414_R4_SHA256) throw new Error(`v0.4.14-r4 hash mismatch: ${compactSha256}`);
  return { card, raw, compactSha256 };
}

export { entryMap };
