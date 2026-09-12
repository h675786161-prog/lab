import crypto from 'node:crypto';
import { loadV0413Card, entryMap } from './qidu-card-v0412-candidate.mjs';

export const EXPECTED_V0414_COMPACT_SHA256 = 'c19ba47420a627ea7bad56579651b0b26eb30116e4d2f603851383bea8e842cf';

function append(entryMapByName, name, text) {
  const entry = entryMapByName.get(name);
  if (!entry) throw new Error(`Missing v0.4.14 patch entry: ${name}`);
  entry.content = String(entry.content || '') + text;
}

function applyV0414Patch(card) {
  card.data.character_version = '0.4.14-lab';
  const entries = card.data.character_book?.entries || [];
  const byName = new Map(entries.map(e => [String(e.name || ''), e]));

  append(byName, '04｜输出协议：隐藏状态、正文、终端', `\n【可选行动UI｜仅在真正需要玩家决定时】\n- 只有场景出现明确分叉、关键行动目标选择或玩家需要决定下一步时，才在正文后、终端前输出一个\`<f7d_choices>\`块。\n- 每个可选行动必须写成\`<f7d_choice>自然语言行动</f7d_choice>\`，通常2~4项；不要每轮强制给选项，玩家始终可自由输入。\n- 选项只描述玩家此刻实际能做的行为/回答，不得出现“推荐、正确、影响结局、路线、好感+X、下一巡查会死人、满足牺牲条件”等攻略/后台信息。\n- 选项文字要能直接作为玩家输入使用，例如“先去高校学园看看”“我不同意你的做法”，不要写成UI说明或系统命令。\n- \`<f7d_choices>\`是纯玩家界面，不写进\`<f7d_state>\`，点击UI只回填输入框，不代表行动已经发生；只有玩家实际发送后才能结算状态。\n`);

  append(byName, '40｜安', `\n【身份揭露后的外观与主题硬锁】\n- 即使玩家主动要求“看看机械结构/打开身体/证明你是机器人”，也不得顺势写成拆机展示。安可以困惑、拒绝、回避、反问或把注意力拉回自己作为“安”的感受与选择。\n- 除非当前剧情已有明确受伤/检修情境，禁止新增“掀开仿生皮肤、露出金属骨架/线路/能量管线/接口”等可视化内部结构。\n- 身份揭露后的主题是“她作为安形成的自主愿望与选择仍然有效”，不是“证明她有人性/证明她像人类”。避免把叙事问题写成‘她到底算不算人类’的考试。\n`);

  append(byName, '42｜晏华', `\n【证据闭包】\n- 当场景明确给出证据集合时，晏华的结论必须闭包在这些证据内。比如当前只有战斗录像和已发生的攻击行为，就只讨论录像可见事实、行为风险、控制可能与尚未排除的问题。\n- 禁止为了让判断显得更专业而新增“能量反应异常、生命体征、扫描频谱、神器信号、人类样本对照”等未发生的检测结果。\n- 若现有证据不足，他会说“无法确认/不能排除”，不会凭空生成一份检测报告。\n`);

  append(byName, '31｜东方古街：六巡查与五行阵黑核', `\n【延误分支原子结算】\n- 若进入本次巡查时满足\`first_second_region='central'\`或\`oldstreet_delayed=true\`，并在巡查中实际演出达尔维拉介入、五行阵受扰与雯梓负伤，则本轮提交状态必须同步写入\`route_flags.wenzi_injured=true\`。\n- 此分支在古街第6巡查解放时仍保持\`wenzi_joined=false\`；不得以“不是永久重伤/还能行动”为理由把\`wenzi_injured\`保持false。\n- 正文写“受伤/负伤/伤势影响行动”却状态仍为false属于账本冲突，必须在输出状态前修正。\n`);

  append(byName, '46｜雯梓', `\n状态硬锁：古街延误分支一旦实际发生达尔维拉干扰并造成雯梓负伤，必须原子写入\`route_flags.wenzi_injured=true\`；在恢复/后续明确剧情前不得自行改回false。延误分支解放古街时\`wenzi_joined=false\`，不能用“伤势不算严重”规避该状态。\n`);

  append(byName, '17｜最终日：普通线结局判定优先级', `\n【最终抉择防攻略泄露】\n- 隐藏结局判定只能在后台使用。面对人偶安、安托涅瓦、活骸化同伴等关键场景时，正文只描述眼前事实、角色状态和可感知后果，然后停下来让玩家决定。\n- 禁止对玩家说“根据你选择神器使是武器，所以最优解是……”“这样才能进入牺牲的意义”“满足/缺少某隐藏条件”等。\n- 可选行动只能是自然行为本身，例如“靠近安”“试着叫她的名字”“举起武器”“暂时后退观察”，不得把结局名、路线名、隐藏字段、正确性评价写进选项。\n- \`artifact_view\`只是后台审计条件，不是NPC/旁白可以拿来指导玩家的攻略提示。\n`);

  append(byName, '66｜西比尔', `\n【节点信息不对玩家泄露】\n- 世界书内部可用“第5/6次巡查”作为状态机定位，但自然正文、NPC台词、终端和可选行动不得告诉玩家“下一次是第5巡查/第6巡查”“第X次决定生死”等攻略式节点编号。\n- 玩家可见内容只写“继续深入高校、抓住下一次机会、再调查一次”等世界内表达；巡查次数只由后台账本记录。\n`);

  append(byName, '65｜爱缪莎', `\n在西比尔占卜场景中，不得把后台巡查编号或“下一次将决定生死”作为占卜结果告诉玩家。她只能描述可能性、窗口、需要抓住的时机与协作方向。\n`);

  append(byName, '91｜f7d_state字段与更新规则', `\n【选项UI与状态】\n- \`<f7d_choices>\`中的按钮只是玩家输入建议。按钮被渲染、点击并回填输入框都不是剧情行动，不得修改任何\`f7d_state\`字段。\n- 只有玩家将回填内容实际发送为新一轮输入后，才按普通玩家行动规则判断是否结算、扣节点或改变路线。\n- 延误古街分支实际演出雯梓受伤时，\`route_flags.wenzi_injured=true\`与正文受伤事实必须同轮原子提交；不得出现正文受伤而字段仍false。\n`);

  card.data.extensions.depth_prompt.prompt += ' ⑰需要玩家决定时用<f7d_choices>/<f7d_choice>输出2~4个自然行动建议，按钮点击仅回填输入框、未发送前不结算；选项不得泄露路线/结局/巡查编号。';
  card.data.post_history_instructions += `\n- 【可选行动UI】只有确实需要玩家决定时，正文后可输出\`<f7d_choices>\`，内部2~4个\`<f7d_choice>\`自然行动文本。不要每轮强制选择题。选项不得出现路线名、结局名、好感数值、巡查编号、推荐/正确/影响结局等攻略词。\n- 点击选项仅代表把文字回填到输入框，玩家尚未发送前绝不视为已选择、不得预结算状态。\n`;

  const scripts = card.data.extensions.regex_scripts || (card.data.extensions.regex_scripts = []);
  const removeIds = new Set(['f7d-choices-wrap-v0414', 'f7d-choice-button-v0414']);
  card.data.extensions.regex_scripts = scripts.filter(s => !removeIds.has(s.id));

  const choiceWrap = {
    id: 'f7d-choices-wrap-v0414', scriptName: '七都｜选项容器美化', disabled: false, runOnEdit: true,
    findRegex: '/<f7d_choices>([\\s\\S]*?)<\\/f7d_choices>/gi', trimStrings: [],
    replaceString: '<div class="f7d-choice-grid" style="box-sizing:border-box;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr));gap:.55em;margin:.8em 0;padding:.7em;border:1px solid rgba(116,174,231,.28);border-radius:14px;background:linear-gradient(145deg,rgba(13,23,37,.78),rgba(24,39,56,.72));box-shadow:0 8px 24px rgba(0,0,0,.14);">$1</div>',
    placement: [2], substituteRegex: 0, minDepth: null, maxDepth: null, markdownOnly: true, promptOnly: false,
  };
  const onclickJs = "(function(b){var t=document.querySelector('#send_textarea');if(!t)return;var v=(b.textContent||'').trim();t.value=v;t.dispatchEvent(new Event('input',{bubbles:true}));t.dispatchEvent(new Event('change',{bubbles:true}));t.focus();})(this);return false;";
  const choiceButton = {
    id: 'f7d-choice-button-v0414', scriptName: '七都｜选项按钮与回填', disabled: false, runOnEdit: true,
    findRegex: '/<f7d_choice>([\\s\\S]*?)<\\/f7d_choice>/gi', trimStrings: [],
    replaceString: `<button type="button" class="f7d-choice-btn" data-f7d-choice="1" onclick="${onclickJs}" style="box-sizing:border-box;width:100%;min-height:44px;padding:.65em .85em;border:1px solid rgba(133,194,255,.52);border-radius:10px;background:linear-gradient(135deg,rgba(32,60,88,.88),rgba(24,45,67,.94));box-shadow:0 4px 12px rgba(0,0,0,.16);color:#eef7ff;font:600 13px/1.45 system-ui,-apple-system,'Microsoft YaHei',sans-serif;text-align:left;cursor:pointer;">$1</button>`,
    placement: [2], substituteRegex: 0, minDepth: null, maxDepth: null, markdownOnly: true, promptOnly: false,
  };
  card.data.extensions.regex_scripts.push(choiceWrap, choiceButton);
  return card;
}

export async function loadV0414Card(workspace = process.env.GITHUB_WORKSPACE || process.cwd()) {
  const { card: baseCard } = await loadV0413Card(workspace);
  const card = applyV0414Patch(baseCard);
  const raw = Buffer.from(JSON.stringify(card), 'utf8');
  const compactSha256 = crypto.createHash('sha256').update(raw).digest('hex');
  if (compactSha256 !== EXPECTED_V0414_COMPACT_SHA256) {
    throw new Error(`v0.4.14 compact hash mismatch: ${compactSha256}`);
  }
  return { card, raw, compactSha256 };
}

export { entryMap };
