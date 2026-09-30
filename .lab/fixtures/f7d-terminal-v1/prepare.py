import base64, gzip, json
from pathlib import Path
root = Path(__file__).parent
raw = gzip.decompress(base64.b64decode((root / 'card.json.gz.b64').read_bytes()))
json.loads(raw)
(root / 'Qidu-v0.4.41-terminal-v1.json').write_bytes(raw)
print('候选卡已解压；按使用说明准备真实酒馆与扩展后运行验收脚本。')
