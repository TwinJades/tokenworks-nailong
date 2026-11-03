# 本地构建与验证

项目根目录执行；Node.js 22+、Python 3 和 Pillow 12.3.0：

```powershell
python -m pip install Pillow==12.3.0
python scripts/prepare-skins.py
node build.mjs
node scripts/build-previews.mjs
node --test tests/installer.test.mjs
npm run preview
```

品牌仓库包含构建产物，使用“添加插件”安装无需运行上述命令，也没有安装时构建脚本。`npm pack --dry-run --json` 可检查品牌发布包：须包含 package.json、cordis.patch.yml、lib、locale 与图标/声明，不含皮肤和本机配置。安装器仅对三桌宠执行新安装；`brand` 的状态及旧卸载仅用于迁移清理。

`prepare-skins.py` 只使用 third-party 已锁定素材，不联网，输出三款十状态皮肤及随包声明并更新输出哈希；原始素材哈希保留。站点复制安装数据，README GIF 从真实 idle 帧生成；mosterpath idle 只有一帧。GIF 使用白衬底避免透明调色板边缘，安装图片不强行去底。

`site/runtime/` 保留目标应用原版 normalizeSkin、frameAt、motionAt 及 LICENSE。宿主升级应重新验证，不仅测试网页。

安装器回归使用隔离fixture，结束送回收站；覆盖宠物选择安装、幂等、精准卸载、冲突、用户修改保护、异常状态码、旧品牌安全清理与失败回滚。正式品牌生命周期另用真实隔离 Electron 插件页验收，不能以fixture代替。

预览入口 http://127.0.0.1:4173/ 与 http://127.0.0.1:4173/repo/ 。逐一检查三宠物十状态、播放/暂停、缩放、背景和手机宽度。原生窗口与网页预览是不同验证面。
