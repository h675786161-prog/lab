from pathlib import Path
import json,shutil
source=Path('.lab/fixtures/f7d-terminal-v1-formal')
target=Path('/tmp/qidu-fixed-fixture')
target.mkdir(exist_ok=True)
card=json.loads((source/'Qidu-v0.4.41-terminal-v1.json').read_text())
script=card['data']['extensions']['tavern_helper']['scripts'][0]
old="String(m.mes || '').replace(/<StatusPlaceHolderImpl\\/>/g, '')"
assert script['content'].count(old)==1
script['content']=script['content'].replace(old,old+'.trimEnd()')
(target/'Qidu-v0.4.41-terminal-v1.json').write_text(json.dumps(card,ensure_ascii=False))
shutil.copyfile(source/'mvu-commit-hook.js',target/'mvu-commit-hook.js')
