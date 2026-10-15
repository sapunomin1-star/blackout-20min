/*
 * 章節引擎核心：通行碼、加密資料、本機紀錄、共用介面。
 * 每一章的頁面都會載入這個檔，所以這裡不放任何案件內容。
 *
 * 每一頁的資料檔（例如 ch1/scene.data.js）長這樣：
 *   window.CASE_DATA = { v: 1, chapter: 'ch1', role: 'scene', salt: '…', box: { iv: '…', c: '…' } }
 * box 用「章節金鑰」加密；章節金鑰由通行碼推導，通行碼要破了上一章才拿得到。
 */
(function (root) {
  'use strict';

  var NS = 'blackout20';
  var PREFIX = 'blackout20:';
  var encoder = new TextEncoder();
  var decoder = new TextDecoder();

  /* ---------- 加密 ---------- */

  function subtle() {
    return root.crypto && root.crypto.subtle ? root.crypto.subtle : null;
  }

  function supported() {
    return root.isSecureContext !== false && Boolean(subtle());
  }

  function hexToBytes(hex) {
    var out = new Uint8Array(hex.length / 2);
    for (var i = 0; i < out.length; i += 1) out[i] = parseInt(hex.substr(i * 2, 2), 16);
    return out;
  }

  function bytesToHex(buffer) {
    var bytes = new Uint8Array(buffer);
    var hex = '';
    for (var i = 0; i < bytes.length; i += 1) hex += (bytes[i] < 16 ? '0' : '') + bytes[i].toString(16);
    return hex;
  }

  function material(parts) {
    return [NS].concat(parts).join('|');
  }

  function digest(parts) {
    return subtle().digest('SHA-256', encoder.encode(material(parts)));
  }

  function hashHex(parts) {
    return digest(parts).then(bytesToHex);
  }

  function openBox(parts, box) {
    return digest(parts)
      .then(function (raw) {
        return subtle().importKey('raw', raw, { name: 'AES-GCM' }, false, ['decrypt']);
      })
      .then(function (key) {
        return subtle().decrypt({ name: 'AES-GCM', iv: hexToBytes(box.iv) }, key, hexToBytes(box.c));
      })
      .then(function (plain) {
        return JSON.parse(decoder.decode(plain));
      });
  }

  // 在清單裡找索引雜湊相符的那一筆，找到就用金鑰解開；找不到回傳 null
  function openIndexed(list, indexParts, keyParts) {
    return hashHex(indexParts).then(function (index) {
      for (var i = 0; i < list.length; i += 1) {
        if (list[i].i === index) return openBox(keyParts, list[i]);
      }
      return null;
    });
  }

  function normalizeCode(text) {
    return String(text == null ? '' : text)
      .toUpperCase()
      .replace(/[^0-9A-Z]/g, '');
  }

  function formatCode(code) {
    var c = normalizeCode(code);
    return c.length === 6 ? c.slice(0, 3) + '-' + c.slice(3) : c;
  }

  function chapterParts(chapter, salt, code) {
    return ['chapter', chapter, salt, normalizeCode(code)];
  }

  /* ---------- 本機紀錄（讀寫都包 try/catch，存不了就當沒有） ---------- */

  function load(key, fallback) {
    try {
      var raw = root.localStorage.getItem(PREFIX + key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  }

  function save(key, value) {
    try {
      root.localStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch (e) {
      /* 私密瀏覽或停用儲存時存不了，不影響遊戲 */
    }
  }

  function forget(key) {
    try {
      root.localStorage.removeItem(PREFIX + key);
    } catch (e) {
      /* 同上 */
    }
  }

  function storedCode(chapter) {
    return load('code:' + chapter, null);
  }

  function saveCode(chapter, code) {
    save('code:' + chapter, normalizeCode(code));
  }

  // 每一章自己的進度：{ seen: [], locks: {}, reveals: [], presented: {}, tried: {}, hints: {}, ... }
  function progress(chapter) {
    var key = 'progress:' + chapter;
    var state = load(key, {}) || {};
    return {
      get: function (name, fallback) {
        return Object.prototype.hasOwnProperty.call(state, name) ? state[name] : fallback;
      },
      set: function (name, value) {
        state[name] = value;
        save(key, state);
      },
      reset: function () {
        state = {};
        forget(key);
      }
    };
  }

  /* ---------- 介面小工具 ---------- */

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (name) {
        var value = attrs[name];
        if (value == null || value === false) return;
        if (name === 'text') node.textContent = value;
        else if (name === 'className') node.className = value;
        else if (name.slice(0, 2) === 'on' && typeof value === 'function') node.addEventListener(name.slice(2), value);
        else node.setAttribute(name, value === true ? '' : value);
      });
    }
    [].concat(children || []).forEach(function (child) {
      if (child == null || child === false) return;
      node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
    });
    return node;
  }

  function paragraphs(list, className) {
    var frag = document.createDocumentFragment();
    [].concat(list || []).forEach(function (text) {
      String(text)
        .split(/\n+/)
        .map(function (line) {
          return line.trim();
        })
        .filter(Boolean)
        .forEach(function (line) {
          frag.appendChild(el('p', { className: className || null, text: line }));
        });
    });
    return frag;
  }

  function prefersReducedMotion() {
    return Boolean(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function scrollIntoView(node) {
    node.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
  }

  /* ---------- 筆記本：只存在這支手機，每一章一本 ---------- */

  var NOTEBOOK_ICON =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3h11a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6z"/><path d="M6 3v18M4 7h4M4 12h4M4 17h4"/><path d="M10.5 8h4.5M10.5 11.5h4.5"/></svg>';

  function notebook(chapter) {
    var key = 'notes:' + chapter;
    var text = el('textarea', {
      className: 'notebook-text',
      id: 'notebook-text',
      spellcheck: 'false',
      placeholder: '記下搭檔念給你的線索：證物編號、口供編號、時間、誰在哪裡……'
    });
    text.value = load(key, '') || '';
    text.addEventListener('input', function () {
      save(key, text.value);
    });
    var close = el('button', { className: 'notebook-close', type: 'button', text: '收起' });
    var dialog = el('dialog', { className: 'notebook', 'aria-labelledby': 'notebook-title' }, [
      el('div', { className: 'notebook-sheet paper' }, [
        el('div', { className: 'notebook-head' }, [el('h2', { className: 'notebook-title', id: 'notebook-title', text: '筆記本' }), close]),
        el('p', { className: 'notebook-note' }, [
          el('span', { className: 'nobr', text: '只存在這支手機，' }),
          el('span', { className: 'nobr', text: '搭檔看不到；' }),
          el('span', { className: 'nobr', text: '打字就會自動存好。' })
        ]),
        el('label', { className: 'visually-hidden', for: 'notebook-text', text: '筆記內容' }),
        text
      ])
    ]);
    var fab = el('button', { className: 'notebook-fab', type: 'button', 'aria-haspopup': 'dialog' }, [el('span', { className: 'notebook-icon' }), el('span', { text: '筆記' })]);
    fab.firstChild.innerHTML = NOTEBOOK_ICON;

    function hide() {
      if (typeof dialog.close === 'function') dialog.close();
      else dialog.removeAttribute('open');
    }
    fab.addEventListener('click', function () {
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
      close.focus();
    });
    close.addEventListener('click', hide);
    // 點筆記外面的暗處也會收起
    dialog.addEventListener('click', function (event) {
      if (event.target === dialog) hide();
    });
    dialog.addEventListener('close', function () {
      fab.focus();
    });
    document.body.classList.add('has-notebook');
    document.body.appendChild(fab);
    document.body.appendChild(dialog);
  }

  /* ---------- 啟動一頁：檢查環境、解鎖、交給各頁渲染 ---------- */

  function showNotice(app, title, body) {
    app.textContent = '';
    app.appendChild(
      el('section', { className: 'paper gate' }, [el('h2', { text: title }), el('p', { text: body }), el('a', { className: 'btn btn-ghost btn-block', href: '../index.html', text: '回章節選單' })])
    );
  }

  function lockScreen(app, data, onOpen) {
    var input = el('input', {
      className: 'code-input',
      type: 'text',
      inputmode: 'text',
      autocomplete: 'off',
      autocapitalize: 'characters',
      spellcheck: 'false',
      maxlength: '9',
      placeholder: 'XXX-XXX',
      'aria-label': '通行碼'
    });
    var error = el('p', { className: 'form-error', role: 'alert', hidden: true });
    var button = el('button', { className: 'btn btn-primary btn-block', type: 'submit', text: '解鎖' });
    var form = el('form', { className: 'paper gate unlock-form', novalidate: true }, [
      el('p', { className: 'label', text: '檔案已上鎖' }),
      el('h2', { text: '請輸入這一章的通行碼' }),
      el('p', { text: '破了上一章之後，結案畫面會給你通行碼。兩支手機都要輸入一次，或是在章節選單輸入。' }),
      input,
      error,
      button,
      el('a', { className: 'link-button', href: '../index.html', text: '回章節選單' })
    ]);
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var code = normalizeCode(input.value);
      error.hidden = true;
      if (code.length !== 6) {
        error.textContent = '通行碼是 6 個英文字母或數字。';
        error.hidden = false;
        return;
      }
      button.disabled = true;
      openBox(chapterParts(data.chapter, data.salt, code), data.box)
        .then(function (payload) {
          saveCode(data.chapter, code);
          onOpen(payload);
        })
        .catch(function () {
          error.textContent = '通行碼不對。請確認上一章結案畫面上的通行碼。';
          error.hidden = false;
          button.disabled = false;
          input.select();
        });
    });
    app.textContent = '';
    app.appendChild(form);
    input.focus();
  }

  function boot(role, render) {
    var app = document.getElementById('app');
    var data = root.CASE_DATA;
    if (!supported()) {
      showNotice(app, '這個網址沒辦法開啟加密檔案', '瀏覽器只在 https 網址或本機（localhost）開放解密需要的功能。用區網 IP（例如 192.168 開頭的網址）開啟時無法使用，請改用 GitHub Pages 的 https 網址。');
      return;
    }
    if (!data || data.role !== role) {
      showNotice(app, '找不到這一章的檔案', '資料檔不完整，請回章節選單重新進入。');
      return;
    }
    var ctx = {
      chapter: data.chapter,
      salt: data.salt,
      progress: progress(data.chapter),
      hashHex: hashHex,
      openBox: openBox,
      openIndexed: openIndexed
    };
    var start = function (payload) {
      // 破案用時從這支手機第一次打開本章算起
      if (!ctx.progress.get('startedAt', 0)) ctx.progress.set('startedAt', Date.now());
      app.textContent = '';
      document.body.classList.add('theme-' + (payload.theme || 'default'));
      render(app, payload, ctx);
      // 現場、偵訊、指控三頁有筆記本（同一支手機共用一本）
      if (role !== 'brief') notebook(data.chapter);
    };
    var code = storedCode(data.chapter);
    if (!code) {
      lockScreen(app, data, start);
      return;
    }
    openBox(chapterParts(data.chapter, data.salt, code), data.box)
      .then(start)
      .catch(function () {
        forget('code:' + data.chapter);
        lockScreen(app, data, start);
      });
  }

  root.Case = {
    supported: supported,
    hashHex: hashHex,
    openBox: openBox,
    openIndexed: openIndexed,
    normalizeCode: normalizeCode,
    formatCode: formatCode,
    chapterParts: chapterParts,
    load: load,
    save: save,
    forget: forget,
    storedCode: storedCode,
    saveCode: saveCode,
    progress: progress,
    el: el,
    paragraphs: paragraphs,
    prefersReducedMotion: prefersReducedMotion,
    scrollIntoView: scrollIntoView,
    notebook: notebook,
    boot: boot
  };
})(window);
