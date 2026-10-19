#!/usr/bin/env python3
from pathlib import Path

p=Path('.lab/f7d-targeted-v042.mjs')
s=p.read_text(encoding='utf-8')

def rep(old,new,label,required=True):
    global s
    if old not in s:
        if required: raise SystemExit(f'v0.4.9 harness patch target missing: {label}')
        return
    s=s.replace(old,new)

rep('c285ca4cab2bf986ee242a6edaa607ac7a2967299ee70506ee7c3836767f249b','faa2bd4afd5d3d0bca4f6aa4a987d0e0cb75f1905ce653201e7257fbc4f7ae98','sha')
rep('bench-evidence/f7d-v048-targeted','bench-evidence/f7d-v049-targeted','out')
rep('LingQi-F7D-v048-','LingQi-F7D-v049-','ua')

old="check:(o,s)=>({day3:s?.day===3,node_reset:s?.node_used===0,eligible_true:s?.ann?.eligible===true,chased_untouched:s?.ann?.chased===null,route_not_auto_ann:s?.route==='central',ann_cutoff_once:Array.isArray(s?.hiro?.handled)&&s.hiro.handled.filter(x=>x==='ANN_D4_ELIGIBILITY').length===1,day3_morning_once:Array.isArray(s?.hiro?.handled)&&s.hiro.handled.filter(x=>x==='DAY3_MORNING').length===1,no_false_new_loop:!hasAny(o,['全新的轮回','新的轮回开始','新轮回开始','进入新的轮回']),terminal_not_all_unknown:!hasAny(o,['黑核状态：全部未知','黑核状态: 全部未知','黑核：全部未知','黑核: 全部未知'])})"
new="check:(o,s)=>({day3:s?.day===3,node_reset:s?.node_used===0,eligible_true:s?.ann?.eligible===true,chased_untouched:s?.ann?.chased===null,route_not_auto_ann:s?.route==='central',ann_cutoff_once:Array.isArray(s?.hiro?.handled)&&s.hiro.handled.filter(x=>x==='ANN_D4_ELIGIBILITY').length===1,day3_morning_once:Array.isArray(s?.hiro?.handled)&&s.hiro.handled.filter(x=>x==='DAY3_MORNING').length===1,no_false_new_loop:!hasAny(o,['全新的轮回','新的轮回开始','新轮回开始','进入新的轮回']),terminal_not_all_unknown:!hasAny(o,['黑核状态：全部未知','黑核状态: 全部未知','黑核：全部未知','黑核: 全部未知']),unknown_not_asserted:!hasAny(o,['旧城区的黑核暂时安全','旧城区黑核暂时安全','旧城区黑核目前安全','旧城区的黑核已经失守','旧城区黑核已经失守','旧城区黑核可净化'])})"
rep(old,new,'ann-unknown-lock')

old="no_invented_mechanism:!hasAny(o,['神器','书页','真名','记录能力','共振','感染机理','治疗措施','治疗方案','稳定她的状态','稳定神器'])"
new="no_invented_mechanism:!hasAny(o,['神器','书页','真名','记录能力','共振','感染机理','治疗措施','治疗方案','稳定她的状态','稳定神器']),\n      no_invented_condition_details:!hasAny(o,['三个条件','第一项','第二项','第三项','一是','二是','三是','能量屏障','吸引主要活骸','精准干预','特定的能量波动','成功率提高','成功几率'])"
rep(old,new,'sybilla-detail-opacity')

old="check:(o,s)=>({node5:s?.node_used===5,east6:s?.regions?.east?.patrol===6,liberated:s?.regions?.east?.liberated===true,core_still_available:s?.cores?.east==='available'})"
new="check:(o,s)=>({node5:s?.node_used===5,east6:s?.regions?.east?.patrol===6,liberated:s?.regions?.east?.liberated===true,core_still_available:s?.cores?.east==='available',no_extra_user_method:!hasAny(o,['你决定与','你迅速观察','你按照','你依次','你选择了','你发现五个','你制定'])})"
rep(old,new,'liberate-agency')

old="no_recoverable_staging:!hasAny(o,['临时祭坛','黑核被放置','黑核就在眼前','眼前的黑核','夺回黑核的机会']),no_user_puppeting:!hasAny(o,['你握紧','你愤怒','你害怕','你心想','你点头','你摇头','你喊道','你说道','你反驳','你质问']),no_backend_leak:!hasAny(o,['被标记为lost','标记为\"lost\"','标记为“lost”','状态值为lost'])"
new="no_recoverable_staging:!hasAny(o,['临时祭坛','黑核被放置','黑核就在眼前','眼前出现黑核','眼前摆着黑核']),no_user_puppeting:!hasAny(o,['心中想着','心里想着','你握紧','你愤怒','你害怕','你心想','你感到','你觉得','你意识到','你不禁','你点头','你摇头','你喊道','你说道','你反驳','你质问','你安慰','你下定决心']),no_backend_leak:!hasAny(o,['被标记为lost','标记为\"lost\"','标记为“lost”','状态值为lost'])"
rep(old,new,'lost-agency-fix')

insert='''\n  {\n    id:'agency_hold', ids:[4,40,90,91],\n    st:state({day:7,node_used:0,known:['安'],relationships:{'安':{stage:'认识',romance:false}}}),\n    input:'我对安说：“你先说，我不打断。”接下来我保持沉默，站在原地等她回答；不要替我继续说话、动作或想法。',\n    check:(o,s)=>({\n      node_unchanged:s?.node_used===0, route_central:s?.route==='central',\n      no_user_continuation:!hasAny(o,['你继续说','你回答','你回应','你问道','你说道','你点头','你摇头','你微笑','你伸手','你走上前','你走近','你心想','你感到','你觉得','你意识到','你决定'])\n    })\n  },\n  {\n    id:'unknown_core_lock', ids:[4,37,91],\n    st:state({day:5,node_used:0,cores:{old:'unknown'}}),\n    input:'我只问一句：“旧城区的黑核现在安全吗？”不进行任何行动。',\n    check:(o,s)=>({\n      node_unchanged:s?.node_used===0, old_stays_unknown:s?.cores?.old==='unknown',\n      admits_unknown:hasAny(o,['尚未确认','无法确认','未确认','情报不足','还不知道','仍是未知','状态未知']),\n      no_false_certainty:!hasAny(o,['暂时安全','目前安全','是安全的','已经失守','已被夺走','现在可净化','已经可净化'])\n    })\n  },'''
needle="\n];\n\nconst results=[];"
if needle not in s: raise SystemExit('v0.4.9 cases insertion anchor missing')
s=s.replace(needle,insert+needle)

old="  sybilla_legacy_present:Object.prototype.hasOwnProperty.call(lastState?.battle_flags||{},'sybilla_rescue'),\n};"
new="  sybilla_legacy_present:Object.prototype.hasOwnProperty.call(lastState?.battle_flags||{},'sybilla_rescue'),\n  ann_photo_agency_clean:!hasAny(continuity[4]?.output||'', ['你对安说','你安慰','笑一个吧','你邀请她','你调整好相机','你的存在本身就是','你告诉安']),\n  all_turns_subjective_clean:continuity.every(x=>!hasAny(x.output||'', ['心中想着','心里想着','你心想','你感到','你觉得','你意识到','你不禁','你安慰','你下定决心'])),\n};"
rep(old,new,'continuity-agency-properties')

old="  continuityChecks.sybilla_rescued===null &&\n  continuityChecks.sybilla_legacy_present===false;"
new="  continuityChecks.sybilla_rescued===null &&\n  continuityChecks.sybilla_legacy_present===false &&\n  continuityChecks.ann_photo_agency_clean===true &&\n  continuityChecks.all_turns_subjective_clean===true;"
rep(old,new,'continuity-agency-pass')

p.write_text(s,encoding='utf-8')
print('v0.4.9 narrative harness patched')
