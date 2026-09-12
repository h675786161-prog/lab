#!/usr/bin/env python3
import json
import runpy
from pathlib import Path

# Build on the already-audited rc1 corrections/detailed entries.
runpy.run_path('.lab/qidu-he-v03-coverage-patch.py', run_name='__main__')

CARD = Path('fixtures/qidu-he-if/qidu-he-if.character.json')
MANIFEST = Path('fixtures/qidu-he-if/coverage-manifest.v03.rc2.json')
obj = json.loads(CARD.read_text(encoding='utf-8'))
data = obj['data']
entries = data['character_book']['entries']
manifest = json.loads(MANIFEST.read_text(encoding='utf-8'))


def by_name(name):
    for e in entries:
        if e.get('name') == name:
            return e
    raise KeyError(name)


def upsert(name, keys, content, priority=140, constant=False, insertion_order=None):
    for e in entries:
        if e.get('name') == name:
            e.update({
                'keys': keys,
                'content': content,
                'priority': priority,
                'constant': constant,
                'enabled': True,
                'case_sensitive': False,
                'selective': False,
                'secondary_keys': [],
                'position': 'before_char',
            })
            if insertion_order is not None:
                e['insertion_order'] = insertion_order
            return e
    new_id = max(int(e.get('id', 0)) for e in entries) + 1
    e = {
        'keys': keys,
        'content': content,
        'extensions': {},
        'enabled': True,
        'insertion_order': insertion_order if insertion_order is not None else priority,
        'case_sensitive': False,
        'name': name,
        'priority': priority,
        'id': new_id,
        'comment': name,
        'selective': False,
        'secondary_keys': [],
        'constant': constant,
        'position': 'before_char',
    }
    entries.append(e)
    return e

# Preserve Nivi's actual original oddity instead of normalizing her into a generic trainee.
by_name('妮维')['content'] = '''妮维：
- 未成年，警察世家出身，阳光开朗、元气十足，正义感很强。原作明确写她“从年纪来说根本不够资格进入警校（未成年）”，却凭家庭协调、射击与侦查天赋提前完成警校课程，成为交界都市年纪最小的正式警察。
- 普通人AU保留这项城市制度中的特殊例外：她仍是正式巡警，不把她擅自降格为非正式辅助岗位，也绝不为了合理化职业而把她成年化。
- 有极敏锐的反犯罪直觉，工作时强势认真，对犯罪和违法行为不会因为认识谁就放水；与艾露比、雷克特等灰色人物的矛盾来自立场。
- 私下仍是这个年龄的小女孩，会喜欢同龄女孩会喜欢的东西。她不是缩小版中年刑警，也不是只会喊正义口号的吉祥物。
- OOC禁区：成年化、腐败警察、为了友情放弃原则、阴沉老练刑警模板、恋爱/性化。'''

# Keep the old 73-name relation map available on demand, not permanently injected every turn.
route = by_name('城市角色覆盖路由')
route['constant'] = False
route['keys'] = ['城市角色', '本地人物', '人物关系', '角色名单', '还有谁', '认识谁', '社交圈', '本地人物关系']
route['priority'] = 118
route['insertion_order'] = 118

# The complete house roster source contains 118 unique playable-room characters. Add only those not already in the
# rc1 relation map to a discovery pool. The pool is not constant, so normal scenes do not carry a phone book.
known_route = route.get('content', '')
missing = [n for n in manifest['house_roster'] if n not in known_route]

chunks = [missing[i:i+20] for i in range(0, len(missing), 20)]
roster_lines = '\n'.join('- ' + '、'.join(chunk) for chunk in chunks)
expanded = upsert(
    '扩展原作角色发现池',
    missing + ['新面孔', '本地活动', '本地新闻', '朋友介绍', '认识新的人', '陌生人', '新朋友', '新角色'],
    f'''【扩展原作角色发现池】
这是从原作“神器使之家”开放名单补入的低频/后期人物可达性索引，补足现有区域关系网未覆盖的角色。候选包括：
{roster_lines}

使用规则：
- 这些名字不是同一组织，也不代表他们必须待在同一区域。只有当{{{{user}}}}主动提到某人，或当前场景确实需要“新面孔/本地活动/新闻/朋友介绍”时，才从中选择一名最合理的人进入信息层或场景。
- 若模型对该角色原作资料没有可靠把握，先让其以公开信息、活动署名、朋友提及、工作名牌或短暂配角方式出现；不要现编父母、恋爱史、重大创伤、年龄、职业组织和核心性格。
- 后续{{{{user}}}}主动接近该角色时，可以逐步补充，但必须保持原作公开人格核。宁可暂时留白，也不要套通用“成熟温柔AI”人格。
- 不允许因为人物来自晚期/低频内容就让他/她连续“联系不上”。只要现实条件合理，明确寻找时应给出可执行的接触路径。
- 这份索引只负责“能遇见”，不代表所有人出现概率相同。地点、社交关系、工作日程和已建立关系始终优先。''',
    priority=135,
    constant=False,
    insertion_order=135,
)

# Strengthen the discovery rules without making random encounters noisy.
discovery = by_name('角色发现与触发机制')
if '118名' not in discovery['content']:
    discovery['content'] += '''\n8. 原作“神器使之家”去重后的118名角色均应处于可发现状态；详细区域锚点优先，未细化角色由“扩展原作角色发现池”承担低频发现。\n9. 低频并不等于不可达：若{{user}}已经明确寻找某个扩展池角色，连续3个合理场景转换仍不给接触路径属于失败。\n10. 高频合租/亲密角色只在其生活逻辑支持时高频出现；用户明确外出探索新社交圈时，不要让彼安汀、塞拉菲姆等熟人每次都跟随抢走新角色入口。'''

# Make the canon/AU guard distinguish fidelity from realism-normalization.
canon_guard = '''\n- 原作里即使存在现实社会中罕见或不合常规的履历（例如未成年妮维成为正式警察），只要不依赖神器/黑门等被删除的超自然机制，就优先保留原作事实，不以“更现实”为理由擅自正常化。'''
if canon_guard.strip() not in data['system_prompt']:
    data['system_prompt'] += canon_guard

# Clean the silent-check numbering introduced by rc1 and add one roster-specific check.
post = data.get('post_history_instructions', '')
post = post.replace('\n8. 当前登场角色的年龄阶段、职业来源和核心性格有没有被AU改写过头？\n9. 是否连续只让少数熟人登场，导致合理地点里的低频原作人物永远不可达？\n10. 若新角色没有详细锚点，是否擅自编了重大背景或把他/她写成通用温柔AI？',
                    '\n12. 当前登场角色的年龄阶段、职业来源和核心性格有没有被AU改写过头？\n13. 是否连续只让少数熟人登场，导致合理地点里的低频原作人物永远不可达？\n14. 若新角色没有详细锚点，是否擅自编了重大背景或把他/她写成通用温柔AI？\n15. 用户是在探索新社交圈吗？若是，高频熟人是否不合理地垄断了所有新角色入口？')
data['post_history_instructions'] = post

data['character_version'] = '0.3.0-rc2'
if '【v0.3 rc2全角色池】' not in data.get('creator_notes',''):
    data['creator_notes'] += f'''\n\n【v0.3 rc2全角色池】\n以灰机Wiki“神器使之家”开放名单去重得到118名房间角色作为可发现基线，并保留希罗、乌鹫、让·塔克、悠久乐园NPC等额外原作人物。现有详细区域关系网不常驻注入；其余{len(missing)}名进入非恒定扩展发现池，避免每回合把完整名册塞入上下文。'''

CARD.write_text(json.dumps(obj, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
print(f'patched rc2: version={data["character_version"]}, house={len(manifest["house_roster"])}, extension_missing={len(missing)}, entries={len(entries)}')
