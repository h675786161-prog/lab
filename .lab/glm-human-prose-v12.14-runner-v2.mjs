import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = process.env.GITHUB_WORKSPACE || process.cwd();
const SOURCE = path.join(ROOT, '.lab/glm-human-prose-v12.14-runner.mjs');
const TMP = path.join('/tmp', 'glm-human-prose-v12.14-runner-v2-generated.mjs');

let src = await fs.readFile(SOURCE, 'utf8');

const oldBlock = `  if(useExp){\n    const li=seq.findIndex(x=>x.identifier==='de8407c8-0b1d-4c78-81bf-395bb0ba0c6b'||x.name==='🧼丨GLM语言纠偏@玲七'||x.name==='补丁·GLM语言纠偏');\n    if(li<0) throw new Error('GLM language prompt missing from active pack');\n    seq[li]={...seq[li],content:EXPERIMENT_GLM_LANGUAGE};\n  }`;

const newBlock = `  if(useExp){\n    const prism=seq.findIndex(x=>x.name==='🔒丨Prism');\n    const at=prism>=0?prism:seq.length;\n    seq.splice(at,0,{identifier:'lab-glm-language-v12.14',name:'🧼丨GLM语言纠偏@玲七·v12.14实验',role:'system',content:EXPERIMENT_GLM_LANGUAGE});\n  }`;

if (!src.includes(oldBlock)) throw new Error('v12.14 runner injection block changed');
src = src.replace(oldBlock, newBlock);
src = src.replace('A=v12.13, B=v12.14 GLM language replacement', 'A=current active pack, B=current active pack + v12.14 GLM language experiment');

await fs.writeFile(TMP, src, 'utf8');
await import(`${pathToFileURL(TMP).href}?v=${Date.now()}`);
