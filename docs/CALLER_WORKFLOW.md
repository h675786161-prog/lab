# 业务仓库接入玲七实验酒馆

## 推荐方式：业务仓库调用 reusable workflow

把下面文件放到**业务仓库**的 `.github/workflows/real-sillytavern-lab.yml`：

```yaml
name: Real SillyTavern Lab

on:
  workflow_dispatch:
  push:
    branches: ['feature/**']

permissions:
  contents: read

jobs:
  real-sillytavern:
    uses: h675786161-prog/lab/.github/workflows/real-sillytavern.yml@main
    with:
      extension_name: your-extension-folder-name
      run_project_smoke: true
    secrets: inherit
```

把 `your-extension-folder-name` 换成这个插件安装到 `public/scripts/extensions/third-party/` 后应使用的目录名。

## 仓库访问说明

当前玲七实验酒馆仓库是公开仓库：`h675786161-prog/lab`。

业务仓库调用上面的 reusable workflow 时，不需要再为实验酒馆额外配置 Actions -> General -> Access。即使业务仓库本身是私有仓库，也可以直接引用这个公开 workflow。

如果以后实验酒馆再次改成私有仓库，再到实验酒馆仓库的：

`Settings -> Actions -> General -> Access`

按 GitHub 当时的访问规则显式允许需要调用它的仓库即可。

## 默认安装规则

如果业务仓库根目录存在 `manifest.json`，实验酒馆会把当前业务仓库复制到：

`public/scripts/extensions/third-party/<extension_name>`

然后启动真实 SillyTavern。

如果这个项目不是普通第三方扩展，例如脚本、主题或需要特殊目录结构，请在业务仓库增加：

`.lab/install.sh`

实验酒馆会把这些环境变量交给它：

- `ST_DIR`：隔离 SillyTavern 根目录
- `TARGET_DIR`：当前业务仓库 checkout
- `EXT_DIR`：默认扩展目标目录
- `LAB_EVIDENCE_DIR`：测试证据输出目录

## 项目自己的深度实机测试

业务仓库可增加：

`.lab/runtime-smoke.mjs`

实验酒馆基础 smoke 通过后会继续运行它，并提供：

- `LAB_ST_URL=http://127.0.0.1:8000`
- `LAB_ST_DIR`
- `LAB_EVIDENCE_DIR`
- `LAB_EXTENSION_NAME`
- `LAB_PLAYWRIGHT_CORE_ENTRY`
- `LAB_CHROME`

这样世界背面、小手机、酒馆诊所等可以各测各的业务，不需要把专项逻辑塞进实验酒馆。

## 多插件联调

reusable workflow 预留了 `extra_extensions_json`。额外仓库是私有仓库时，需要业务仓库提供一个只读 GitHub token / GitHub App token，并以 `lab_repo_token` secret 传入。

示例：

```yaml
    with:
      extension_name: world-backstage
      extra_extensions_json: >-
        [
          {"repository":"h675786161-prog/phone","ref":"feature/phone-realism-v1","name":"phone"}
        ]
    secrets:
      lab_repo_token: ${{ secrets.LAB_REPO_TOKEN }}
```

如果没有配置额外仓库，就完全不需要这个 token。
