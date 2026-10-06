# 真实酒馆离场对照回放证据

测试固定提交：a76bb18a1dd96a237a033d87b00bc9cbb54aad0c。
通过运行：https://github.com/h675786161-prog/lab/actions/runs/37424255769 。

同一份 1433 字符正文两轮散列均为 5961507276cabde943f14f6870cb781b8b9107216b95a0a2a868d2ba661c5e65。原守卫独白真、离场假；修正守卫独白真、离场真。原生生成中终端清空，真实消息变量写入后才通知。两个版本均零页面错误、零过期提交拒绝。

baseline.json 和 fixed.json 是真实浏览器记录，summary.json 为逐项断言摘要，manifest.json 记录运行、产物散列和前两轮失败分类。前两轮测试启动窗口问题未计入产品通过，第三轮完成酒馆首次设置后再关闭世界背面纸条，正常执行断言。源脚本在 `.lab/fixtures/qidu-day-gate/departure-audit/`，工作流为 `.github/workflows/qidu-departure-replay.yml`。

复现摘要（在本目录）：`python summarize-replay.py --directory . --run 37424255769 --commit a76bb18a1dd96a237a033d87b00bc9cbb54aad0c`。完整守卫模拟回归（在源码目录）：`node full-guard-regression.cjs`。实机复现需启动工作流所固定的隔离酒馆和浏览器，运行 `GUARD_VARIANT=baseline node .lab/fixtures/qidu-day-gate/departure-audit/native-replay.mjs` 后再运行 fixed 版本。

世界背面同时安装，自动推进关闭；没有加载小手机，没有远程模型请求和凭据读取。回放使用原真实模型运行 37211901343 的正文、指令与初始状态，不是新的自然模型生成。0.4.45 的结果不能替代第16号提案 0.4.41 候选卡专项验收。正式卡和原守卫未修改，补丁仅在测试导入时应用于内存。

剩余限制：原自然模型回复缺少完成原因，无法确认截断；晨间同条回复不扣巡查耗时，需要单独后续提交验证；0.4.41 的自然生成、重新生成、中途停止和跨轮回仍待专项验收。
