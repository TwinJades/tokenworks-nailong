window.__ModuleLoader__.load({
  id: '@nailong/tokenworks-brand',
  factory(require) {
    const ReactModule = require('react');
    const React = ReactModule.default ?? ReactModule;
    const image = '__NAILONG_IMAGE__';
    const protectedContent = '[data-chat-flow],[data-chat-flow-kind],[data-turn-trigger],[data-turn-process],[data-turn-tail],[data-composer],[contenteditable],input,textarea,pre,code,script,style,iframe,[data-nailong-preserve]';
    const pairs = [['中国科学技术大学', '奶龙大学'], ['词元工坊', '奶龙工坊'], ['Token 工坊', '奶龙工坊'], ['中国科大', '奶龙大学'], ['科大', '奶龙']];
    const replace = value => pairs.reduce((text, [from, to]) => text.replaceAll(from, to), value);
    const attributes = ['title', 'aria-label', 'alt', 'placeholder'];

    function installBranding(doc) {
      const textChanges = new Map();
      const attributeChanges = new Map();
      const iconChanges = new Map();
      const imageChanges = new Map();
      const win = doc.defaultView;
      const blocked = element => !element || !!element.closest(protectedContent);
      function setAttribute(element, name, value) {
        if (element.getAttribute(name) === value) return;
        let changes = attributeChanges.get(element);
        if (!changes) attributeChanges.set(element, changes = new Map());
        const previous = changes.get(name);
        const before = element.getAttribute(name);
        changes.set(name, { before: previous?.after === before ? previous.before : before, after: value });
        element.setAttribute(name, value);
      }
      function processText(node) {
        if (blocked(node.parentElement)) return;
        const before = node.data;
        const after = replace(before);
        if (before === after) return;
        const previous = textChanges.get(node);
        textChanges.set(node, { before: previous?.after === before ? previous.before : before, after });
        node.data = after;
      }
      function processElement(element) {
        if (blocked(element)) return;
        const label = `${element.getAttribute('alt') ?? ''} ${element.getAttribute('title') ?? ''}`;
        const source = element.getAttribute('src') ?? '';
        // Only identity artwork: never replace arbitrary pictures or user avatars.
        if (element.tagName === 'IMG' && (/(?:TWorks|中国科学技术大学|中国科大|科大.*(?:logo|校徽)|USTC.*(?:logo|seal))/i.test(label) || /(?:ustc|tokenworks)[-_/.]*(?:logo|seal|mark)|(?:logo|seal)[-_/.]*ustc/i.test(source))) {
          if (!imageChanges.has(element)) imageChanges.set(element, {
            src: element.getAttribute('src'), srcset: element.getAttribute('srcset'),
          });
          if (element.getAttribute('src') !== image) element.setAttribute('src', image);
          if (element.hasAttribute('srcset')) element.removeAttribute('srcset');
          setAttribute(element, 'alt', '奶龙');
        }
        for (const name of attributes) {
          const value = element.getAttribute(name);
          if (value) setAttribute(element, name, replace(value));
        }
      }
      function scan(root) {
        if (root.nodeType === 3) { processText(root); return; }
        if (root.nodeType !== 1 || blocked(root)) return;
        processElement(root);
        const walker = doc.createTreeWalker(root, win.NodeFilter.SHOW_ELEMENT | win.NodeFilter.SHOW_TEXT, {
          acceptNode(node) {
            if (node.nodeType === 1 && blocked(node)) return win.NodeFilter.FILTER_REJECT;
            return win.NodeFilter.FILTER_ACCEPT;
          },
        });
        while (walker.nextNode()) {
          const node = walker.currentNode;
          if (node.nodeType === 3) processText(node); else processElement(node);
        }
      }
      function updateHead() {
        for (const icon of doc.querySelectorAll('link[rel~="icon"]')) {
          if (icon.getAttribute('href') === image) continue;
          if (!iconChanges.has(icon)) iconChanges.set(icon, { href: icon.getAttribute('href'), type: icon.getAttribute('type') });
          icon.setAttribute('href', image);
          icon.setAttribute('type', 'image/png');
        }
      }
      scan(doc.documentElement);
      updateHead();
      const observer = new win.MutationObserver(records => {
        for (const record of records) {
          if (record.type === 'childList') for (const node of record.addedNodes) scan(node);
          else if (record.type === 'characterData') processText(record.target);
          else processElement(record.target);
        }
        updateHead();
        // Detached UI must not be retained for the lifetime of the application.
        for (const changes of [textChanges, attributeChanges, imageChanges, iconChanges]) {
          for (const node of changes.keys()) if (!node.isConnected) changes.delete(node);
        }
      });
      observer.observe(doc.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: [...attributes, 'src', 'srcset', 'href', 'rel'] });
      return () => {
        observer.disconnect();
        const restore = (element, name, value) => value === null ? element.removeAttribute(name) : element.setAttribute(name, value);
        for (const [node, change] of textChanges) if (node.isConnected && node.data === change.after) node.data = change.before;
        for (const [element, changes] of attributeChanges) for (const [name, change] of changes) {
          if (element.isConnected && element.getAttribute(name) === change.after) restore(element, name, change.before);
        }
        for (const [element, old] of imageChanges) if (element.isConnected && element.getAttribute('src') === image) {
          restore(element, 'src', old.src); restore(element, 'srcset', old.srcset);
        }
        for (const [element, old] of iconChanges) if (element.isConnected && element.getAttribute('href') === image) {
          restore(element, 'href', old.href); restore(element, 'type', old.type);
        }
        textChanges.clear(); attributeChanges.clear(); imageChanges.clear(); iconChanges.clear();
      };
    }
    function apply(ctx) {
      const mark = size => () => React.createElement('img', { src: image, alt: '奶龙', width: size, height: size, style: { objectFit: 'contain' } });
      for (const [name, size] of [['sidebar.brand.mark', 32], ['conversation.hero.brand.mark', 96], ['settings.about.brand', 96]]) {
        ctx.slots.inject(name, () => ctx.slots.register({ name, priority: -300 }, mark(size)));
      }
      ctx.slots.inject('sidebar.brand.name', () => ctx.slots.register({ name: 'sidebar.brand.name', priority: -300 }, () => React.createElement(React.Fragment, null, '奶龙大学 奶龙工坊')));
      ctx.effect(() => installBranding(document), 'nailong: UI identity');
    }
    return { name: 'nailong-brand', inject: ['slots'], apply, installBranding };
  },
});
