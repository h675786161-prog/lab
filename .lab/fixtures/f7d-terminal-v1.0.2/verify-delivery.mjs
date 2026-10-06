import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const manifest=JSON.parse(await fs.readFile(path.join(root,'manifest.json'),'utf8'));
assert.equal(manifest.deliveryRevision,'1.0.2');assert.equal(manifest.interfaceVersion,1);
for(const[name,value]of Object.entries(manifest.files)){
 const bytes=await fs.readFile(path.join(root,name));assert.equal(bytes.length,value.bytes,name);
 assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),value.sha256,name);
}
const card=JSON.parse(await fs.readFile(path.join(root,'Qidu-v0.4.41-terminal-v1.0.2.json'),'utf8'));
assert.equal(card.data.character_version,'0.4.41-terminal-v1.0.2');assert.equal(card.character_version,card.data.character_version);
const scripts=card.data.extensions.tavern_helper.scripts;
const guard=await fs.readFile(path.join(root,'morning-guard.js'),'utf8');
assert.equal(scripts.find(s=>s.id==='qidu-v0425-mvu-guard').content.trim(),guard.trim());
const hook=await fs.readFile(path.join(root,'mvu-commit-hook.js'),'utf8');
assert.ok(scripts.find(s=>s.id==='qidu-v0425-mvu').content.startsWith(hook.trim()));
const provider=scripts.find(s=>s.id==='qidu-terminal-provider-v1').content;
assert.ok(provider.includes(".trimEnd()"));assert.ok(provider.includes('version:1'));
const match=provider.match(/const assets = (\{.*?\});/s);assert.ok(match,'内置图片白名单必须保留');
const assets=JSON.parse(match[1]);assert.equal(Object.keys(assets).length,10);
for(const[id,asset]of Object.entries(assets))assert.equal(crypto.createHash('sha256').update(asset).digest('hex'),manifest.assets[id],id);
const standalone=await fs.readFile(path.join(root,'card-provider.js'),'utf8');
assert.equal(provider.trim(),standalone.trim().replace('window.__f7dCardAssets || {}',match[1]));
console.log('候选卡、三个独立脚本、v1契约版本及十张原始图片散列一致。');
