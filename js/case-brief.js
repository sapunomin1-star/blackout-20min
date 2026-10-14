/*
 * 章節簡報頁：前情提要、案件前言、選身分、本章玩法、分段提示、提出指控入口。
 * 內容來自加密的 brief.data.js；這裡只負責畫面。
 */
(function () {
  'use strict';

  var el = Case.el;

  Case.boot('brief', function (app, data, ctx) {
    var chapter = data.chapter;
    document.title = chapter.label + '・' + chapter.title + '｜懷錶檔案';

    app.appendChild(
      el('header', { className: 'masthead chapter-masthead' }, [
        el('p', { className: 'kicker', text: chapter.label }),
        el('h1', { className: 'game-title chapter-title', text: chapter.title }),
        el('div', { className: 'title-rule', 'aria-hidden': 'true' })
      ])
    );

    if ((data.recap || []).length) {
      var recap = el('details', { className: 'paper recap' }, [
        el('summary', null, [el('span', { className: 'recap-head' }, [el('span', { className: 'label', text: '前情提要' }), el('span', { className: 'chevron', 'aria-hidden': 'true' })])]),
        el('div', { className: 'recap-body' })
      ]);
      recap.querySelector('.recap-body').appendChild(Case.paragraphs(data.recap));
      app.appendChild(recap);
    }

    var file = el('article', { className: 'paper case-file' }, [
      el('div', { className: 'case-file-head' }, [el('h2', { className: 'label', text: '案件' }), el('span', { className: 'stamp', text: '機密' })])
    ]);
    var body = el('div', { className: 'case-body' });
    body.appendChild(Case.paragraphs(data.preface, 'preface-line'));
    file.appendChild(body);
    app.appendChild(file);

    app.appendChild(el('h2', { className: 'section-title', text: '選擇你的身分' }));
    app.appendChild(
      el('div', { className: 'roles' }, [
        roleCard('scene.html', '我是現場調查員', '只看得到現場物品與證物編號', 'scene'),
        roleCard('interrogation.html', '我是偵訊官', '只看得到口供，可以出示證物', 'interrogation')
      ])
    );

    var rules = el('section', { className: 'paper rules' }, [el('h2', { text: '本章玩法' })]);
    var list = el('ol');
    (data.mechanics || []).forEach(function (text) {
      list.appendChild(el('li', { text: text }));
    });
    rules.appendChild(list);
    app.appendChild(rules);

    if ((data.hints || []).length) app.appendChild(hintsSection(data.hints, ctx));

    app.appendChild(
      el('footer', { className: 'accuse-entry' }, [
        el('p', { className: 'divider', text: '— 討論完畢 —' }),
        el('a', { className: 'btn btn-primary btn-block', href: 'accuse.html', text: '提出指控' }),
        el('p', { className: 'page-footer-links' }, [
          el('a', { href: '../index.html', text: '回章節選單' }),
          ' ・ ',
          el('button', {
            className: 'link-button',
            type: 'button',
            text: '清除本章紀錄',
            onclick: function () {
              if (window.confirm('清除這支手機上本章的查看、解鎖、出示與提示紀錄？（通行碼會保留）')) {
                ctx.progress.reset();
                window.location.reload();
              }
            }
          })
        ])
      ])
    );
  });

  function roleCard(href, name, desc, kind) {
    var icon =
      kind === 'scene'
        ? '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="13" cy="13" r="8.5"/><path d="M19.5 19.5L28 28"/></svg>'
        : '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4h13l5 5v19H7z"/><path d="M20 4v5h5"/><path d="M11 14h10M11 18.5h10M11 23h6"/></svg>';
    var iconBox = el('span', { className: 'role-icon', 'aria-hidden': 'true' });
    iconBox.innerHTML = icon;
    return el('a', { className: 'role-card', href: href }, [
      iconBox,
      el('span', { className: 'role-name', text: name }),
      el('span', { className: 'role-desc', text: desc }),
      el('span', { className: 'chevron', 'aria-hidden': 'true' })
    ]);
  }

  // 提示：每個主題分兩到三層，一層一層打開，打開前先確認
  function hintsSection(hints, ctx) {
    var opened = ctx.progress.get('hints', {});
    var section = el('section', { className: 'hints', 'aria-labelledby': 'hints-title' }, [
      el('h2', { className: 'section-title', id: 'hints-title', text: '卡住了？' }),
      el('p', { className: 'lead hints-lead', text: '提示會一層一層變得更直接。看了會記在這支手機的破案紀錄裡。' })
    ]);
    hints.forEach(function (hint, index) {
      var shown = opened[index] || 0;
      var box = el('div', { className: 'paper hint' }, [el('h3', { className: 'hint-topic', text: hint.topic })]);
      var steps = el('div', { className: 'hint-steps' });
      var button = el('button', { className: 'btn btn-ghost btn-block hint-more', type: 'button' });
      function render() {
        steps.textContent = '';
        for (var i = 0; i < shown; i += 1) {
          steps.appendChild(el('p', { className: 'hint-step' }, [el('span', { className: 'hint-level', text: '提示 ' + (i + 1) }), hint.steps[i]]));
        }
        button.hidden = shown >= hint.steps.length;
        button.textContent = shown === 0 ? '看第一層提示' : '再直接一點';
      }
      button.addEventListener('click', function () {
        var label = shown === 0 ? '要看「' + hint.topic + '」的第一層提示嗎？' : '要看更直接的提示嗎？';
        if (!window.confirm(label)) return;
        shown += 1;
        opened[index] = shown;
        ctx.progress.set('hints', opened);
        render();
      });
      render();
      box.appendChild(steps);
      box.appendChild(button);
      section.appendChild(box);
    });
    return section;
  }
})();
