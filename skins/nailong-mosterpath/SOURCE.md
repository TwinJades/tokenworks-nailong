https://github.com/mosterpath/pet-nailong

Commit: e87106cbc42c90fcc6259e6f8d1f2e03c040f5e5

上游根仓库附 MIT 许可；素材包 README 明确称素材从网上搜集，未证明图片权利归属或再分发授权，不能将根仓库 MIT 自动视作素材授权。按比例适配 256×256 画布并居中底对齐，使用 rembg 2.0.69/u2net 分割前景，保留原RGB图像、仅应用已收录的71张alpha遮罩去除背景，不重绘角色；遮罩位于assets/mosterpath-masks。idle=03-idle/01-half-lidded.png，think=04-think/01-green-eye-chin.png，attention=05-shock/01-green-eye-kick.png，failed=05-shock/02-green-eye-headgrab.png，drag=09-variants/01-crawl-laugh.png + dangle，react/greet=09-variants/02-peace-tongue.png，peek=09-variants/04-green-smile.png，sleep 复用 idle；静态图片不是原生逐帧动画。done 使用 laugh.gif；Pillow 逐帧按 disposal 合成后将 86 帧按时间均匀合并为 64 帧并累积时长，共 4300ms，不含音频。
