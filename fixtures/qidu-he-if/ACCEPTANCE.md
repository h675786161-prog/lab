# 交界都市：普通人的人生 HE IF v0.2.1 验收记录

## 结论

角色卡本体 **v0.2.1 已通过长期 RP、真实 SillyTavern、真实浏览器与 Custom Chat Completion 链路验收**。

当前 `YOUZI` 重复验收受上游账户额度与 `[B]glm-5.3-flash` 模型通道可用性阻断，因此“当前供应商此刻能否继续生成”与“角色卡是否通过验收”分开记录，不将上游故障误判为角色卡回归。

正式角色卡：`fixtures/qidu-he-if/qidu-he-if.character.json`

正式版本：`0.2.1`

已验收文件 SHA256：

`a26dc7b893776649ba51699bb9ac38749ca253c34b8db56515b4dc9ca02ac17f`

仓库正式文件与已通过验收的候选 artifact 已确认逐字节一致。

## 验收环境

- 仓库分支：`qidu-he-if-longrp`
- 不合并、不修改 `main`
- SillyTavern commit：`8172dcd0ee672d3cd9a5e5f7af134f91a45cd2b8`
- Provider：SillyTavern Custom Chat Completion
- Upstream：`https://youzi.today/v1`
- Secret：GitHub Actions secret `YOUZI`，只写入隔离 ST 的 `api_key_custom`，不记录明文
- 模型：`[B]glm-5.3-flash`
- RPM 上限：12
- 预设：`fixtures/qidu-he-if/riyuexi-glm-active.json` 中本项目启用的 RP / 群像 / 去中心化 / 自然推进等核心模块

## 长期 RP 实测

### 36 回合基线长测

Run `34637894140` 从前序 31 回合 checkpoint 恢复并完成第 32–36 回合及完整审计。

实测暴露的问题包括：

1. 彼安汀、希罗长期对话后被模型磨成“高情商健康沟通模板”。
2. “指挥使”等词可能触发《永远的7日之都》原作游戏/设定元叙事回弹。
3. 少量未声明的 `{{user}}` 行为被模型擅自补足。
4. GLM 高思考预算下曾出现正文截断、reasoning-only、空 `content`。
5. 后续回归进一步发现模型会趁失忆设定捏造 `{{user}}` 的开场前历史，例如食物偏好、与希罗见面次数、旧消息等。

这些问题均进入后续 v0.2 / v0.2.1 修订，而不是只保留 judge 分数。

## v0.2 / v0.2.1 修订重点

- 防“全员高情商 AI 化”。
- 彼安汀保留温和、茶味、私心与偶尔不痛快，不自动发表成熟关系宣言。
- 希罗保留 42 岁成年人的野心、研究兴趣、试探和危险性，不因恋爱线被洗成安全型年上。
- 塞拉菲姆不充当叙事百科说明器。
- 禁止《永远的7日之都》及原作体系在世界内作为已知作品/隐藏真相回弹。
- 多线关系以各角色具体反应呈现，不自动变成开放关系伦理研讨会。
- 强化 `{{user}}` 行动边界。
- 新增“失忆前事实冻结”：没有 persona、角色卡、已确认对话或可靠记录支持的过去事实一律不得编造。

## v0.2.1 定向回归

Run `34641038325` 完成并通过 7 轮定向攻击测试，覆盖：

- “指挥使”与原作标题诱导。
- 是否把用户提供的标题擅自识别为已知原作游戏。
- 是否捏造“以前只吃半熟蛋”。
- 是否捏造与希罗见面次数。
- 彼安汀在多线关系中的吃醋/私心与非控制性。
- 希罗面对边界问题是否被洗成标准安全型恋人。
- 用户只说想去书店时，是否擅自移动 `{{user}}` 到具体地点。

上述门禁全部通过。

## 真实 SillyTavern + 浏览器验收

Run `34641038325` 使用固定 SillyTavern commit 启动隔离实例，导入 v0.2.1 候选角色卡，并通过真实浏览器从 SillyTavern 的 Custom Chat Completion 后端调用 YOUZI / GLM。

链路：

`Chrome/Playwright → SillyTavern → /api/backends/chat-completions/generate → Custom provider → YOUZI → [B]glm-5.3-flash`

该次实测取得可见 RP 正文，浏览器无 page error。针对“我以前是不是只吃半熟蛋？”的测试，彼安汀明确保持未知过去，不编造用户失忆前偏好。

因此该版本不是只通过 JSON 校验或 API 直连，而是已经获得真实 ST + 浏览器 + 模型生成证据。

## 正式文件一致性

角色卡随后被正式写回：

`fixtures/qidu-he-if/qidu-he-if.character.json`

正式文件 SHA256：

`a26dc7b893776649ba51699bb9ac38749ca253c34b8db56515b4dc9ca02ac17f`

与 Run `34641038325` 已通过真实 ST 验收的 v0.2.1 artifact SHA256 完全一致。

因此，“CI 工作区候选通过，但仓库正式文件不是同一份”的可能性已排除。

## 当前 YOUZI 上游状态

正式文件重复运行验证中，SillyTavern runtime 捕获到 YOUZI 上游错误：

- `insufficient_user_quota` / `账户额度不足`
- `model_not_found`
- `[B]glm-5.3-flash` 当前无可用 channel

ST 的该 Custom backend 在这一情况下可能向浏览器返回 HTTP 200 但无可见 `choices[].message.content`，因此不能把“200 + 空正文”误判为角色卡失败或生成成功。

最新 committed verify workflow 将结果分类为：

`blocked_upstream`

并同时确认：

- committed SHA256 = accepted SHA256
- `byteIdentical = true`
- 固定 ST 能正常启动
- 角色卡可正常导入
- 当前重复模型生成被 YOUZI 额度/模型通道阻断

## 最终判定

### 角色卡本体

**PASS / 能用。**

已有真实长期 RP 和真实 SillyTavern 浏览器生成证据，正式提交文件又与该已验收候选逐字节一致。

### 当前 YOUZI + `[B]glm-5.3-flash` 即时可玩性

**BLOCKED UPSTREAM。**

当前不能据此声称“此刻通过该供应商仍可正常连续生成”。待 YOUZI 额度或模型 channel 恢复后，可直接重新运行 `.github/workflows/qidu-he-v021-committed-verify.yml` 获取新的 `repeat_runtime_pass` 证据，无需重新修改角色卡。
