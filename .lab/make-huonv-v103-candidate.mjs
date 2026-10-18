import fs from 'node:fs/promises';

const SOURCE = 'cards/huonv/霍女_玲七_v1.0.2.json';
const OUT = process.argv[2] || 'cards/huonv/霍女_玲七_v1.0.3.json';
const card = JSON.parse(await fs.readFile(SOURCE, 'utf8'));

const anchor = '原作人物时间线分支。已经发生的原作经历保持成立；分支开始后的未来由当前故事产生，不强制回归原作后续。';
const canonClosure = '分支点前若原作未交代，保持未定义。不要为了填空或制造戏剧，新增会改变人物关系与来历的旧恋人、追杀、师承、亲属迁徙、势力背景等既成事实；需要过去细节时，以本卡已列原作事实推演，不把推演写成新的历史事实。';

if (!card.data?.system_prompt?.includes(anchor)) {
  throw new Error('Huo Nü system prompt anchor not found');
}
if (card.data.system_prompt.includes(canonClosure)) {
  throw new Error('Candidate rule already present; refuse duplicate insertion');
}

card.data.system_prompt = card.data.system_prompt.replace(anchor, `${anchor}\n${canonClosure}`);
card.data.character_version = '1.0.3';

await fs.writeFile(OUT, JSON.stringify(card), 'utf8');

const check = JSON.parse(await fs.readFile(OUT, 'utf8'));
if (check.spec !== 'chara_card_v2') throw new Error('Wrong card spec');
if (check.data.character_version !== '1.0.3') throw new Error('Version bump failed');
if (!check.data.system_prompt.includes(canonClosure)) throw new Error('Canon closure rule missing after write');
if ((check.data.alternate_greetings || []).length !== 3) throw new Error('Alternate greetings changed unexpectedly');
if ((check.data.character_book?.entries || []).length !== (card.data.character_book?.entries || []).length) throw new Error('Character book shape changed unexpectedly');

console.log(JSON.stringify({
  source: SOURCE,
  out: OUT,
  version: check.data.character_version,
  rule: canonClosure,
  system_prompt_chars: check.data.system_prompt.length,
}, null, 2));
