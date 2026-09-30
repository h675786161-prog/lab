# QA 分类与未完成项

当前重新运行：完整世界背面同装 34 项、无世界背面 31 项。两组均不安装小手机，不含界面验收。脚本在真实酒馆助手 iframe 中加载固定 MVU，执行真实 parseMessage 与消息变量写入。受控输入，不能替代模型自然剧情。

旧24项报告按历史记录保留：其中1项小手机桌面入口与路由属于已撤回的临时消费端实验；其余23项含无世界背面与账户重载。历史结果不作当前实现可用声明。原报告固定在实验酒馆 8d9a469e5e52ddf15a14d932ca59d45c8afc494e。当前结果重新独立运行，不把旧23项直接改名计为新通过。

## JSON异常

本轮观察到 /api/horde/status 和 /api/horde/text-models 返回500。酒馆服务器记录外部 aihorde.net DNS EAI_AGAIN；前端 public/scripts/horde.js 的 getModels 在未检查 response.ok 的情况下执行 response.json，非JSON的 Internal Server Error 导致原记录中的 Unexpected token 'I'。这是酒馆外部 Horde 请求及错误处理问题；卡侧测试继续通过，七都接口未依赖该路由。原异常 stack 为空，归因依据是同轮响应和源码，不能宣称全部页面错误都有完整调用栈。此请求问题不在卡侧范围内，未修改酒馆产品代码。

/api/settings/save 的503是测试主动注入，随后解除路由并正常保存。已验证酒馆原生 Settings could not be saved 提示。accountStorage.setItem 同步改内存，异步持久化由酒馆 saveSettingsDebounced 管理；相册 warning 能报告同步读取/写入故障，服务端持久化失败由酒馆原生提示，不能把 setItem 返回当落盘确认。

## GitHub Actions阻塞

PR16 commit 0da531d685ea8f47cdf5b47365c6703bbe8477d6 的 World Phone Realism QA run 36654854951 / job 109696871787：failure，steps=[]，runner_id=0，runner_name为空。主分支06b3cf92e30efec02aa05afbf1acc8e2aad8dcd0 的 run 36638417677 / job 109644638485 同样零步骤、未分配runner。

原生Phone Smoke job109696871427也未执行步骤。日志下载返回BlobNotFound；当前GitHub连接拒绝check-run annotations端点。已确认失败发生在测试运行前，但确切调度/账户根因尚无法确认，不能猜成计费、权限或配额。需要仓库管理者查看Actions页面Annotations。没有将失败标成产品测试通过；未改workflow、未重跑无条件失败任务、未修改小手机。

## P1与限制

编辑行为确定为：清空→等待实际重新提交；固定MVU不会自动因编辑重新解析。真实parse后编辑的迟到事务已验证被拒绝，编辑后新提交才恢复。

已增加十二次受控长文本真实解析，约6000汉字/次，期间快照保持空，正常结束且实际写入完成才更新。它验证时序，不是模型自然剧情。

自然模型长篇、真正请求中的重新生成/中途停止/跨轮回联调仍未完成。本地酒馆无模型密钥，运行环境也无授权的模型endpoint/key。当前不能制造回复后称模型实机通过。需要可用的隔离模型连接；不要求提供密钥明文。

同装回归覆盖完整扩展加载、Phone Bridge v2双向读取隔离、普通聊天清空，不代表两个产品所有功能或UI都完成回归。小手机未安装，本次没有桌面入口、应用UI、路由、窄宽屏或现有App回归。

相册跨剧情轮回并集保留，玩家账户设置被清空仍会丢失；不注入本轮known或提示词。读取损坏或版本不兼容保留原记录并告警，不覆盖。

结论：卡侧受控回归通过，正式合并条件未全部满足；自然模型验证与Actions根因保持待处理。
