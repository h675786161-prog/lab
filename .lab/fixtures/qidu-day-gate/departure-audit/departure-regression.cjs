const fs=require('fs'),vm=require('vm'),assert=require('assert');
const source=fs.readFileSync(__dirname+'/morning-guard.js','utf8');
const start=source.indexOf('const hasSaihamDeparture=');
const end=source.indexOf('const day6DecisionMade=',start);
const original=source.slice(start,end);
const corrected=original.replace('被(?:带|抬|推|护送)离中央庭','被(?:带|抬|推|护送)离(?:了)?中央庭');
const fn=s=>vm.runInNewContext(s+';hasSaihamDeparture');
const old=fn(original),fixed=fn(corrected);
const diagnostic=JSON.parse(fs.readFileSync(__dirname+'/departure-story.json'));
const text=diagnostic.data.text;
assert.equal(old(text),false);assert.equal(fixed(text),true);
const cases=[
 ['带离完成','希罗处理活骸化的赛哈姆。赛哈姆被带离了中央庭。',true],
 ['旧表达','希罗处理活骸化的赛哈姆。赛哈姆被带离中央庭。',true],
 ['尚未离场','希罗处理活骸化的赛哈姆。赛哈姆尚未被带离中央庭。',false],
 ['仍然在场','希罗处理活骸化的赛哈姆。赛哈姆仍在中央庭。赛哈姆被带离了中央庭。',false],
 ['只是对白','希罗处理活骸化的赛哈姆。“赛哈姆被带离了中央庭。”',false],
 ['准备离场','希罗处理活骸化的赛哈姆。赛哈姆准备离开中央庭。',false],
 ['等待转移','希罗处理活骸化的赛哈姆。赛哈姆等待转移。',false],
 ['没有人物','希罗处理活骸。担架被带离了中央庭。',false],
];
for(const [name,story,want]of cases)assert.equal(fixed(story),want,name);
fs.writeFileSync(__dirname+'/morning-guard.fixed.js',source.replace('被(?:带|抬|推|护送)离中央庭','被(?:带|抬|推|护送)离(?:了)?中央庭'));
const result={sourceCommit:'5bf28e33407938e42a5cdbbaad4c250e7dea0d99',runId:'37211901343',baselineActualText:false,fixedActualText:true,cases:cases.map(([name,,expected])=>({name,expected,passed:true})),scope:'Exact departure predicate only; not a new SillyTavern or model run',mvuCommittedMonologue:true,finishReason:'not recorded; truncation not proven'};
fs.writeFileSync(__dirname+'/departure-regression-result.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
