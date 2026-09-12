# 七都选项回填桥

这是《永远的7日之都｜七日轮回文本互动》角色卡的伴随 SillyTavern 前端扩展。

作用只有一件事：当角色卡正则把 `<f7d_choice>` 渲染为带 `data-f7d-choice="1"` 的选项按钮后，点击按钮会把按钮文字回填到 SillyTavern 的 `#send_textarea`，触发 `input` / `change`，并把焦点交回输入框。扩展不会自动发送消息。

## 安装

把整个 `qidu-choice-bridge` 文件夹放到：

`SillyTavern/public/scripts/extensions/third-party/qidu-choice-bridge`

然后刷新或重启 SillyTavern。

## 验收口径

- 不使用 inline `onclick`。
- 桌面和手机端均可点击选项。
- 点击后只回填，不自动发送。
- 自定义选项文字在发送前仍可编辑。
- 角色卡正则被 SillyTavern 清洗后，`data-f7d-choice="1"` 仍须保留。
