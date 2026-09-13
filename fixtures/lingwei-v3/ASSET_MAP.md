# LingWei · Dream Dusk v3 素材映射

目标：SillyTavern 1.18.0 / commit `8172dcd0ee672d3cd9a5e5f7af134f91a45cd2b8`。

| 素材 | 真实组件 | 接入方式 |
|---|---|---|
| `chat-shell-frame.png` | `#sheld` 中央聊天主壳 | `border-image` 九宫格 |
| `top-nav-base.png` | `#top-bar` 顶部导航底座 | `border-image` |
| `left-drawer-base.png` | `#right-nav-panel` 左侧角色 Drawer | `border-image` 九宫格 |
| `right-drawer-base.png` | `#left-nav-panel` 右侧设置 Drawer | `border-image` 九宫格 |
| `input-bar-base.png` | `#send_form` 输入栏 | `border-image`，保留原生按钮 |
| `message-ai-paper.png` | AI `.mes_block` | `border-image` 九宫格，最小高 86px |
| `message-user-paper.png` | User `.mes_block` | `border-image` 九宫格，最小高 54px |
| `avatar-frame-bot.png` | AI `.mesAvatarWrapper::before` | 等比缩放，桌面目标约 82×90 |
| `avatar-frame-user.png` | User `.mesAvatarWrapper::before` | 等比缩放，右侧排版 |
| `date-divider.png` | `.lw-date-divider` | 仅日期/分隔件 |

## QA 覆盖

- 真实 SillyTavern `8172dcd0`。
- 真实 Chromium / Playwright。
- 单行 AI、4 行 User、16 行 AI、无空格超长连续文本。
- 10 个素材 computed-style 挂载检查。
- AI/User 头像尺寸检查。
- 左右 Drawer、中央聊天、输入栏与移动端几何检查。
- 完整桌面、长消息、移动端和五张局部截图。

## 加载顺序

1. `theme.css`
2. `layout-guard.css`

本目录直接保存最终 PNG，不再沿用错误仓库中的 base64 运输层。Actions 仅把 PNG 复制到一次性 SillyTavern runtime 的可服务目录，不修改 SillyTavern 源码。
