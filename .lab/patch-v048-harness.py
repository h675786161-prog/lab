#!/usr/bin/env python3
from pathlib import Path

p = Path('.lab/f7d-targeted-v042.mjs')
s = p.read_text(encoding='utf-8')

def rep(old, new, label, required=True):
    global s
    if old not in s:
        if required:
            raise SystemExit(f'v0.4.8 harness patch target missing: {label}')
        return
    s = s.replace(old, new)

rep('3db2e5951017f308903784cef7d82a96a027b83b5bf9f1643a0590466b1550bb',
    'c285ca4cab2bf986ee242a6edaa607ac7a2967299ee70506ee7c3836767f249b', 'sha')
rep('bench-evidence/f7d-v042-targeted', 'bench-evidence/f7d-v048-targeted', 'out')
rep('LingQi-F7D-v042-', 'LingQi-F7D-v048-', 'ua')
rep(
    '[测试说明] 这是角色卡实机回归测试。按角色卡本身运行，不要解释测试，不要评价规则。必须输出正文、<f7d_terminal>和完整<f7d_state>。',
    '[测试说明] 这是角色卡实机回归测试。按角色卡本身运行，不要解释测试，不要评价规则。先执行提交前结算扫描；必须把结算完成后的完整<f7d_state>作为回复第一块输出，然后写正文，最后输出<f7d_terminal>。终端必须逐字段服从已提交状态。不要代写玩家未输入的台词、情绪或动作。',
    'test-instruction')
rep('max_tokens=1500,thinking=true', 'max_tokens=4200,thinking=false', 'static-budget')
rep('max_tokens:1400,thinking:true', 'max_tokens:3600,thinking:false', 'continuity-budget')
rep('for (let attempt=1; attempt<=3; attempt++)', 'for (let attempt=1; attempt<=5; attempt++)', 'retry-count')
rep('if (attempt<3) await sleep(2500*attempt);', 'if (attempt<5) await sleep(2500*attempt);', 'retry-wait')
rep(
    "battle_flags:{final_battle:null,active_corpse_final:null}, meta:{cg:[],endings:[]},",
    "battle_flags:{final_battle:null,active_corpse_final:null,sybilla_condition_obtained:false,sybilla_rescued:null}, meta:{cg:[],endings:[]},",
    'base-sybilla-fields')
rep(
    "battle_flags:{final_battle:null,active_corpse_final:null,sybilla_rescue:false}}),",
    "battle_flags:{final_battle:null,active_corpse_final:null,sybilla_condition_obtained:false,sybilla_rescued:null}}),",
    'case-sybilla-fields')
rep(
    "check:(o,s)=>({route_stays_central:s?.route==='central',no_auto_intimacy:s?.relationships?.['希罗']?.stage!=='亲密',no_auto_romance:s?.relationships?.['希罗']?.romance!==true})",
    "check:(o,s)=>({route_stays_central:s?.route==='central',node_unchanged:s?.node_used===0,no_auto_intimacy:s?.relationships?.['希罗']?.stage!=='亲密',no_auto_romance:s?.relationships?.['希罗']?.romance!==true,no_join_rewrite:!hasAny(o,['你愿意加入我','加入希罗阵营','加入我的阵营','成为我的部下'])})",
    'hiro-support-check')
rep(
    "check:(o,s)=>({day3:s?.day===3,node_reset:s?.node_used===0,eligible_true:s?.ann?.eligible===true,chased_untouched:s?.ann?.chased===null,route_not_auto_ann:s?.route==='central'})",
    "check:(o,s)=>({day3:s?.day===3,node_reset:s?.node_used===0,eligible_true:s?.ann?.eligible===true,chased_untouched:s?.ann?.chased===null,route_not_auto_ann:s?.route==='central',ann_cutoff_once:Array.isArray(s?.hiro?.handled)&&s.hiro.handled.filter(x=>x==='ANN_D4_ELIGIBILITY').length===1,day3_morning_once:Array.isArray(s?.hiro?.handled)&&s.hiro.handled.filter(x=>x==='DAY3_MORNING').length===1,no_false_new_loop:!hasAny(o,['全新的轮回','新的轮回开始','新轮回开始','进入新的轮回']),terminal_not_all_unknown:!hasAny(o,['黑核状态：全部未知','黑核状态: 全部未知','黑核：全部未知','黑核: 全部未知'])})",
    'ann-positive-check')
rep(
    "condition_true:s?.battle_flags?.sybilla_condition_obtained===true,\n      no_invented_mechanism:!hasAny(o,['书页越多','自我被稀释','神器认出','承载这座校园','接触她本身','记录过载','身份钥匙','封存书页'])",
    "condition_true:s?.battle_flags?.sybilla_condition_obtained===true,\n      rescued_still_null:s?.battle_flags?.sybilla_rescued===null,\n      no_legacy_field:!Object.prototype.hasOwnProperty.call(s?.battle_flags||{},'sybilla_rescue'),\n      no_invented_mechanism:!hasAny(o,['神器','书页','真名','记录能力','共振','感染机理','治疗措施','治疗方案','稳定她的状态','稳定神器'])",
    'sybilla-check')
rep(
    "check:(o,s)=>({harbor_lost:s?.cores?.harbor==='lost',not_reopened:s?.cores?.harbor!=='available'&&s?.cores?.harbor!=='purified',route_central:s?.route==='central'})",
    "check:(o,s)=>({harbor_lost:s?.cores?.harbor==='lost',not_reopened:s?.cores?.harbor!=='available'&&s?.cores?.harbor!=='purified',route_central:s?.route==='central',handled_once:Array.isArray(s?.hiro?.handled)&&s.hiro.handled.filter(x=>x==='DAY4_HARBOR').length===1,no_recoverable_staging:!hasAny(o,['临时祭坛','黑核被放置','黑核就在眼前','眼前的黑核','夺回黑核的机会']),no_user_puppeting:!hasAny(o,['你握紧','你愤怒','你害怕','你心想','你点头','你摇头','你喊道','你说道','你反驳','你质问']),no_backend_leak:!hasAny(o,['被标记为lost','标记为\"lost\"','标记为“lost”','状态值为lost'])})",
    'lost-check')
rep(
    "const checks=t.check(r.content,stOut);\n    const pass=!!stOut&&!stOut.__parse_error&&Object.values(checks).every(Boolean);",
    "const checks=t.check(r.content,stOut);\n    checks.state_first=r.content.trimStart().startsWith('<f7d_state>');\n    const pass=!!stOut&&!stOut.__parse_error&&Object.values(checks).every(Boolean);",
    'static-state-first')
rep(
    "continuity.push({turn:i+1,input:turns[i],output:r.content,state:stOut,ok:!!stOut&&!stOut.__parse_error,attempt:r.attempt});",
    "continuity.push({turn:i+1,input:turns[i],output:r.content,state:stOut,state_first:r.content.trimStart().startsWith('<f7d_state>'),ok:!!stOut&&!stOut.__parse_error&&r.content.trimStart().startsWith('<f7d_state>'),attempt:r.attempt,finish_reason:r.finish_reason});",
    'continuity-state-first')
rep(
    "school_patrol:lastState?.regions?.school?.patrol??null,\n};",
    "school_patrol:lastState?.regions?.school?.patrol??null,\n  ann_photo_turn_node:continuity[4]?.state?.node_used??null,\n  after_plain_chat_node:continuity[6]?.state?.node_used??null,\n  school1_turn_node:continuity[7]?.state?.node_used??null,\n  school2_turn_node:continuity[8]?.state?.node_used??null,\n  sybilla_condition:lastState?.battle_flags?.sybilla_condition_obtained??null,\n  sybilla_rescued_present:Object.prototype.hasOwnProperty.call(lastState?.battle_flags||{},'sybilla_rescued'),\n  sybilla_rescued:lastState?.battle_flags?.sybilla_rescued,\n  sybilla_legacy_present:Object.prototype.hasOwnProperty.call(lastState?.battle_flags||{},'sybilla_rescue'),\n};",
    'continuity-detail-checks')
rep(
    "continuityChecks.ann_events.includes('ANN_PHOTO') &&\n  continuityChecks.romance!==true;",
    "continuityChecks.ann_events.includes('ANN_PHOTO') &&\n  continuityChecks.romance!==true &&\n  continuityChecks.ann_photo_turn_node===2 &&\n  continuityChecks.after_plain_chat_node===2 &&\n  continuityChecks.school1_turn_node===3 &&\n  continuityChecks.school2_turn_node===4 &&\n  continuityChecks.sybilla_condition===false &&\n  continuityChecks.sybilla_rescued_present===true &&\n  continuityChecks.sybilla_rescued===null &&\n  continuityChecks.sybilla_legacy_present===false;",
    'continuity-pass')

p.write_text(s, encoding='utf-8')
print('v0.4.8 harness patched')
