import json,hashlib,argparse
from pathlib import Path
parser=argparse.ArgumentParser()
parser.add_argument('--directory',required=True)
parser.add_argument('--run',required=True)
parser.add_argument('--commit',required=True)
args=parser.parse_args()
root=Path(args.directory)
rows=[]
for name in ('baseline','fixed'):
 p=root/(name+'.json')
 if not p.exists(): raise RuntimeError('实机结果尚未获取')
 x=json.loads(p.read_text())
 assert not x.get('failure'),x.get('failure')
 assert not x['errors'],x['errors']
 assert len(x['rounds'])==1
 r=x['rounds'][0]
 want=name=='fixed'
 assert r['after']['morning_flags']['day6_monologue'] is True
 assert r['after']['morning_flags']['day6_saiham'] is want
 assert r['after']['clock_minutes']==480
 assert r['terminal']['status']=='ready'
 assert r['snapshots'][-1]['committedFlags']['day6_saiham'] is want
 rows.append({'variant':name,'passed':True,'model_calls':0,'local_replay_requests':x['replayed'],'committed_monologue':True,'committed_departure':want,'clock_minutes':480,'page_errors':x['errors'],'stale_commit_rejections':r['diagnostics'],'notification_sequence':[{'status':s['status'],'reason':s['reason'],'committed_departure':s.get('committedFlags',{}).get('day6_saiham')} for s in r['snapshots']],'publications':r['publications'],'native_reply_sha256':hashlib.sha256(r['text'].encode()).hexdigest()})
result={'tested_commit':args.commit,'workflow_run':args.run,'source_model_run':'37211901343','candidate_version':'0.4.45','scope':'真实酒馆受控回放；不作为新的自然模型长篇验证，也不替代第16号提案0.4.41候选卡验收','prior_attempts':[{'run':'37423386996','baseline':'通过','fixed':'启动弹窗点击竞态，未进入剧情检查','classification':'测试脚本基础设施问题'},{'run':'37423671545','baseline':'启动阻塞','fixed':'启动阻塞','classification':'首次设置窗口遮挡世界背面纸条，未进入剧情检查'}],'complete_guard_simulated_cases':9,'rows':rows,'remaining':['原真实模型回复未记录完成原因，无法确认截断','同条晨间回复不扣巡查时间，需要单独后续提交验收','0.4.41候选卡自然生成、中止、重新生成和跨轮回仍需专项测试'],'phone_modified':False}
Path('audit/replay-summary.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(result,ensure_ascii=False,indent=2))
