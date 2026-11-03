# 奶龙工坊 · 品牌与内置桌宠

为 Windows TokenWorks 提供一个品牌插件与三款桌宠，四组件独立选择安装。

<!-- preview-link:start -->
**[点击预览](https://twinjades.github.io/tokenworks-nailong/)** · 品牌截图与三款桌宠十状态交互预览。
<!-- preview-link:end -->

| 组件 | 说明 | 来源 | 预览 |
| --- | --- | --- | --- |
| `brand` | 奶龙工坊品牌文字与图标 | 本项目代码；图标由用户提供 | [![品牌截图](site/assets/brand-preview.png)](https://twinjades.github.io/tokenworks-nailong/#brand) |
| `nailong-zhengyici` | 精灵图动画；部分状态复用 | [Zhengyici/nailong-pet-skill](https://github.com/Zhengyici/nailong-pet-skill) | [![Zhengyici 待机](site/assets/nailong-zhengyici.gif)](https://twinjades.github.io/tokenworks-nailong/#nailong-zhengyici) |
| `nailong-erich207` | 精灵图动画；部分状态复用 | [erich207/nailong-codex-pet](https://github.com/erich207/nailong-codex-pet) | [![erich207 待机](site/assets/nailong-erich207.gif)](https://twinjades.github.io/tokenworks-nailong/#nailong-erich207) |
| `nailong-mosterpath` | 静态表情与笑 GIF 转换动画，无声音；保留原图背景 | [mosterpath/pet-nailong](https://github.com/mosterpath/pet-nailong) | [![mosterpath 待机](site/assets/nailong-mosterpath.gif)](https://twinjades.github.io/tokenworks-nailong/#nailong-mosterpath) |

品牌截图由用户提供，展示旧版图标；实际打包图标为用户选定的白底挥手奶龙。桌宠进入现有 **设置 → 桌面宠物** 图库，不运行额外的桌宠程序。mosterpath 待机素材为静态图，缩略 GIF 不代表具有原生逐帧待机动作。

## 安装与卸载

### 品牌：使用 TokenWorks 的“添加插件”

1. 打开侧栏 **插件 → 添加插件**。
2. 在上方“包名、GitHub 仓库地址或本地目录路径”输入框粘贴 `https://github.com/TwinJades/tokenworks-nailong`；也可下载项目，输入项目根目录绝对路径。
3. 安装源保留 npm 官方源或大陆镜像。**“自定义地址”是 npm registry，不要在那里填写 GitHub 地址。**
4. 安装后在插件列表管理“奶龙工坊品牌”，按宿主提示重启；启用、停用与卸载均由宿主管理。停用撤销品牌替换，不改聊天与认证配置。

GitHub 安装只安装品牌，**不会顺带安装三个桌宠**。仓库包含构建产物，无需 Python 或安装时构建。

### 桌宠：使用选择安装工具

需要 Windows、Node.js 22 或以上及已安装的 TokenWorks。先完全退出应用（含托盘），双击 `install.cmd`，仅选择需要的桌宠。不默认全选，空选择取消。

```sh
node scripts/install.mjs status
node scripts/install.mjs install --components nailong-erich207 --dry-run
node scripts/install.mjs install --components nailong-erich207
node scripts/install.mjs uninstall --components nailong-erich207
```

非默认位置传入 `--root "TokenWorks安装根目录"`。删除只送回收站，回收失败报错；重启后在 **设置 → 桌面宠物** 选择形象。

### 从旧版品牌安装迁移

先完全退出 TokenWorks，执行 `node scripts/install.mjs uninstall --components brand` 清理此前由本工具记录的产品装配安装；多 profile 时指定原 `--profile`。随后重开应用，从插件页添加本项目。清理遇到陌生条目或修改过的文件会拒绝删除，不能绕过保护。新安装器拒绝 `install --components brand`，避免双重加载。

旧产品目录中的同名包可能优先于新 profile 包解析，必须先成功清理旧安装，再添加新组合包；仅刷新列表不能消除冲突。若旧安装不是本工具管理，请保留并联系维护者核对，不能强行删除陌生包。

不修改 `eduwork.jsonc`、认证地址、账号、凭据、对话、原有宠物及其开关或选择。不要手工追加品牌装配条目。

## 让 Agent 安装

复制以下提示词，并将方括号占位内容替换为具体组件；保留占位符时 Agent 必须询问，不能全装：

> 请阅读这个项目的 docs/agent-install.md，按其中步骤为我的词元工坊安装：[在此处写下你要安装的东西即可]。只安装我指定的组件，保留现有配置，安装后验证并告诉我是否需要重启。

参见 [Agent 安装指南](docs/agent-install.md)。品牌走正式插件管理器，桌宠调用选择安装工具；不能自行手写产品装配补丁。

## 品牌行为

- UI 的“中国科学技术大学”“中国科大”替换为“奶龙大学”，“科大”替换为“奶龙”；“词元工坊”“Token 工坊”替换为“奶龙工坊”。
- 覆盖侧栏、首页、关于页品牌插槽，以及可识别的登录页图片和 favicon。
- 跳过对话、消息、工具输出、输入框、编辑器、代码及 iframe；不改变链接和认证配置。
- 卸载客户端效果时仅恢复未被其他组件改写的 DOM；不更改 EXE、开始菜单、原生托盘或外部认证网页。

## 构建与本地预览

```sh
node build.mjs
node scripts/build-previews.mjs
npm run preview
```

品牌构建无需新增 npm 依赖。预览缩略图生成需要 Python 3 与 Pillow（本机验证版本 12.3.0）；`python -m pip install Pillow==12.3.0`。站点复用安装皮肤数据及宿主播放规则；十状态切换、暂停、缩放和棋盘背景均可操作。`http://127.0.0.1:4173/repo/` 可验证 Pages 子路径。

## 发布 GitHub Pages

GitHub 仓库用于品牌插件安装；Pages 为独立预览站点，上传仓库不代表 Pages 已启用。发布预览时：

1. 执行 `node scripts/configure-pages.mjs --repo owner/repo` 设置 README 预览入口。
2. 构建并将项目上传到该仓库的 `main` 分支。
3. 在 **Settings → Pages → Source** 选择 **GitHub Actions**。
4. `.github/workflows/pages.yml` 上传 `site` 并部署；等待 Actions 成功后检查实际地址。

当前仓库 Pages 已部署并通过浏览器加载验证。Fork 到其他仓库时需重新配置链接与 Pages；图片相对路径兼容项目子路径。

## 素材与许可

本项目不声称拥有奶龙角色版权。`assets/nailong.png` 是用户提供的图片，不授予 MIT 素材许可；应用截图同样不自动适用代码许可。三来源的锁定提交、原文许可、SHA256 和转换说明见 `third-party/`；素材权利与代码许可分开记录。尤其是网络搜集素材，来源仓库声明不能证明已取得角色权利人的公开再分发授权；公开发布前由发布者确认相应权利。

`site/runtime/` 来自本机 `@eduwork/dsh-desktop-pet`，保留该目录 LICENSE。宠物状态复用和格式转换不代表上游提供了全部十种原生动作。
