import fs from 'node:fs/promises';
const src=process.argv[2],out=process.argv[3],kind=process.argv[4];
if(!src||!out||!['flash36','claude'].includes(kind)) throw new Error('usage: node make-riyuexi-v7-other-model-runner.mjs src out flash36|claude');
const delta=JSON.parse(await fs.readFile('fixtures/riyuexi-v7-model-deltas.json','utf8'));
const spec=kind==='flash36'
 ? {profile:'Gemini 3.6–3.8 Flash',head:'🔒Gemini头部',calib:'✅Gemini Flash校准',tail:'🌓Gemini尾部②'}
 : {profile:'Claude',head:'🔒Claude头部',calib:'✅Claude校准',tail:'🌓Claude尾部'};
let s=await fs.readFile(src,'utf8');
const transform=`function lingqiOtherProfile(pack) {
  let q=pack.sequence.map(x=>({...x})).filter(x=>!['✅GLM校准','🌓GLM尾部'].includes(String(x.name||'')));
  const d=${JSON.stringify(delta)};
  const head=d[${JSON.stringify(spec.head)}], calib=d[${JSON.stringify(spec.calib)}], tail=d[${JSON.stringify(spec.tail)}];
  const h=q.findIndex(x=>x.name==='🔫延续创作'); if(h<0) throw new Error('head anchor missing'); q.splice(h,0,head);
  const c=q.findIndex(x=>x.name==='✧─细节优化─✧'); if(c<0) throw new Error('calib anchor missing'); q.splice(c,0,calib);
  q.push(tail);
  pack.sequence=q; pack.profile=${JSON.stringify(spec.profile)}; return pack;
}
`;
s=s.replace("const sleep=ms=>new Promise(r=>setTimeout(r,ms));", "const sleep=ms=>new Promise(r=>setTimeout(r,ms));\n"+transform);
s=s.replace("  const pack=JSON.parse(raw.toString('utf8'));", "  const pack=lingqiOtherProfile(JSON.parse(raw.toString('utf8')));");
s=s.replace("  if(pack.profile!=='GLM｜人味适配') throw new Error(`profile mismatch ${pack.profile}`);", `  if(pack.profile!==${JSON.stringify(spec.profile)}) throw new Error('profile mismatch '+pack.profile);`);
s=s.replace("pack.sequence.length!==222", "pack.sequence.length!==223");
s=s.replace("  for(const must of ['✅GLM校准','😡表达去惯性','🌓GLM尾部','┌⚓必开·世界构建┐','│🔹推荐·逻辑连贯│','┌⚓必开·人物构建┐','┌⚓必开·文风指导┐ ','│💎替换·叙事蓝图④│ ','❄️创作检测','📍常规创作思维']) if(!namesOn.includes(must)) throw new Error(`missing ${must}`);", `  for(const must of ${JSON.stringify([spec.head,spec.calib,spec.tail,'😡表达去惯性','┌⚓必开·世界构建┐','│🔹推荐·逻辑连贯│','┌⚓必开·人物构建┐','┌⚓必开·文风指导┐ ','│💎替换·叙事蓝图④│ ','❄️创作检测','📍常规创作思维'])}) if(!namesOn.includes(must)) throw new Error('missing '+must);`);
s=s.replace("  const forbidden=namesOn.filter(n=>/(?:Gemini|Claude).*(?:头部|尾部|校准)|(?:头部|尾部|校准).*(?:Gemini|Claude)/.test(n));\n  if(forbidden.length) throw new Error(`foreign model prompts active: ${forbidden.join(',')}`);", `  for(const bad of ${JSON.stringify(kind==='flash36'?['✅GLM校准','🌓GLM尾部','🔒Claude头部','✅Claude校准','🌓Claude尾部','✅Gemini Pro校准','🌓Gemini尾部①','🌓Gemini3.5尾部']:['✅GLM校准','🌓GLM尾部','🔒Gemini头部','✅Gemini Flash校准','✅Gemini Pro校准','🌓Gemini尾部①','🌓Gemini尾部②','🌓Gemini3.5尾部'])}) if(namesOn.includes(bad)) throw new Error('foreign model prompt active: '+bad);`);
s=s.replace("const YOUZI={url:'https://youzi.today/v1',key:process.env.YOUZI||'',delay:10000};", "const YOUZI={url:process.env.LAB_API_URL||'',key:process.env.LAB_API_KEY||'',delay:31000};");
s=s.replace("if(!YOUZI.key)throw new Error('YOUZI missing')", "if(!YOUZI.key||!YOUZI.url)throw new Error('provider missing')");
s=s.replace("label:'riyuexi-v7-glm-exact'", `label:${JSON.stringify('riyuexi-v7-'+kind)}`);
s=s.replace("custom_include_body:'thinking:\\n  type: enabled\\nreasoning_effort: low',model:'[B]glm-5.3-flash'", "model:process.env.LAB_MODEL||''");
s=s.replace("model:'[B]glm-5.3-flash',provider:'YOUZI'", "model:process.env.LAB_MODEL||'',provider:process.env.LAB_PROVIDER||'custom'");
s=s.replace(".replaceAll('{{lastUserMessage}}',last)", ".replace(/\\{\\{time\\}\\}/g,new Date().toISOString()).replace(/\\{\\{roll:[^{}]+\\}\\}/g,'4242').replaceAll('{{lastUserMessage}}',last)");
s=s.replace("const results=[],scenes=scenarios();", "const results=[],scenes=scenarios().slice(0,1);");
s=s.replace("await fs.writeFile(path.join(OUT,'riyuexi-v7-glm-exact.json')", `await fs.writeFile(path.join(OUT,${JSON.stringify('riyuexi-v7-'+kind+'.json')})`);
if(!s.includes("scenarios().slice(0,1)")) throw new Error('scene slice patch failed');
if(!s.includes("process.env.LAB_MODEL")) throw new Error('model patch failed');
if(!s.includes("lingqiOtherProfile")) throw new Error('profile patch failed');
await fs.writeFile(out,s,'utf8'); console.log('wrote',kind,'runner',out);
