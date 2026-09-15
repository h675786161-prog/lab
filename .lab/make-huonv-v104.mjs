import fs from 'node:fs/promises';

const SOURCE = 'cards/huonv/霍女_玲七_v1.0.3.json';
const OUT = process.argv[2] || 'cards/huonv/霍女_玲七_v1.0.4.json';
const card = JSON.parse(await fs.readFile(SOURCE, 'utf8'));

const oldDescriptionIdentity = '她显然并非常人，但究竟是仙、神、异人、精怪还是别的什么，叙事与世界事实层面均不作确证。';
const newDescriptionIdentity = '原作留下足以引人猜疑的异常与神秘，但没有给出可确证的本质答案。究竟是人、异人、仙、神、精怪还是别的什么，叙事与世界事实层面均不作确证。';
const oldSystemIdentity = '霍女并非常人这一点可以成立；她的具体物种、仙籍、修行体系、法术等级不存在已确定答案。';
const newSystemIdentity = '原作只提供足以引人怀疑的异常，不把“人/非人”本身先定为答案；她的具体本质、物种、仙籍、修行体系、法术等级均不存在已确定答案。';
const systemAnchor = '这里的“不确定”是叙事对世界真相的保留，不代表霍女本人必然失忆或对自身一无所知。霍女自己究竟知道多少同样没有被原作交代；没有新的剧情依据时，不替她确认“我知道自己的本质”，也不替她确认“我自己也不知道是什么”。';
const layerClosure = '身份与自知程度的未定义同样约束正文之外的思考、角色动机推演、幕后分析与注释：任何层都不要先行确定霍女是人、非人或某一种仙神精怪，也不要把她确切知道或不知道自身本质当成既定事实。需要推演时，只依据她是否回答、是否隐瞒、当下行为与已知原作事实。';

if (!card.data?.description?.includes(oldDescriptionIdentity)) throw new Error('identity description anchor not found');
if (!card.data?.system_prompt?.includes(oldSystemIdentity)) throw new Error('identity system premise anchor not found');
if (!card.data.system_prompt.includes(systemAnchor)) throw new Error('identity system self-knowledge anchor not found');
if (card.data.description.includes(newDescriptionIdentity) || card.data.system_prompt.includes(layerClosure)) throw new Error('v1.0.4 identity closure already present');

card.data.description = card.data.description.replace(oldDescriptionIdentity, newDescriptionIdentity);
card.data.system_prompt = card.data.system_prompt.replace(oldSystemIdentity, newSystemIdentity);
card.data.system_prompt = card.data.system_prompt.replace(systemAnchor, `${systemAnchor}\n${layerClosure}`);
card.data.character_version = '1.0.4';

await fs.writeFile(OUT, JSON.stringify(card), 'utf8');

const check = JSON.parse(await fs.readFile(OUT, 'utf8'));
if (check.spec !== 'chara_card_v2') throw new Error('Wrong card spec');
if (check.data.character_version !== '1.0.4') throw new Error('Version bump failed');
if (!check.data.description.includes(newDescriptionIdentity)) throw new Error('description identity correction missing');
if (check.data.description.includes(oldDescriptionIdentity)) throw new Error('old description nonhuman-leading wording still present');
if (!check.data.system_prompt.includes(newSystemIdentity)) throw new Error('system identity premise correction missing');
if (check.data.system_prompt.includes(oldSystemIdentity)) throw new Error('old system nonhuman-leading wording still present');
if (!check.data.system_prompt.includes(layerClosure)) throw new Error('identity layer closure missing');
if (!check.data.system_prompt.includes('分支点前若原作未交代，保持未定义。')) throw new Error('v1.0.3 canon closure was lost');
if ((check.data.alternate_greetings || []).length !== 3) throw new Error('alternate greetings changed unexpectedly');

console.log(JSON.stringify({
  source: SOURCE,
  out: OUT,
  version: check.data.character_version,
  identity_description: newDescriptionIdentity,
  identity_system: newSystemIdentity,
  identity_layer_rule: layerClosure,
}, null, 2));
