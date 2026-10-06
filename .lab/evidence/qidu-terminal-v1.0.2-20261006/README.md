# 七都终端交付修订1.0.2：三轮实机结果

本目录固定原始JSON与可执行复核脚本，不安装或改动小手机，不包含消费端UI验收。最新候选源码固定到46c062a370c76b49ed530020e5aface03720162b，目录为.lab/fixtures/f7d-terminal-v1.0.2；原1.0.1正式附件4cd2f36b740ba46a2b5d11bfb18fe4a211b146cf保持原样。接口仍为v1，交付修订为1.0.2，尚未晋升为完整验收通过版本。

| 运行 | 固定源码 | 实际结果 |
| --- | --- | --- |
| [37453510900](https://github.com/h675786161-prog/lab/actions/runs/37453510900) | 358d855c24119966fd371d30a7a20f2af7c4ed04 | 守卫27项、隔离单测24项、交付核验及受控两轮实机回放通过。自然晨间独白已提交，模型仅写带离主廊，离场命令被拒绝；巡查使用独立起点，连续性断言失败。 |
| [37454515356](https://github.com/h675786161-prog/lab/actions/runs/37454515356) | ec2907abba73efb61f85ab301ada6d46225c6aa5 | 守卫32项、隔离单测24项、交付核验及受控两轮回放通过。自然正文明确驶离中央庭，但守卫漏判醒前轻语及担架护送表达；两旗标未完成，连续性失败。 |
| [37455246606](https://github.com/h675786161-prog/lab/actions/runs/37455246606) | 46c062a370c76b49ed530020e5aface03720162b | 守卫36项、隔离单测24项、交付核验及受控晨间→巡查实机通过。自然晨间全部11项断言通过；连续巡查请求HTTP524，未生成完成，工作流整体失败。 |

三轮工作流均在自然阶段失败，后续完整世界背面34项回归全部跳过，不能计为本修订通过。世界背面确实同装于自然及回放测试环境，但不等于34项桥隔离场景在本修订执行。此前1.0.1及签名专项34项、无世界背面31项保留原固定证据，不冒充本次重跑结果。

最终自然晨间：实际请求原生Gemini，HTTP200、finish_reason=stop、SSE DONE，无无效帧、无截断、无过期票据拒绝；真实消息变量day6_monologue/day6_saiham均为true，clock_minutes=480。生成开始empty，实际MVU写入及生成正常结束后ready；通知时已读取提交值。真实巡查没有重新播种起点，但收到HTTP524并抛出请求错误，未形成patrol.json或完整场景断言。没有采集失败请求后的最终终端快照，不能宣称已经验证HTTP524下的终端清空或恢复行为；该专项待补。

前两轮完整自然回复均HTTP200且正常结束，真实提交链与终端通知正常；失败在晨间演出/守卫语义与自然连续性，不能再归为正文签名取消。第一轮只是移动出主廊，不能放宽成离开整个中央庭。第二轮实际失败正文已收入候选回归夹具，36项测试包含正例及主廊、对白动作、回忆、假设、否定、仅队伍驶离等反例。守卫只过滤模型命令，不补旗标、不直接写MVU；未知自然表达仍可能保守拒绝。

每个attempt保留replay/natural下原始terminal-live.json、场景及checkpoint文件；jobs.json记录每个步骤实际状态。第三轮只有morning.json，自然summary保留524响应及错误栈。原始JSON与下载ZIP逐字节核对；截图在相应Actions产物，产物ID与ZIP散列见manifest.json。attempt3/unit-validation.log是完成工作日志中的测试步骤原文摘录，不包含凭据配置段。manifest固定所有原始文件的大小、SHA256、各轮源码、依赖、结果与失败分类。证据复核通过不等于产品全项通过。

两次被后续提交替代的运行37453139569、37453347431实际为cancelled，记录在superseded-jobs.json；它们不计为玩家停止生成的产品验收。

复现：检出最新固定源码，按.lab/fixtures/f7d-terminal-v1.0.2/INSTALL.md安装隔离酒馆，使用.github/workflows/qidu-terminal-v1-0-2.yml中的固定准备命令与现有测试账户GG secret。运行node --test .lab/fixtures/f7d-terminal-v1.0.2/guard.test.mjs、node --test .lab/fixtures/f7d-terminal-commit-fix/isolation.test.mjs及verify-delivery.mjs；F7D_REPLAY=1 node .lab/fixtures/f7d-terminal-v1.0.2/native-live.mjs执行受控回放，去掉该变量执行真实请求。自然请求具有模型随机性和远端可用性，不保证复现相同措辞。启动状态受控为第六天08:00、晨间未完成、高校与古街已解放；不是从第七天起完整长篇游玩。第二、三轮将输入明确为走出大门、离开整个区域，与第一轮提示词不同，不声称严格相同输入对照。

在本目录运行node verify-evidence.mjs可独立核对原始报告、步骤状态、旗标、提交后通知和完成元数据。最新候选卡SHA256为1fc39f446b31efe33cbe15f1c2f94803887ba30ce5c9de7ca4c9894ef1abeeda；脚本、图片散列及依赖见候选manifest.json。

待完成：远端请求恢复后完整自然连续巡查、本修订完整世界背面34项与无世界背面31项回归、真正长篇、网络生成中的停止/重新生成/跨轮回专项，以及原手机Actions零步骤无runner根因。相册与草稿边界已有历史受控证据，但不因本次晨间通过而扩大其验收范围。PR16仍仅契约文档并保持草稿，不合并主分支。
