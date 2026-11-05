# 🤖 Agent 下载与启动指南

## 环境与意图

仅支持 Windows TokenWorks；桌宠安装窗口需要 Node.js 22 或以上。先检查环境。用户仍保留 `[在此处写下你要安装的东西即可]` 时，询问想安装什么，不默认全装。不替用户安装依赖或修改应用配置；缺少环境时说明缺什么。

## 🐾 桌宠：下载并打开 install.cmd 即止

1. 下载 https://github.com/TwinJades/tokenworks-nailong/archive/refs/heads/main.zip ，解压到新的本地目录；若已有用户指定且完整的仓库目录，直接复用，不覆盖用户文件。
2. 提醒用户完全退出 TokenWorks（包括系统托盘），不强杀应用。
3. 用独立可见窗口打开解压后项目根目录的 `install.cmd`。PowerShell 示例：

   ```powershell
   Start-Process -FilePath "C:\实际解压目录\tokenworks-nailong-main\install.cmd" -WorkingDirectory "C:\实际解压目录\tokenworks-nailong-main"
   ```

   使用实际绝对路径，不能照抄示例占位路径。不要加 install/uninstall 或组件参数。
4. 告诉用户安装窗口已打开，由用户自行选择安装、卸载和桌宠编号。**到这里停止**，不代输选项、不直接调用 `scripts/install.mjs` 安装、不修改产品装配、profile或皮肤目录。

窗口打开不等于安装成功；不要报告“已安装”或宣称已验证原生桌宠。用户完成安装后需重启 TokenWorks，在“设置 → 桌面宠物”选择形象。打开失败时报告实际错误，不回退到静默安装。

下载压缩包和解压目录用完可以删除，不影响复制安装的桌宠；以后卸载或更新时可能需要重新下载。Agent 不自动删除用户下载的目录；如用户要求删除，必须送回收站。

## 🎨 品牌：使用官方插件页

引导用户进入 TokenWorks 的“插件 → 添加插件”，在上方插件地址框填写：

```text
https://github.com/TwinJades/tokenworks-nailong
```

不是下方 npm 自定义 registry。品牌的启停和卸载由官方插件管理器完成；`install.cmd` 不负责新品牌安装。通过本地路径链接安装的品牌依赖该目录，不能套用桌宠的“用完可删除目录”说明。

