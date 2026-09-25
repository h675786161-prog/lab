# 七都主卡6交接：Final Release Gate #53

更新时间：2026-09-26（北京时间）。

## 当前结果
- 分支：`feature/qidu-card-v0411-lab`。禁止合并或修改 main。
- 卡版本：0.4.24；作者：叶罹。
- 最终卡 SHA256：`1e648885197aba5f4a54734c767a5baf67edbbcf72723d0df52cae1aca5b9c98`。
- 最终卡大小：1,046,058 bytes。
- 最终门：https://github.com/h675786161-prog/lab/actions/runs/36126367280 （#53，SUCCESS）。
- 受测提交：`3bcf24f67abe8d9531f5106eacd293ceb380f7aa`。
- 完成于 2026-09-25 19:57（北京时间）；package 已实际生成。
- 最终产物 artifact ID：10862945836；narrative 证据 artifact ID：10863040554。

## 验收结果
- 真实 SillyTavern + Tavern Helper、选项回填/替换/聚焦/不自动发送、自由输入保留草稿：PASS。
- 10 个内嵌 CG 浏览器加载和响应式检查：PASS。
- CG behavior A/B：全部通过，合计12个用例（含未知性别与重复显示抑制）。
- narrative 12组最终全部通过：core 6/6、encounter 3/3、conflict 2/2、info 8/8、NPC 4/4、offscreen 2/2、chimera PASS、gender 3/3、shell 4/4、flow 8/8、deadlines 5/5、endings 7/7。
- 剧情调度/结局结算顺序专项：5/5，同一卡哈希，run 36119316557。
- 注意：#53自身尚未包含后续提交63ab36e新增的dispatch步骤；该专项证据来自上述独立运行，不应声称其已在#53内部执行。

## 本轮修复与补验
- 原GitHub runner缺中文字体，截图中文呈方框。仅修复测试环境，在正式门与真实ST专项安装fonts-noto-cjk。
- 修复提交：`7fa7f3eca057c6e908e9cfbb1027a914462db86f`。
- 中文字体修复后的真实ST专项 #19：https://github.com/h675786161-prog/lab/actions/runs/36127901915 ，SUCCESS。
- 补验 artifact ID：10860333311。已目视检查手机/桌面选项和手机横竖CG截图，中文可读、无溢出。
- 补验导出的卡、#53实机导出的卡、#53最终包内卡，逐字节一致。

## 重试与证据边界
- info 前两次运行有接口超时；第二次另有一次 `negated_secret_name_not_visible / missing-natural-deflection` 行为断言失败。第三次整组8/8通过。
- gender 首次 `unknown_persona_neutral_pronoun` status 0/state-missing，重试整组3/3通过。
- CG B 的未知性别用例先遇接口超时，改用gemini-2.5-pro后通过；大部分其他用例使用gemini-3-flash-preview。
- 因此可陈述“最终门通过（含重试）”，不可陈述“所有用例首跑全绿”或保证所有模型/任意长聊永不出错。

## 当前规则与后续
- 以当前生成器和受测候选为准；已采用剧情流速推进，取消旧行动节点/六巡查计数，CG direct_only且无相册。
- 剧情优先级：强制剧情 > 首轮关键主线 > 玩家明确选择的同行神器使 > 当前地区剧情 > 自由/随机事件。
- 结算顺序：线路关闭 > 强制剧情结果 > 结局资格 > 结局优先级 > 演出/CG。
- 本轮目标已完成，无待处理失败门。没有新需求时不要为了继续而改卡或重复全量回归。
- 已向用户交付本次最终JSON并更新原文件版本。未发布GitHub Release、未合并main、未恢复此前暂停的每小时自动任务。
