/*
 * 章節選單：列出序章與各章，輸入通行碼解鎖，顯示已破案與結案報告。
 * 章節標題與一句話簡介來自 chapters.js（公開資料）；解鎖時用通行碼解開驗證密文。
 */
(function () {
  'use strict';

  var el = Case.el;
  var manifest = window.BLACKOUT_CHAPTERS;
  var list = document.getElementById('chapter-list');

  if (!manifest || !list) return;
  list.textContent = '';

  manifest.chapters.forEach(function (ch, index) {
    list.appendChild(card(ch, index));
  });

  // 全部結案：在章節清單前面放一張總結卡
  var allSolved = manifest.chapters.every(function (ch) {
    return Boolean(Case.load('solved:' + ch.id, false));
  });
  if (allSolved) {
    var total = 0;
    var max = 0;
    manifest.chapters.forEach(function (ch) {
      var a = Case.load('archive:' + ch.id, null);
      if (a && typeof a.score === 'number') {
        total += a.score;
        max += 3;
      }
    });
    list.parentNode.insertBefore(
      el('section', { className: 'paper finale-card', id: 'series-complete' }, [
        el('span', { className: 'stamp finale-stamp', text: '全卷結案' }),
        el('h2', { text: manifest.series ? manifest.series.title : '懷錶檔案' }),
        el('p', { text: '所有案件都結案了。檔案闔上之前，謝謝兩位偵探。' }),
        max ? el('p', { className: 'finale-score' }, ['總評 ', el('span', { className: 'rating-stars', text: total + ' / ' + max + ' ★' })]) : null
      ]),
      list
    );
  }

  var reset = document.getElementById('reset-all');
  if (reset) {
    reset.addEventListener('click', function () {
      if (!window.confirm('清除這支手機上所有章節的通行碼、進度與結案報告，從序章重新開始？')) return;
      try {
        Object.keys(window.localStorage)
          .filter(function (k) {
            return k.indexOf('blackout20:') === 0;
          })
          .forEach(function (k) {
            window.localStorage.removeItem(k);
          });
      } catch (e) {
        /* 存不了就算了 */
      }
      window.location.reload();
    });
  }

  function card(ch, index) {
    var solved = Boolean(Case.load('solved:' + ch.id, false));
    var item = el('li', { className: 'paper chapter-card' + (solved ? ' is-solved' : ''), 'data-chapter': ch.id });
    var archive = Case.load('archive:' + ch.id, null);
    var score = archive && typeof archive.score === 'number' ? archive.score : null;
    item.appendChild(
      el('div', { className: 'chapter-head' }, [
        el('span', { className: 'chapter-no', text: ch.label }),
        solved && score !== null ? el('span', { className: 'chapter-score', 'aria-label': '評等 ' + score + ' 顆星', text: '★★★'.slice(0, score) + '☆☆☆'.slice(0, 3 - score) }) : null,
        solved ? el('span', { className: 'stamp chapter-stamp', text: '結案' }) : null
      ])
    );
    item.appendChild(el('h3', { className: 'chapter-name', text: ch.title }));
    item.appendChild(el('p', { className: 'chapter-teaser', text: ch.teaser }));
    var action = el('div', { className: 'chapter-action' });
    item.appendChild(action);

    if (ch.open) {
      action.appendChild(el('a', { className: 'btn btn-primary btn-block', href: ch.href, text: solved ? '重玩' + ch.label : '開始' + ch.label }));
    } else {
      var code = Case.storedCode(ch.id);
      if (code) {
        verify(ch, code).then(function (ok) {
          if (ok) openState(action, ch, solved);
          else {
            Case.forget('code:' + ch.id);
            lockedState(action, ch, index);
          }
        });
      } else {
        lockedState(action, ch, index);
      }
    }

    if (archive && archive.t) {
      var details = el('details', { className: 'archive' }, [
        el('summary', null, [el('span', { className: 'recap-head' }, [el('span', { className: 'label', text: '結案報告（含真相，劇透）' }), el('span', { className: 'chevron', 'aria-hidden': 'true' })])]),
        el('div', { className: 'recap-body' })
      ]);
      details.querySelector('.recap-body').appendChild(Case.paragraphs(archive.t));
      item.appendChild(details);
    }
    return item;
  }

  function openState(action, ch, solved) {
    action.textContent = '';
    action.appendChild(el('a', { className: 'btn btn-primary btn-block', href: ch.href, text: solved ? '重玩' + ch.label : '開始' + ch.label }));
  }

  function lockedState(action, ch, index) {
    action.textContent = '';
    var prev = manifest.chapters[index - 1];
    var input = el('input', {
      className: 'code-input',
      type: 'text',
      autocomplete: 'off',
      autocapitalize: 'characters',
      spellcheck: 'false',
      maxlength: '9',
      placeholder: 'XXX-XXX',
      'aria-label': ch.label + '的通行碼'
    });
    var error = el('p', { className: 'form-error', role: 'alert', hidden: true });
    var button = el('button', { className: 'btn btn-ghost', type: 'submit', text: '解鎖' });
    var form = el('form', { className: 'chapter-unlock', novalidate: true }, [
      el('p', { className: 'locked-note' }, [el('span', { 'aria-hidden': 'true', text: '🔒 ' }), '破了' + (prev ? prev.label : '上一章') + '才拿得到通行碼。']),
      el('div', { className: 'unlock-row' }, [input, button]),
      error
    ]);
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var code = Case.normalizeCode(input.value);
      error.hidden = true;
      if (code.length !== 6) {
        error.textContent = '通行碼是 6 個英文字母或數字。';
        error.hidden = false;
        return;
      }
      button.disabled = true;
      verify(ch, code).then(function (ok) {
        button.disabled = false;
        if (!ok) {
          error.textContent = '通行碼不對。';
          error.hidden = false;
          input.select();
          return;
        }
        Case.saveCode(ch.id, code);
        openState(action, ch, false);
        var link = action.querySelector('a');
        if (link) link.focus();
      });
    });
    action.appendChild(form);
  }

  function verify(ch, code) {
    if (!Case.supported()) return Promise.resolve(false);
    return Case.openBox(Case.chapterParts(ch.id, ch.salt, code), ch.check)
      .then(function (payload) {
        return Boolean(payload && payload.ok === ch.id);
      })
      .catch(function () {
        return false;
      });
  }
})();
