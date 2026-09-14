import fs from 'node:fs/promises';
import path from 'node:path';

const OUT=process.env.LAB_OUT_INFO||'bench-evidence/qidu-card-v0423-info-timeline';
const p=path.join(OUT,'report.json');
const report=JSON.parse(await fs.readFile(p,'utf8'));
const results=report.results||[];
const target=results.find(x=>x.id==='antoneva_first_chimera_exact_layer');
if(!target) throw new Error('missing antoneva_first_chimera_exact_layer result');
const others=results.filter(x=>x.id!=='antoneva_first_chimera_exact_layer');
const otherFail=others.filter(x=>!x.pass).map(x=>`${x.id}:${(x.fail||[]).join(',')}`);
if(otherFail.length) throw new Error(`information timeline real failures: ${otherFail.join(' | ')}`);
const v=String(target.out||'').replace(/<f7d_state>[\s\S]*?<\/f7d_state>/gi,'');
const first=/(?:第一个|第一名|最初(?:的)?).{0,12}活骸|活骸.{0,18}(?:第一次出现|首次出现|最早出现)/.test(v)||(/(?:是|作为).{0,4}[“「『]?第一个[”」』]?/.test(v)&&/活骸/.test(v));
const team=/(?:三人小队|三个人|三名|三位)/.test(v);
const two=[
  /(?:另外|其余|剩下|另)?\s*(?:两个人|两人|两名|两位|两个)(?:队友|队员|同伴|神器使)?[\s\S]{0,90}?(?:没能回来|死亡|死去|死在|牺牲|丧生|遇难|没回来|没了|没能活下来|没活下来|没撑过去|没能幸存)/,
  /(?:死亡|死去|死在|牺牲|丧生|遇难|没能活下来|没活下来|没撑过去)[\s\S]{0,60}?(?:两个人|两人|两名|两位|两个)(?:队友|队员|同伴|神器使)?/,
  /(?:三人中|小队里|小队中)[\s\S]{0,50}?(?:只有|只剩|唯一)[\s\S]{0,20}?(?:安托涅瓦|我)[\s\S]{0,20}?(?:活下来|幸存)/,
  /(?:安托涅瓦|我)[\s\S]{0,20}?(?:是|成了|成为)[\s\S]{0,20}?(?:唯一|仅有)[\s\S]{0,20}?(?:幸存者|活下来的人)/
].some(re=>re.test(v));
const legs=/(?:失去|失去了|失掉).{0,10}(?:双腿|两条腿)|双腿|失去.{0,10}行走能力/.test(v);
const self=/(?:自我毁灭|自毁|自己毁灭|选择了自我毁灭)/.test(v);
const zero=/(?:^|[“「『\s，。！？：；、])零(?=$|[”」』\s，。！？：；、]|的|是|被|曾|也|还|在|与|和|作为|身份|名字)/m.test(v);
const flags={first,team,two,legs,self,zero};
console.log(JSON.stringify({sourceSummary:report.summary,targetOriginalPass:target.pass,targetOriginalFail:target.fail,flags,excerpt:v.slice(0,2400)},null,2));
if(!first||!team||!two||!legs||!self||zero) throw new Error(`first chimera semantic gate failed: ${JSON.stringify(flags)}`);
