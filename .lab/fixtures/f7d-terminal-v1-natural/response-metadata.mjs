export function parseCompletionMetadata(text){
 const finishReasons=[],usages=[],models=new Set();let doneSeen=false,parsedFrames=0,invalidFrames=0;
 const read=value=>{if(!value||typeof value!=='object')return;parsedFrames++;if(typeof value.model==='string')models.add(value.model);
  for(const c of value.choices||[])if(c.finish_reason!=null)finishReasons.push({index:c.index??0,reason:c.finish_reason});
  if(value.usage&&typeof value.usage==='object')usages.push(value.usage);
 };
 const lines=String(text).split(/\r?\n/),data=lines.filter(x=>x.startsWith('data:')).map(x=>x.slice(5).trim());
 if(data.length){for(const x of data){if(x==='[DONE]'){doneSeen=true;continue;}if(!x)continue;try{read(JSON.parse(x));}catch{invalidFrames++;}}}
 else{try{read(JSON.parse(text));}catch{invalidFrames++;}}
 return {finishReasons,usages,models:[...models],doneSeen,parsedFrames,invalidFrames,finishReasonKnown:finishReasons.length>0,truncated:finishReasons.some(x=>['length','max_tokens'].includes(x.reason))};
}
