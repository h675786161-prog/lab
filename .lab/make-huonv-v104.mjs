import fs from 'node:fs/promises';

const SOURCE = 'cards/huonv/霍女_玲七_v1.0.4.json';
const OUT = process.argv[2] || 'cards/huonv/霍女_玲七_v1.0.5.json';
const card = JSON.parse(await fs.readFile(SOURCE, 'utf8'));

const oldSystem = '她曾展现过常人难以解释的脱身、远行与消息能力；只在剧情确实需要且与原作气质一致时呈现具体异常，不把这些异常扩展成万能法术清单。';
const newSystem = '原作只留下难以解释的结果，例如她已经脱身、行踪难测、得到常人不易得到的消息，却没有解释这些结果如何发生。续写保持同样方式：异常只写角色能够观察到的结果与由此产生的猜测，不从结果反推机制。门仍锁着而她已经在门外，可以写到这里为止；叙事、思考和霍女自述都不为了补因果而生成穿墙术、妖气、法力、非人体温、异常寿命或其他超自然机制。';

const oldLore = '她可出现与原作一致的难解释之处，例如异常迅速地脱身、行踪难测、获得常人不易获得的消息；不要据此自动生成飞剑、灵力、境界、变身、尾巴等完整超自然体系。';
const newLore = '她可以呈现与原作一致的难解释结果，例如已经脱身、行踪难测、得到常人不易得到的消息。写到可观察结果即可，不解释她如何做到；剧情人物可以猜测，猜测不升级成事实。不要从这些结果反推出穿墙、法术、妖气、灵力、非人体温、异常寿命、变身、尾巴等机制或体征。';

const example = `\n\n<START>\n{{user}}：“门从外头锁着，你是怎么出来的？你到底是不是妖怪？”\n霍女回头看了一眼那把锁，没有替眼前的异常找解释。\n“门锁着，我在这里。你两样都看见了。”\n{{user}}：“所以呢？”\n“所以你若要猜，便猜。”她拢了拢袖口，“猜测还是猜测，别拿来替我认账。”`;

if (!card.data?.system_prompt?.includes(oldSystem)) throw new Error('observable-anomaly system anchor not found');
const identityEntry = card.data?.character_book?.entries?.find(e => e?.name === '身份边界');
if (!identityEntry?.content?.includes(oldLore)) throw new Error('identity lore anomaly anchor not found');
if (card.data.system_prompt.includes(newSystem) || identityEntry.content.includes(newLore) || card.data.mes_example.includes('猜测还是猜测，别拿来替我认账。')) throw new Error('v1.0.5 anomaly pattern already present');

card.data.system_prompt = card.data.system_prompt.replace(oldSystem, newSystem);
identityEntry.content = identityEntry.content.replace(oldLore, newLore);
card.data.mes_example += example;
card.data.character_version = '1.0.5';

await fs.writeFile(OUT, JSON.stringify(card), 'utf8');

const check = JSON.parse(await fs.readFile(OUT, 'utf8'));
const checkIdentityEntry = check.data.character_book.entries.find(e => e?.name === '身份边界');
if (check.spec !== 'chara_card_v2') throw new Error('Wrong card spec');
if (check.data.character_version !== '1.0.5') throw new Error('Version bump failed');
if (!check.data.system_prompt.includes('异常只写角色能够观察到的结果与由此产生的猜测，不从结果反推机制')) throw new Error('observable-result system rule missing');
if (!checkIdentityEntry?.content?.includes('写到可观察结果即可，不解释她如何做到')) throw new Error('observable-result lore rule missing');
if (!check.data.mes_example.includes('猜测还是猜测，别拿来替我认账。')) throw new Error('observable-result example missing');
if (!check.data.system_prompt.includes('不把“人/非人”本身先定为答案')) throw new Error('v1.0.4 identity closure lost');
if (!check.data.system_prompt.includes('分支点前若原作未交代，保持未定义。')) throw new Error('v1.0.3 canon closure lost');
if ((check.data.alternate_greetings || []).length !== 3) throw new Error('alternate greetings changed unexpectedly');

console.log(JSON.stringify({
  source: SOURCE,
  out: OUT,
  version: check.data.character_version,
  system_pattern: newSystem,
  lore_pattern: newLore,
  example_added: true,
}, null, 2));
