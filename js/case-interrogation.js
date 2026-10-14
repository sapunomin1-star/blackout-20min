/*
 * 新章節的偵訊頁：口供（每句有編號）、追問、出示證物。
 * 出示證物的結果另外加密，要「人物＋證物編號」對了才解得開：
 *   改口：說出新的口供（有些改口要先逼出前一段才會說，否則只給一句暗示）
 *   反應：證物和這個人有關，但他沒有改口；不扣信用
 *   都不是：推託，扣一點信用
 * 口供內容來自加密的 interrogation.data.js。
 */
(function () {
  'use strict';

  var el = Case.el;

  Case.boot('interrogation', function (app, data, ctx) {
    var progress = ctx.progress;
    var presented = progress.get('presented', {});
    var tried = progress.get('tried', {});
    var outcome = {}; // 人物 id → { 證物編號: 'break' | 'react' }，畫出示紀錄用
    var asked = progress.get('asked', {});
    var maxCredibility = data.credibility || 5;
    var credibility = progress.get('credibility', maxCredibility);
    var status = document.getElementById('topbar-status');

    document.title = data.chapter.label + '・偵訊紀錄｜懷錶檔案';

    app.appendChild(
      el('p', { className: 'privacy-note', text: '這是偵訊官的畫面，別讓現場調查員看到。口供每一句都有編號，指控時會用到。' })
    );
    app.appendChild(
      el('div', { className: 'page-head' }, [
        el('p', { className: 'kicker', text: data.chapter.label + '・偵訊紀錄' }),
        el('h1', { className: 'page-title', text: data.chapter.title }),
        data.intro ? el('p', { className: 'lead', text: data.intro }) : null
      ])
    );

    app.appendChild(
      el('details', { className: 'paper how-to-present' }, [
        el('summary', null, [el('span', { className: 'recap-head' }, [el('span', { className: 'label', text: '怎麼出示證物' }), el('span', { className: 'chevron', 'aria-hidden': 'true' })])]),
        el('div', { className: 'recap-body' }, [
          el('p', { text: '請現場調查員念出證物編號，在對的人面前「出示證物」，對方可能會改口，說出新的事。' }),
          el('p', { text: '有些人要一步一步逼：先拆穿一句，下一句才鬆得動。證物跟他有關卻還沒到時候，他會露出一點反應，不扣信用。' }),
          el('p', { text: '出示不相干的證物會扣「信用」。信用用光還是可以繼續，但結案評等會變差。' })
        ])
      ])
    );

    var credibilityNotice = el('p', { className: 'notice', role: 'status', hidden: true, text: data.credibilityOut || '信用用光了：在場的人已經不太願意配合。還是可以繼續偵訊，但結案評等會降低。' });
    app.appendChild(credibilityNotice);

    var nav = el('nav', { className: 'suspect-nav', 'aria-label': '人物', style: '--cols:' + Math.min(data.people.length, 4) });
    data.people.forEach(function (p) {
      nav.appendChild(el('a', { href: '#person-' + p.id, 'data-person': p.id, text: p.name }));
    });
    app.appendChild(nav);

    var list = el('div', { className: 'suspects' });
    data.people.forEach(function (p) {
      list.appendChild(personCard(p));
    });
    app.appendChild(list);

    app.appendChild(
      el('footer', { className: 'page-footer' }, [
        el('p', { text: '問完了？回本章簡報，和現場調查員一起提出指控。' }),
        el('div', { className: 'footer-actions' }, [el('a', { className: 'btn btn-ghost', href: 'index.html', text: '回本章簡報' })])
      ])
    );

    // 重新整理後，照原本的順序把已經逼出來的改口與反應重新解開（連鎖改口要依序）
    data.people.forEach(function (p) {
      (presented[p.id] || []).slice().reduce(function (chain, no) {
        return chain.then(function () {
          return reveal(p, no, true);
        });
      }, Promise.resolve()).then(function () {
        renderLog(p);
      });
    });
    renderCredibility();
    refreshMarks();

    /* ---------- 人物卡 ---------- */

    function personCard(p) {
      var kindLabel = { suspect: '嫌疑人', witness: '證人', victim: '被害人' }[p.kind] || '嫌疑人';
      var card = el('article', { className: 'paper suspect person-' + p.kind, id: 'person-' + p.id, 'data-person': p.id, 'aria-labelledby': 'name-' + p.id }, [
        el('header', { className: 'suspect-head' }, [
          el('span', { className: 'monogram', 'aria-hidden': 'true', text: p.monogram }),
          el('div', { className: 'suspect-who' }, [
            el('p', { className: 'suspect-role' }, [p.role, p.kind !== 'suspect' ? el('span', { className: 'kind-badge', text: kindLabel }) : null]),
            el('h2', { className: 'suspect-name', id: 'name-' + p.id, text: p.name })
          ]),
          el('span', { className: 'seen-mark', text: '有新口供' })
        ]),
        el('p', { className: 'label', text: '口供' }),
        lineList(p.lines)
      ]);

      (p.followups || []).forEach(function (f, index) {
        var box = el('details', { className: 'follow-up' }, [
          el('summary', null, [el('span', { className: 'btn btn-ghost follow-up-btn' }, [el('span', { className: 'follow-up-q', text: '追問：' + f.q }), el('span', { className: 'chevron', 'aria-hidden': 'true' })])]),
          el('div', { className: 'follow-up-body' }, [
            el('p', { className: 'label', text: '回答' }),
            lineList(f.lines),
            f.observe ? el('p', { className: 'label', text: '觀察反應' }) : null,
            f.observe ? el('p', { className: 'reaction', text: f.observe }) : null
          ])
        ]);
        box.addEventListener('toggle', function () {
          if (!box.open) return;
          var list = asked[p.id] || [];
          if (list.indexOf(index) === -1) {
            list.push(index);
            asked[p.id] = list;
            progress.set('asked', asked);
          }
        });
        card.appendChild(box);
      });

      card.appendChild(el('div', { className: 'breaks', 'data-breaks-for': p.id }));
      card.appendChild(presentForm(p));
      return card;
    }

    function lineList(lines) {
      var box = el('div', { className: 'testimony-lines' });
      (lines || []).forEach(function (line) {
        box.appendChild(el('p', { className: 'testimony-line', 'data-no': String(line.no) }, [el('span', { className: 'line-no', text: '#' + line.no }), el('span', { className: 'line-text', text: line.text })]));
      });
      return box;
    }

    /* ---------- 出示證物 ---------- */

    function presentForm(p) {
      var details = el('details', { className: 'present' });
      details.appendChild(el('summary', null, [el('span', { className: 'btn btn-primary present-toggle' }, ['出示證物', el('span', { className: 'chevron', 'aria-hidden': 'true' })])]));
      var input = el('input', {
        className: 'present-input',
        type: 'text',
        inputmode: 'numeric',
        autocomplete: 'off',
        maxlength: '3',
        placeholder: '07',
        'aria-label': '要出示給' + p.name + '的證物編號'
      });
      var button = el('button', { className: 'btn btn-primary', type: 'submit', text: '出示' });
      var feedback = el('div', { className: 'present-feedback', role: 'status' });
      var log = el('p', { className: 'present-log', 'data-log-for': p.id, hidden: true });
      var form = el('form', { className: 'present-form', novalidate: true }, [
        el('label', { className: 'present-row' }, [el('span', { className: 'present-prefix', text: '證物 No.' }), input]),
        button
      ]);
      form.addEventListener('submit', function (event) {
        event.preventDefault();
        var no = parseInt(String(input.value).replace(/\D/g, ''), 10);
        feedback.textContent = '';
        feedback.className = 'present-feedback';
        if (!no || no < 1 || no > data.maxEvidence) {
          feedback.textContent = '沒有這個編號的證物。請現場調查員念出卡片上的「No.」編號。';
          return;
        }
        if ((presented[p.id] || []).indexOf(no) !== -1) {
          feedback.textContent = '這件已經給' + p.name + '看過了，新的口供就在上面。';
          return;
        }
        button.disabled = true;
        reveal(p, no, false)
          .then(function (result) {
            button.disabled = false;
            renderLog(p);
            if (result && result.early) {
              // 有關，但前一段還沒逼出來：給一句暗示，不扣信用、不記錄
              input.value = '';
              feedback.className = 'present-feedback is-early';
              feedback.appendChild(el('span', { className: 'deflect', text: result.early }));
              feedback.appendChild(el('span', { className: 'deflect-note', text: '（有反應，但還不打算說。先從別的地方突破，再拿這件回來。沒有扣信用）' }));
              return;
            }
            if (result && result.same) {
              // 這件證物觸發的是已經看過的同一段改口：不扣信用，也不重複顯示
              input.value = '';
              feedback.textContent = p.name + '看了 No.' + pad(no) + '，說法和出示 No.' + pad(result.first) + ' 時一樣，沒有再多說什麼。';
              return;
            }
            if (result && result.react) {
              // 有關但沒有改口：反應記在卡片上，不扣信用
              input.value = '';
              feedback.textContent = p.name + '看了 No.' + pad(no) + '。反應記在上面了（沒有扣信用）。';
              return;
            }
            if (result) {
              input.value = '';
              details.open = false;
              return;
            }
            var list = tried[p.id] || [];
            var repeat = list.indexOf(no) !== -1;
            if (!repeat) {
              list.push(no);
              tried[p.id] = list;
              progress.set('tried', tried);
              credibility = Math.max(0, credibility - 1);
              progress.set('credibility', credibility);
              renderCredibility();
              renderLog(p);
            }
            var line = p.deflect[(list.length - 1) % p.deflect.length];
            feedback.className = 'present-feedback is-miss';
            feedback.appendChild(el('span', { className: 'deflect', text: line }));
            feedback.appendChild(el('span', { className: 'deflect-note', text: repeat ? '（這件之前已經出示過了，沒有再扣信用）' : '（沒能讓對方鬆口。信用 −1）' }));
          })
          .catch(function () {
            button.disabled = false;
            feedback.textContent = '出了點問題，請重新整理再試一次。';
          });
      });
      details.appendChild(el('div', { className: 'present-body' }, [form, feedback, log]));
      return details;
    }

    // 出示紀錄：給這個人看過哪些證物、各是什麼結果
    function renderLog(p) {
      var log = document.querySelector('[data-log-for="' + p.id + '"]');
      if (!log) return;
      var entries = [];
      (presented[p.id] || []).forEach(function (no) {
        var kind = (outcome[p.id] || {})[no];
        entries.push({ no: no, text: kind === 'react' ? '有反應' : '改口' });
      });
      (tried[p.id] || []).forEach(function (no) {
        entries.push({ no: no, text: '沒鬆口' });
      });
      entries.sort(function (a, b) {
        return a.no - b.no;
      });
      log.hidden = !entries.length;
      log.textContent = entries.length
        ? '給' + p.name + '看過：' + entries.map(function (e) {
            return 'No.' + pad(e.no) + ' ' + e.text;
          }).join('・')
        : '';
    }

    // 試著用「人物＋證物編號」解開出示的結果。解不開回傳 false。解得開時：
    //   前置的改口還沒逼出來 → { early: 暗示 }（不記錄）
    //   別件證物已經觸發過的同一段 → { same: true, first: 那件的編號 }
    //   反應 → { react: true }；新的改口 → true
    function reveal(p, no, silent) {
      return ctx.openIndexed(data.breaks, ['presentidx', ctx.salt, p.id, String(no)], ['present', ctx.salt, p.id, String(no)]).then(function (content) {
        if (!content) return false;
        var box = document.querySelector('[data-breaks-for="' + p.id + '"]');
        var missing = (content.requires || []).filter(function (id) {
          return !box.querySelector('[data-break="' + id + '"]');
        });
        if (missing.length) return { early: content.early || p.name + '盯著這件東西看了一會兒，什麼也沒說。' };
        var list = presented[p.id] || [];
        if (list.indexOf(no) === -1) {
          list.push(no);
          presented[p.id] = list;
          progress.set('presented', presented);
        }
        outcome[p.id] = outcome[p.id] || {};
        outcome[p.id][no] = content.react ? 'react' : 'break';
        var existing = content.id ? box.querySelector('[data-break="' + content.id + '"]') : null;
        if (existing) {
          var shown = existing.getAttribute('data-evidence').split(' ');
          if (shown.indexOf(String(no)) !== -1) return true;
          shown.push(String(no));
          existing.setAttribute('data-evidence', shown.join(' '));
          existing.querySelector('.break-cause').textContent = causeText(shown);
          return { same: true, first: parseInt(shown[0], 10) };
        }
        if (content.react) {
          var note = el('section', { className: 'react-note' + (silent ? '' : ' is-new'), 'data-evidence': String(no), 'data-break': content.id || null }, [
            el('p', { className: 'break-cause', text: causeText([String(no)]) }),
            content.say ? el('p', { className: 'react-say', text: content.say }) : null,
            content.observe ? el('p', { className: 'reaction', text: content.observe }) : null
          ]);
          box.appendChild(note);
          refreshMarks();
          return { react: true };
        }
        var section = el('section', { className: 'break' + (silent ? '' : ' is-new'), 'data-evidence': String(no), 'data-break': content.id || null }, [
          el('p', { className: 'break-head' }, [el('span', { className: 'stamp break-stamp', text: content.title || '改口' }), el('span', { className: 'break-cause', text: causeText([String(no)]) })]),
          lineList(content.lines),
          content.observe ? el('p', { className: 'label', text: '觀察反應' }) : null,
          content.observe ? el('p', { className: 'reaction', text: content.observe }) : null
        ]);
        box.appendChild(section);
        refreshMarks();
        if (!silent) Case.scrollIntoView(section);
        return true;
      });
    }

    function renderCredibility() {
      status.textContent = '';
      status.appendChild(document.createTextNode('信用 '));
      var dots = el('span', { className: 'credibility', 'aria-label': '信用 ' + credibility + ' / ' + maxCredibility });
      for (var i = 0; i < maxCredibility; i += 1) dots.appendChild(el('span', { className: 'dot' + (i < credibility ? ' is-on' : ''), 'aria-hidden': 'true' }));
      status.appendChild(dots);
      credibilityNotice.hidden = credibility > 0;
    }

    function refreshMarks() {
      data.people.forEach(function (p) {
        var card = document.getElementById('person-' + p.id);
        var has = Boolean(card && card.querySelector('section.break'));
        if (card) card.classList.toggle('is-asked', has);
        var link = nav.querySelector('[data-person="' + p.id + '"]');
        if (link) link.classList.toggle('is-asked', has);
      });
    }
  });

  function pad(n) {
    n = parseInt(n, 10);
    return (n < 10 ? '0' : '') + n;
  }

  function causeText(numbers) {
    return '出示證物 ' + numbers.map(function (n) { return 'No.' + pad(n); }).join('、') + ' 之後';
  }
})();
