import json, pathlib, hashlib, subprocess

root = pathlib.Path('.lab/fixtures/qidu-day-gate')
subprocess.run(['python3', str(root / 'apply-node1.py')], check=True)

src = root / 'Qidu-v0.4.46-node1-guard-fix.json'
dst = root / 'Qidu-v0.4.47-node2-day6-live-fix.json'
card = json.loads(src.read_text(encoding='utf-8'))

entries = card['data']['character_book']['entries']
entry = next(e for e in entries if '11｜第6天：赛哈姆活骸事件' in e.get('comment', ''))

heading = '【第6天活骸信息白名单｜3f实机补强】'
patch = r'''
【第6天活骸信息白名单｜3f实机补强】
1. 当前已加载资料没有定义“中央庭对活骸的固定处置条例”。禁止任何角色、旁白或选项把以下内容写成既定事实：安托涅瓦会当场击毙/处决/抹杀赛哈姆；中央庭上报后必然杀死赛哈姆；中央庭“除了消灭她没有第二种选择”；存在“唯一处置预案/条例”要求杀死活骸。不得用“现场安全”“普通房间关不住”“设备只剩几分钟”等临时理由，绕写成上述必杀制度。
2. 希罗此处允许表达的立场仅限：他希望把赛哈姆带回研究所继续控制、观察、抢救或研究；他与安托涅瓦可能存在处置立场分歧；他要求指挥使暂时保密。希罗可以坚持、劝说或质疑，但不能援引未定义的中央庭制度替自己的立场背书。
3. “活骸化”只按已加载资料视为神器使可能遭遇的异常/失控风险。禁止扩写成“所有神器使必然走向活骸化”“这是所有神器使的宿命/终局”。未定义的病理链、发生概率、神经机制、绝对不可逆性、专用治疗原理一律不得补造。
4. 当玩家明确允许希罗带赛哈姆离开中央庭时，正文必须把“赛哈姆本人实际随队离开中央庭”写清楚，再登记 day6_saiham=true；只写准备搬运、担架启动、希罗转身、希罗独自离开都不算。
5. 当希罗已经离开而赛哈姆仍留在中央庭时，必须保持 day6_saiham=false。不得因为“希罗离场”或“事情暂时告一段落”提前完成事件。
'''
if heading not in entry['content']:
    entry['content'] = entry['content'].rstrip() + '\n\n' + patch.strip() + '\n'

card['character_version'] = '0.4.47-node2-day6-live-fix'
card['data']['character_version'] = '0.4.47-node2-day6-live-fix'
dst.write_text(json.dumps(card, ensure_ascii=False, indent=2), encoding='utf-8')
print(f'node2 candidate ready: {dst} sha256={hashlib.sha256(dst.read_bytes()).hexdigest()}')
