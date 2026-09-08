import fs from 'node:fs/promises';
const src=process.argv[2],out=process.argv[3];
if(!src||!out) throw new Error('usage: node make-riyuexi-nsfw-style-runner.mjs src out');
let s=await fs.readFile(src,'utf8');
const scenarios=`function scenarios(){return [{
  id:'wlw_slow_equal',
  user_name:'玲',
  char_name:'沈岚',
  persona:'玲，成年女性，与沈岚是恋人。两人关系平等，当前亲密行为明确自愿。玲说话直接，现场反馈就是现场反馈，不自动等于长期性偏好。',
  description:'沈岚，34岁，成年女性，与玲是恋人。性格直接、有自己的脾气和注意力，但不是支配型人格。两人没有主从关系，也没有约定粗暴、压制或命令式玩法。',
  personality:'直接、实在，亲密时也会有正常的停顿、笑场、没接准和重新调整。会听当下反馈，不把对方的身体反应当成高于明确言语的许可，也不把性行为自动写成谁征服谁。',
  scenario:'夜里，卧室。两名成年女性都清醒，已经明确同意继续亲密接触。她们刚亲吻和抚摸了一会儿，节奏偏慢；沈岚的手停在玲胸前，玲主动贴近。没有必须完成的性行为流程，没有预设高潮目标，也没有固定上下位。',
  history:[
    {role:'assistant',content:'沈岚吻得并不急，手掌贴着玲胸前停了一会儿，像是在等她自己把距离缩短。'},
    {role:'user',content:'玲贴过去一点，低声说：“慢一点，就这样，不用急。”'}
  ]
}]}
`;
const old=/function scenarios\(\)\{[\s\S]*?\n\]\}\nfunction stripComments/;
if(!old.test(s)) throw new Error('scenarios anchor missing');
s=s.replace(old,scenarios+'function stripComments');
// Make evidence identify the real test mode rather than the legacy manifest labels.
s=s.replace("lab_overrides:{takeover:'closed',narrate:'closed',perspective:'third_person_limited',user_pronoun:'third_person',word_count:'700-1100',paragraphs:'5-9',temperature:1,top_p:1}","lab_overrides:{takeover:'open',narrate:'closed',perspective:'third_person_limited',user_pronoun:'third_person',word_count:'natural',paragraphs:'natural',scene:'adult_wlw_equal_slow',temperature:1,top_p:1}");
// Add rough style diagnostics. These are clues only; final judgment is manual reading.
s=s.replace("logistics:(body.match(/物业|前台|外卖员|订单|平台|快递|会议|项目|甲方|预", "dominance:(body.match(/不许|不准|乖(?:一点|乖)?|听话|看着我|别躲|逃不掉|压住|按住|扣住|捏住|掐住|命令|占有|征服|惩罚/g)||[]).length,consent_override:(body.match(/身体.{0,14}(?:比|胜过|高于).{0,10}(?:话|言语)|嘴上.{0,12}(?:不要|拒绝).{0,18}身体|反应.{0,12}(?:已经|就是).{0,10}(?:答案|同意|许可)/g)||[]).length,forced_pipeline:(body.match(/(?:随即|接着|下一秒).{0,28}(?:更深|更快|加重)|直到.{0,18}(?:高潮|失控)|再一次.{0,18}(?:高潮|顶点)/g)||[]).length,logistics:(body.match(/物业|前台|外卖员|订单|平台|快递|会议|项目|甲方|预");
s=s.replaceAll("riyuexi-v7-glm-exact.json","riyuexi-v7-nsfw-style.json");
if(!s.includes("wlw_slow_equal")) throw new Error('nsfw scene patch failed');
if(!s.includes("dominance:")) throw new Error('style metric patch failed');
await fs.writeFile(out,s,'utf8');
console.log('wrote nsfw style runner',out);
