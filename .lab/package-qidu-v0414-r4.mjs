import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { loadV0414R3Card } from './qidu-card-v0414-r3.mjs';

const workspace = process.env.GITHUB_WORKSPACE || process.cwd();
const outRoot = process.env.QIDU_PACKAGE_OUT || path.join(workspace, 'dist', 'qidu-card-v0414-r4');
const bridgeSource = path.join(workspace, 'qidu-choice-bridge');
const bridgeTarget = path.join(outRoot, 'qidu-choice-bridge');

await fs.rm(outRoot, { recursive:true, force:true });
await fs.mkdir(outRoot, { recursive:true });

const { card, raw, compactSha256 } = await loadV0414R3Card(workspace);
const cardName = '永远的7日之都-七日轮回文本互动-v0.4.14-lab-r4.json';
await fs.writeFile(path.join(outRoot, cardName), raw);
await fs.cp(bridgeSource, bridgeTarget, { recursive:true });

const sha256File = async (filePath) => {
  const data = await fs.readFile(filePath);
  return crypto.createHash('sha256').update(data).digest('hex');
};

const bridgeIndexSha = await sha256File(path.join(bridgeTarget, 'index.js'));
const bridgeManifestSha = await sha256File(path.join(bridgeTarget, 'manifest.json'));

const packageManifest = {
  package: 'qidu-card-v0414-r4',
  characterVersion: card.data.character_version,
  cardFile: cardName,
  cardSha256: compactSha256,
  worldbookEntries: card.data.character_book?.entries?.length || 0,
  bridge: {
    directory: 'qidu-choice-bridge',
    version: '1.0.0',
    indexSha256: bridgeIndexSha,
    manifestSha256: bridgeManifestSha,
  },
  acceptance: {
    realSillyTavernCommit: '8172dcd0ee672d3cd9a5e5f7af134f91a45cd2b8',
    desktopViewport: '1440x1000',
    mobileViewport: '390x844',
    clickBehavior: 'refill #send_textarea; dispatch input/change; never auto-send',
  },
};
await fs.writeFile(path.join(outRoot, 'package-manifest.json'), JSON.stringify(packageManifest, null, 2));

const install = `# 七都卡 v0.4.14-lab-r4 安装说明\n\n这个包由角色卡 JSON 与一个很小的 SillyTavern 前端扩展组成。选项按钮的视觉由角色卡正则负责；点击后回填输入框由扩展负责。人类前端为了安全会清洗 inline onclick，所以别再试图让一张 JSON 自己长出事件监听器，浏览器不吃这一套。\n\n## 1. 安装选项回填桥\n\n把整个 \`qidu-choice-bridge\` 文件夹复制到：\n\n\`SillyTavern/public/scripts/extensions/third-party/qidu-choice-bridge\`\n\n刷新或重启 SillyTavern。\n\n## 2. 导入角色卡\n\n在 SillyTavern 中导入：\n\n\`${cardName}\`\n\n## 3. 验证\n\n进入聊天后，出现剧情决策时应看到美化选项按钮。点击按钮后：\n\n- 按钮文字进入发送框；\n- 不会自动发送；\n- 仍可手动修改文字；\n- 手机端选项为单列，桌面端可多列；\n- 若按钮只能看不能点，先检查扩展是否加载。\n\n## 已验收\n\n候选卡哈希：\n\n\`${compactSha256}\`\n\n真实 SillyTavern 验收固定提交：\n\n\`8172dcd0ee672d3cd9a5e5f7af134f91a45cd2b8\`\n`;
await fs.writeFile(path.join(outRoot, '安装说明.md'), install);

const sums = [
  `${compactSha256}  ${cardName}`,
  `${bridgeIndexSha}  qidu-choice-bridge/index.js`,
  `${bridgeManifestSha}  qidu-choice-bridge/manifest.json`,
].join('\n') + '\n';
await fs.writeFile(path.join(outRoot, 'SHA256SUMS.txt'), sums);

console.log(JSON.stringify(packageManifest, null, 2));
