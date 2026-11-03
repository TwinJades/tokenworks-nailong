# Agent 安装指南

仅支持 Windows 上的 TokenWorks。先询问用户要安装或卸载哪些组件；如果用户仍使用“在此处写下你要安装的东西即可”占位符，必须询问，不能默认全选。组件为品牌 `brand` 和三个桌宠 `nailong-zhengyici`、`nailong-erich207`、`nailong-mosterpath`。只操作用户明确选择的组件。

## 品牌

通过 TokenWorks 插件页的正式添加入口，添加本项目的 GitHub 仓库地址或本地项目路径，并由宿主插件管理器管理；仓库地址尚未确定时不要编造，使用可用的本地项目路径或向用户索取实际地址。品牌的启用、状态和卸载也在插件页或宿主管理器中操作。不要手写 product composition、依赖、profile 或其他补丁。桌宠安装器拒绝任何包含 `brand` 的安装请求，整次请求不会写入。

如果此前曾使用旧版安装器安装品牌，可在用户明确要求迁移清理时使用 `node scripts/install.mjs status --components brand` 检查旧记录，再用 `node scripts/install.mjs uninstall --components brand --root "<TokenWorks根目录>" --profile "<原桌面profile目录>" --dry-run` 预演并去掉 `--dry-run` 执行。此状态仅表示旧安装器管理的记录，不代表正式插件管理器中的状态。旧记录的文件哈希或配置不匹配时拒绝卸载，不要绕过保护；没有旧记录时不要以此清理陌生插件。

## 桌宠

操作前请用户完全退出 TokenWorks，包括系统托盘。在项目目录运行，例如仅安装 erich207：

```powershell
node scripts/install.mjs install --components nailong-erich207 --root "<TokenWorks根目录>" --dry-run
node scripts/install.mjs install --components nailong-erich207 --root "<TokenWorks根目录>"
```

默认根目录为 `%LOCALAPPDATA%\Programs\TokenWorks`；只装宠物不需要 profile。卸载把 `install` 改成 `uninstall`，并指定组件；状态可用 `node scripts/install.mjs status --components nailong-erich207`。所有操作都可加 `--dry-run` 预演。`install.cmd` 可双击交互选择，空选择取消。对冲突或报错不要绕过保护，不自行修改安装目录、profile、配置或注册项。

操作后通过对应管理器或安装器检查所选组件的状态，报告结果与任何异常；完全退出后重新启动 TokenWorks 才能刷新皮肤图库。不要将网页预览当成原生图库验证。安装器不修改宠物开关、选择、凭据和个人配置；卸载遇到修改过的管理文件会拒绝删除，请向用户说明。
