import assert from 'node:assert/strict';
import vm from 'node:vm';
import {loadQiduReleaseCandidate} from './qidu-card-v0424-cg-candidate.mjs';
import {addMvuCot} from './qidu-card-v0425-mvu-cot.mjs';
import {repairQiduCard} from './qidu-card-v0426-repair.mjs';
import {addPresetChoiceCompatibility,VERSION} from './qidu-card-preset-compat-v0427.mjs';

const {card:base}=await loadQiduReleaseCandidate(process.cwd(),{skipHashCheck:true});
const d=addPresetChoiceCompatibility(repairQiduCard(addMvuCot(base))).data;
assert.equal(d.character_version,VERSION);
assert(d.character_book.entries.find(e=>e.id===10).content.includes('草莓糖'));
assert(d.character_book.entries.find(e=>e.id===41).content.includes('多年前'));
assert(d.post_history_instructions.includes('同轮不得双出'));
assert(d.extensions.regex_scripts.some(s=>s.scriptName==='七都｜预设分支显示隐藏'));
const script=d.extensions.tavern_helper.scripts.find(s=>s.id==='qidu-v0424-choice-bridge').content;
new vm.Script(script);
assert(script.includes('normalizeRawBranches();classifyChoices()'));
assert(script.includes('setComposer,normalizePresetShells,normalizeRawBranches'));
console.log('PASS v0427: single choices, preset branch bridge, story anchors');
