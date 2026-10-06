# 最终接口契约 v1

契约ID：f7d-terminal-v1。接口 version=1；MVU schema=f7d_textloop_0.4。卡侧候选实现及所有当前实机测试使用同一接口版本。交付修订为1.0.2（归一状态栏尾部空白、修正第六天晨间命令校验），不改变v1调用签名。

| 接口 | 入参 | 返回 | 错误与边界 |
| --- | --- | --- | --- |
| getSnapshot() | 无 | 同步 Envelope 深复制 | 读取/提交故障在 Envelope.error；调用者修改不反写 |
| subscribe(listener) | function(Envelope) | 同步返回幂等 unsubscribe() | 立即同步回调当前完整信封；后续清空/发布完整信封；非函数抛 TypeError；回调异常隔离 |
| getAsset(assetKey) | 白名单资源键 string | 同步 string 或 null | ready快照已收藏且资源存在才返回 data:image/png、jpeg或webp;base64；缺失/未解锁/空态/null均返回null；不得预加载未解锁图 |
| requestIntent(params) | {type,id?,revision} | Promise<IntentResult> | contact/viewTask 必须传对应id；viewTerminal可省略id；无任意命令或状态路径 |
| exportAlbum()（备份辅助） | 无 | 同步账户收藏JSON文本 | 不是剧情接口；账户读取异常可能抛出，调用者应提示导出失败；不支持静默导入/删除 |
| dispose()（生命周期） | 无 | void | 幂等；清空并通知，然后卸载监听、删除当前父窗口接口 |

Envelope精确结构：

```ts
type Envelope = {
  version: 1;
  status: 'ready' | 'empty' | 'error';
  reason: string;
  snapshot: Snapshot | null;
  error: {code: string; message: string} | null;
};
```

ready：snapshot非空，reason为空，error为null。empty：snapshot/error为null，reason为中文等待或失效说明。error：snapshot为null，reason为空，error为中文code/message。不用空数组冒充读取错误。ready的四类栏目暂时没有权威公开数据时，其数组确实为空。

```ts
type Snapshot = {
  schema: 'f7d-terminal-v1';
  scope: {chatId: string; branchId: string; loop: number};
  revision: string;
  header: {dayLabel: string; timeLabel: string; location: string};
  tasks: Array<{id:string;title:string;objective:string;status:'active'|'completed'|'expired'|'failed';statusLabel:string;deadlineLabel:string}>;
  contacts: Array<{id:string;name:string;channel:string;available:boolean}>;
  city: Array<{id:string;title:string;body:string}>;
  journal: Array<{id:string;title:string;body:string}>;
  album: {enabled:true;warning:string|null;items:Array<{id:string;title:string;assetKey:string}>};
};
type IntentResult = {
  ok: boolean;
  draft: string | null;
  inserted: boolean;
  error: {code:string;message:string} | null;
};
```

| 错误码 | 通道 | 含义/消费端处理 |
| --- | --- | --- |
| SCHEMA_INCOMPATIBLE | Envelope.error | MVU字段版本不兼容，清空展示，不猜字段 |
| INVALID_LOOP | Envelope.error | loop不是正整数，清空展示 |
| READ_FAILED | Envelope.error | 读取已提交变量失败，显示错误 |
| COMMIT_FAILED | Envelope.error | 有效事务写入失败，显示错误；过期事务不会变成当前聊天的错误 |
| NOT_READY | IntentResult.error | 还未ready、生成中或中止后，等待有效提交 |
| STALE_SNAPSHOT | IntentResult.error | revision不匹配，重读后重新选择 |
| CONTACT_UNAVAILABLE | IntentResult.error | 非已知取得联系人或不可联系 |
| TASK_UNKNOWN | IntentResult.error | 当前快照没有该任务 |
| INVALID_INTENT | IntentResult.error | 未授权操作类型 |
| COMPOSER_MISSING | IntentResult.error | 找不到输入框，draft保留，inserted=false |
| COMPOSER_OCCUPIED | IntentResult.error | 输入框已有任何内容（包括空格），不覆盖不追加；draft保留供玩家合并 |

校验顺序：先ready→revision→type/id→输入框。成功只填send_textarea并触发input，不调用发送、generate、MVU写入或资源扣除；草稿仍由玩家编辑/决定发送。草稿插入期间DOM异常可导致Promise拒绝，消费端必须捕获异常并显示“草稿写入失败”，不能自动重试发送。

接口版本不是1：消费端必须拒绝使用，清空并显示接口版本不兼容；未挂载接口为等待，不读旧缓存。schema也必须匹配。版本拒绝是消费端责任，本次没有修改小手机来实现它。

## 标识来源

chatId是SillyTavern.getContext().chatId，不取角色名字。普通酒馆无有效聊天时只显示empty，不造ID。
branchId是本提供者session UUID + 当前消息对象UUID + swipe_id + epoch，不是酒馆原生分支编号。切聊天、分支、编辑、删除、生成重新开始等均使旧epoch失效。
loop来自已提交stat_data.loop，必须正整数。
revision是session UUID + 单调提交序号，每次接纳快照增长，实例重载后UUID变化；不得用revision修改剧情。
内部ticket同时绑定chatId、characterId/groupId、完整消息序列对象身份/正文/swipe及epoch；StatusPlaceHolderImpl标签及尾部空白不参与正文签名；内部正文变化仍失效，真实编辑事件包括只改尾部空白也使旧epoch失效。

## 提交与失效

MVU解析结束mag_variable_update_ended不代表写入完成。钩子与指定MVU位于同一iframe，在import框架前包装updateVariablesWith/replaceVariables；await真实写入后重新getVariables，才可投影。解析临时结果不会发布。

CHAT_CHANGED、MESSAGE_SWIPED、MESSAGE_SWIPE_DELETED、MESSAGE_DELETED、CHARACTER_FIRST_MESSAGE_SELECTED先通知empty，再读取当前楼层已持久化变量，不向前搜索。MESSAGE_EDITED清空后等待后续有效提交，确定不补自动编辑重算。MESSAGE_SENT/RECEIVED清空等提交。事件监听makeFirst优先失效。

非quiet且非dryRun生成开始清空；生成期间实际写入也只pending；正常结束与真实提交两者都完成才ready。停止清pending、递增epoch并锁发布；迟到ended/写入拒绝，下一次正常生成解除。已写入变量不由适配器回滚。

新loop先empty再发布本轮公开投影。剧情重置必须清空known、terminal与任务公开标记，相册账户键不删除。

## 字段与认知

| 栏目 | stat_data路径 | 规则 |
| --- | --- | --- |
| 任务 | tasks.<key>.known/status/title/objective/deadline/deadline_known | known严格true；仅active/completed/expired/failed；pending隐藏；title缺用objective；期限须deadline_known；过期以status为准，不推算自然语言期限 |
| 联系人 | known、terminal.contacts.<key>.known/channel_acquired/name/channel/available | key在known且known/channel_acquired严格true；available true才允许联系；旧卡无真实通信方式，留空，不从relationships推造 |
| 资讯 | terminal.city[].id/title/body/known/loop | known严格true，loop本轮；缺项空 |
| 日志 | terminal.journal[].id/title/body/known/loop | known严格true，loop本轮；不抽聊天正文冒充权威日志 |
| 页头 | day/clock_minutes/location | 仅已提交值的格式转换 |
| 相册 | meta.cg、cg_system.shown、账户f7d.album.v1 | 归一cg_前缀、白名单解锁，与已有收藏并集去重 |

known、deadline_known与terminal是候选卡新增公开契约；旧存档缺标记必须隐藏。intel_flags、npc_intel、hiro、route_flags不交手机；区域解放不自动等于任务完成。输入的known是剧情侧权威标记，适配器不会推断其正确性。

## 相册保存

账户键f7d.album.v1，{version:1,items:string[]}。同账户同七都作品共享，跨聊天/分支/轮回保留，其他账户隔离。仅在接纳有效提交时合并解锁；不写回人物known或模型提示词。

读取损坏、格式/版本不兼容：保留原记录并通过album.warning提示，不覆盖。同步写入失败：warning显示暂未保存，当前已解锁图仍可查看。账户后台落盘失败由真实酒馆原生设置保存错误提示；setItem不返回持久化确认，消费端不能显示“已永久落盘”。可导出备份；清空账户设置、迁移未备份仍会丢失。

## 小手机消费端完整配合清单

1. 在父窗口读取f7dTacticalTerminal；监听f7d:provider-ready，提供者更换时取消旧订阅再绑定；无提供者为空态。
2. 校验接口version=1；subscribe完整替换页面，不合并旧栏目的数组；empty/error立即清空。
3. 使用snapshot.scope与revision，不从聊天正文、世界背面或好感兜底推数据。
4. 按当前公开task/contact投影生成按钮；available=false禁联系；所有行动带当前revision，异步捕获结果及异常。
5. 草稿只供编辑、合并；失败不自动发送，不覆盖原输入，不自动改变量。
6. 相册只调用getAsset(已收藏assetKey)；null显示缺图，warning明确呈现；不要预加载锁定图片。
7. 扩展卸载/重绑调用unsubscribe；订阅即时回调可重入，初始化引用须先准备好。
8. 将账户收藏视为玩家菜单信息，不能作为人物本轮记忆或剧情输入。
9. UI入口、路由、窄宽屏及现有App回归由消费端另开实现PR，真实联调前不正式合并。

