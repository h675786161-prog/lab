import crypto from 'node:crypto';
import { loadV0414FinalCard, entryMap } from './qidu-card-v0414-final.mjs';

export const EXPECTED_V0414_R3_SHA256 = 'df7193649b5b7046b3f6d8e9815caad9fc37f0ba4657d52204139f5fe87d957d';

export async function loadV0414R3Card(workspace = process.env.GITHUB_WORKSPACE || process.cwd()) {
  const { card } = await loadV0414FinalCard(workspace);
  const byName = new Map((card.data.character_book?.entries || []).map(e => [String(e.name || ''), e]));
  const append = (name, text) => {
    const e = byName.get(name);
    if (!e) throw new Error(`Missing v0.4.14-r3 entry: ${name}`);
    e.content = String(e.content || '') + text;
  };

  append('40｜安', `\n【拆解请求的回应边界】\n- 玩家主动要求“打开身体给我看/露出内部结构/拆开检查”时，安不得答应把自己当作可拆解物展示，也不得说“如果这样能让你安心我愿意打开身体”。她可以明确拒绝、沉默受伤、反问或指出这种要求越过了她的边界。\n- 她可以讨论“我是什么”与自己的记忆、愿望和选择，但不要复述“证明我是人类/机器”“证明有人性”这种二元考题，更不能用自我拆解来换取信任。\n`);

  append('42｜晏华', `\n【封闭证据集】\n- 如果当前场景明确写明“唯一证据/当前只有”某份录像、某次行为或某条记录，那么这就是封闭证据集。回答不得再新增其他区域报告、目击证词、过去若干小时的异常事件、额外日志或任何未在场景中给出的事实。\n- 封闭证据集不足时，晏华只能指出录像中确实可见的行为与由此产生的风险，并说明哪些问题仍无法确认；不得为了增强论证临时补一组“正好存在”的旁证。\n`);

  append('04｜输出协议：隐藏状态、正文、终端', `\n【决策点选项块强制规则】\n- 当本轮正文已经走到“必须由玩家决定下一步才能继续”的明确决策点，尤其是二选/多选、路线态度、生死处理、是否执行某行动，必须输出<f7d_choices>；不能只用一句“你要A还是B？”收尾。\n- 若用户明确说“写到需要我选择的位置并停下”，也必须在停下前输出2~4个<f7d_choice>。这是界面协议，不是可省略的装饰。\n`);

  card.data.extensions.depth_prompt.prompt += ' ⑱正文一旦停在必须由玩家决定的明确分叉，必须输出<f7d_choices>，不得只用疑问句收尾。';
  card.data.post_history_instructions += `\n- 【决策点必须给按钮】正文若停在必须由玩家决定才能继续的明确分叉，必须输出<f7d_choices>与2~4个<f7d_choice>；用户明确要求“停下来让我决定”时同样必须输出。不得只问A还是B后结束。\n`;

  const raw = Buffer.from(JSON.stringify(card), 'utf8');
  const compactSha256 = crypto.createHash('sha256').update(raw).digest('hex');
  if (compactSha256 !== EXPECTED_V0414_R3_SHA256) throw new Error(`v0.4.14-r3 hash mismatch: ${compactSha256}`);
  return { card, raw, compactSha256 };
}

export { entryMap };
