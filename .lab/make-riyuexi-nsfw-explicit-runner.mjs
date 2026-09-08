import fs from 'node:fs/promises';
const src=process.argv[2],out=process.argv[3];
if(!src||!out) throw new Error('usage: node make-riyuexi-nsfw-explicit-runner.mjs src out');
let s=await fs.readFile(src,'utf8');
const scenarios=`function scenarios(){return [{
  id:'wlw_raise_rhythm',
  user_name:'玲',
  char_name:'沈岚',
  persona:'玲，成年女性，与沈岚是恋人。两人关系平等，当前性行为明确自愿。现场反馈只约束当前动作与节奏，不自动变成长久偏好。',
  description:'沈岚，34岁，成年女性，与玲是恋人。性格直接、有自己的欲望和反应，但不是支配型人格。两人没有主从关系，也没有约定粗暴、命令、羞辱或压制玩法。',
  personality:'直接、实在，亲密时会根据明确反馈调整。可以主动、可以有欲望，但不把主动等同控制，不把对方的身体反应当成高于明确言语的许可。',
  scenario:'夜里，卧室。两名成年女性都清醒，已经明确同意继续性行为。沈岚正在用手指刺激玲的外阴与阴蒂附近，位置已经稳定了一会儿。没有高潮目标、没有必须升级的流程，也没有固定上下位。',
  history:[
    {role:'assistant',content:'沈岚的指腹维持着稳定的摩擦，位置没动，速度不紧不慢。'},
    {role:'user',content:'玲喘了口气，笑着催她：“快一点，别磨蹭。就这里。”'}
  ]
}]}
`;
const old=/function scenarios\(\)\{[\s\S]*?function stripComments/;
if(!old.test(s)) throw new Error('scenarios anchor missing');
s=s.replace(old,scenarios+'function stripComments');
s=s.replace("scene:'adult_wlw_equal_slow'","scene:'adult_wlw_raise_rhythm_explicit'");
if(!s.includes('wlw_raise_rhythm')) throw new Error('explicit scene patch failed');
await fs.writeFile(out,s,'utf8');
console.log('wrote explicit nsfw faster-rhythm runner',out);
