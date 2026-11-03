import { normalizeSkin, BUILTIN_ANIMATIONS } from './runtime/skin.js';
import { frameAt, motionAt } from './runtime/pet-state.js';
const authors = ['zhengyici', 'erich207', 'mosterpath'];
const stateLabels = { idle: '待机', think: '思考', attention: '需要关注', done: '完成', failed: '失败', sleep: '睡觉', drag: '拖动', react: '互动', peek: '探头', greet: '问候' };
for (const author of authors) {
  const id = `nailong-${author}`, base = `skins/${id}/`;
  const section = document.createElement('section');
  section.id = id;
  section.innerHTML = `<h2>奶龙 · ${author}</h2><p class="note">${author === 'mosterpath' ? '静态表情与笑声 GIF 转换动画；不播放声音。' : '原始精灵图动画；部分状态复用，详见素材说明。'}</p><div class="stage"><canvas aria-label="${author} 桌宠预览"></canvas></div><div class="controls"><label>状态 <select class="state">${BUILTIN_ANIMATIONS.map(s => `<option value="${s}">${stateLabels[s]}</option>`).join('')}</select></label><button type="button" class="play">暂停</button><label>缩放 <select class="zoom"><option value="1">1×</option><option value="1.5">1.5×</option><option value="2">2×</option></select></label><label>背景 <select class="background"><option value="light">浅色棋盘</option><option value="dark">深色棋盘</option></select></label></div><p role="status" class="status">加载中…</p>`;
  document.querySelector('#pets').append(section);
  const status = section.querySelector('.status');
  try {
    const response = await fetch(`${base}skin.json`);
    if (!response.ok) throw new Error(`${base}skin.json: HTTP ${response.status}`);
    const skin = normalizeSkin(await response.json(), { strict: true });
    const images = new Map();
    await Promise.all(skin.files.map(async file => {
      const image = new Image();
      image.src = base + file;
      try { await image.decode(); } catch { throw new Error(`无法加载 ${base + file}`); }
      images.set(file, image);
    }));
    const canvas = section.querySelector('canvas'), context = canvas.getContext('2d');
    canvas.width = skin.frame.width; canvas.height = skin.frame.height;
    let state = 'idle', paused = false, elapsed = 0, last = null;
    const draw = () => {
      const animation = skin.animations[state], result = frameAt(animation, elapsed);
      const frame = animation.frames[result.index], image = images.get(frame.file), crop = frame.crop;
      const motion = motionAt(animation.motion, elapsed);
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.save();
      const origin = motion.origin === 'top' ? 0 : canvas.height;
      context.translate(canvas.width / 2 + motion.dx, origin + motion.dy);
      context.rotate(motion.rotate * Math.PI / 180); context.scale(1, motion.scaleY);
      context.translate(-canvas.width / 2, -origin);
      if (crop) context.drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, canvas.width, canvas.height);
      else context.drawImage(image, 0, 0, canvas.width, canvas.height);
      context.restore();
      canvas.dataset.frame = String(result.index); canvas.dataset.elapsed = String(Math.round(elapsed));
    };
    section.querySelector('.state').addEventListener('change', event => { state = event.target.value; elapsed = 0; last = null; draw(); });
    section.querySelector('.play').addEventListener('click', event => { paused = !paused; last = null; event.target.textContent = paused ? '播放' : '暂停'; event.target.setAttribute('aria-pressed', String(paused)); });
    section.querySelector('.zoom').addEventListener('change', event => { canvas.style.width = `${skin.frame.width * Number(event.target.value)}px`; });
    section.querySelector('.background').addEventListener('change', event => section.querySelector('.stage').classList.toggle('dark', event.target.value === 'dark'));
    document.addEventListener('visibilitychange', () => { last = null; });
    const tick = now => { if (!paused && !document.hidden) { if (last !== null) elapsed += now - last; last = now; draw(); } else last = null; requestAnimationFrame(tick); };
    draw(); requestAnimationFrame(tick); status.textContent = '十状态已加载 · 与安装包共用素材及宿主播放规则'; section.dataset.ready = 'true';
  } catch (error) { status.textContent = error.message; section.dataset.error = 'true'; }
}
