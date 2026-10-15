/*
 * 新章節的指控頁：依本章的欄位組出指控、判定、顯示真相與下一章通行碼。
 * 判定用雜湊比對與解密（js/case.js），這裡沒有答案。
 *   全對 → 破案動畫、真相、下一章通行碼
 *   兇手對但其他不完整 → 本章的「不完整」訊息；如果只錯一處，另外提示「只差一處」
 *   兇手錯 → 那個人自己的訊息
 */
(function () {
  'use strict';

  var el = Case.el;

  Case.boot('accuse', function (app, data, ctx) {
    var progress = ctx.progress;
    var verdict = data.verdict;
    var peopleById = {};
    data.people.forEach(function (p) {
      peopleById[p.id] = p;
    });

    document.title = data.chapter.label + '・提出指控｜懷錶檔案';

    app.appendChild(
      el('div', { className: 'page-head' }, [
        el('p', { className: 'kicker', text: data.chapter.label + '・結案報告' }),
        el('h1', { className: 'page-title', text: '提出指控' }),
        data.intro ? el('p', { className: 'lead', text: data.intro }) : null
      ])
    );

    var gate = el('section', { className: 'paper gate' }, [
      el('h2', { text: '兩人都準備好了嗎？' }),
      el('p', { text: '指控要填證物編號（No.）和口供編號（#），兩支手機上的資料都會用到。請兩人一起看著這一頁作答。' }),
      el('button', { className: 'btn btn-primary btn-block', type: 'button', text: '準備好了，開始指控' })
    ]);
    app.appendChild(gate);

    var form = el('form', { className: 'accuse-form', novalidate: true, hidden: true });
    data.fields.forEach(function (field, index) {
      form.appendChild(fieldset(field, index));
    });
    var errorBox = el('p', { className: 'form-error', role: 'alert', hidden: true });
    var submit = el('button', { className: 'btn btn-primary btn-block', type: 'submit', text: '提出指控' });
    form.appendChild(errorBox);
    form.appendChild(el('div', { className: 'submit-row' }, [submit]));
    app.appendChild(form);

    var result = el('section', { className: 'verdict', 'aria-live': 'polite', hidden: true });
    app.appendChild(result);

    gate.querySelector('button').addEventListener('click', function () {
      gate.hidden = true;
      form.hidden = false;
      var legend = form.querySelector('legend');
      legend.setAttribute('tabindex', '-1');
      legend.focus();
    });

    form.addEventListener('change', syncChecked);

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      errorBox.hidden = true;
      var values = {};
      var missing = [];
      data.fields.forEach(function (field) {
        var value = readField(field);
        if (value === null) missing.push(field);
        else values[field.id] = value;
      });
      if (missing.length) {
        errorBox.textContent = '還沒填好：' + missing.map(function (f) { return f.label; }).join('、') + '。';
        errorBox.hidden = false;
        var target = form.querySelector('[data-field="' + missing[0].id + '"] input');
        if (target) target.focus();
        return;
      }
      submit.disabled = true;
      submit.textContent = '判定中…';
      progress.set('attempts', progress.get('attempts', 0) + 1);
      judge(values)
        .then(show)
        .catch(function () {
          errorBox.textContent = '判定時發生錯誤，請重新整理頁面再試一次。';
          errorBox.hidden = false;
        })
        .then(function () {
          submit.disabled = false;
          submit.textContent = '提出指控';
        });
    });

    /* ---------- 欄位 ---------- */

    function fieldset(field, index) {
      var box = el('fieldset', { className: 'paper field', 'data-field': field.id }, [
        el('legend', null, [el('span', { className: 'field-no', text: String(index + 1) }), field.label])
      ]);
      if (field.hint) box.appendChild(el('p', { className: 'field-help', text: field.hint }));
      if (field.type === 'person') {
        var grid = el('div', { className: 'suspect-options' });
        field.people.forEach(function (pid) {
          var p = peopleById[pid];
          grid.appendChild(
            el('label', { className: 'suspect-option' }, [
              el('input', { type: 'radio', name: field.id, value: pid }),
              el('span', { className: 'monogram', 'aria-hidden': 'true', text: p.monogram }),
              el('span', { className: 'opt-name', text: p.name }),
              el('span', { className: 'opt-role', text: p.role })
            ])
          );
        });
        box.appendChild(grid);
      } else if (field.type === 'choice') {
        var list = el('div', { className: 'choice-list' });
        field.options.forEach(function (o) {
          list.appendChild(el('label', { className: 'opt choice' }, [el('input', { type: 'radio', name: field.id, value: o.id }), el('span', { className: 'opt-text', text: o.text })]));
        });
        box.appendChild(list);
      } else {
        var prefix = field.type === 'evidence' ? '證物 No.' : '口供 #';
        box.appendChild(
          el('label', { className: 'number-row' }, [
            el('span', { className: 'number-prefix', text: prefix }),
            el('input', {
              className: 'number-input',
              type: 'text',
              inputmode: 'numeric',
              autocomplete: 'off',
              maxlength: '3',
              name: field.id,
              placeholder: field.type === 'evidence' ? '07' : '12',
              'aria-label': field.label
            })
          ])
        );
      }
      return box;
    }

    function readField(field) {
      if (field.type === 'person' || field.type === 'choice') {
        var checked = form.querySelector('input[name="' + field.id + '"]:checked');
        return checked ? checked.value : null;
      }
      var raw = form.querySelector('input[name="' + field.id + '"]').value;
      var n = parseInt(String(raw).replace(/\D/g, ''), 10);
      var max = field.type === 'evidence' ? data.maxEvidence : data.maxStatement;
      return n >= 1 && n <= max ? String(n) : null;
    }

    function syncChecked() {
      Array.prototype.forEach.call(form.querySelectorAll('.suspect-option, .opt'), function (label) {
        var input = label.querySelector('input');
        label.classList.toggle('is-checked', Boolean(input && input.checked));
      });
    }

    /* ---------- 判定 ---------- */

    function serialize(values) {
      return data.fields
        .map(function (f) {
          return f.id + '=' + values[f.id];
        })
        .join(';');
    }

    function judge(values) {
      var ser = serialize(values);
      return ctx.hashHex(['full', ctx.salt, ser]).then(function (full) {
        if (verdict.solved.indexOf(full) !== -1) {
          return ctx.openIndexed(verdict.truth, ['truthidx', ctx.salt, ser], ['truth', ctx.salt, ser]).then(function (truth) {
            return { outcome: 'solved', truth: truth };
          });
        }
        var culprit = values[data.fields[0].id];
        return ctx.openIndexed(verdict.people, ['personidx', ctx.salt, culprit], ['person', ctx.salt, culprit]).then(function (person) {
          if (!person || person.k !== 'culprit') return { outcome: 'wrong', message: person ? person.m : '' };
          var checks = data.fields.slice(1).map(function (f) {
            var copy = {};
            Object.keys(values).forEach(function (k) {
              copy[k] = values[k];
            });
            copy[f.id] = '*';
            return ctx.hashHex(['near', ctx.salt, serialize(copy)]);
          });
          return Promise.all(checks).then(function (hashes) {
            var near = hashes.some(function (h) {
              return verdict.near.indexOf(h) !== -1;
            });
            return { outcome: 'incomplete', message: person.m, near: near };
          });
        });
      });
    }

    /* ---------- 結果 ---------- */

    function show(r) {
      result.textContent = '';
      result.className = 'verdict ' + (r.outcome === 'solved' ? 'verdict-solved' : 'verdict-message');
      var card = el('div', { className: 'paper verdict-card' });
      var title = el('h2', { tabindex: '-1' });
      if (r.outcome === 'solved') {
        solved(r.truth, card, title);
      } else {
        title.textContent = '判定';
        card.appendChild(title);
        card.appendChild(el('div', { className: 'verdict-text' }, [Case.paragraphs([r.message])]));
        if (r.near) card.appendChild(el('p', { className: 'near-miss', text: '…不過，你們只差一處了。' }));
        card.appendChild(
          el('div', { className: 'verdict-actions' }, [
            el('button', {
              className: 'btn btn-primary',
              type: 'button',
              text: '重新指控',
              onclick: function () {
                result.hidden = true;
                form.hidden = false;
                Case.scrollIntoView(form);
              }
            })
          ])
        );
      }
      result.appendChild(card);
      result.hidden = false;
      if (r.outcome === 'solved') form.hidden = true;
      Case.scrollIntoView(result);
      title.focus({ preventScroll: true });
    }

    function solved(truth, card, title) {
      var lights = document.getElementById('lights');
      if (lights && !Case.prefersReducedMotion()) {
        lights.classList.remove('is-on');
        void lights.offsetWidth;
        lights.classList.add('is-on');
      }
      var grade = rating();
      progress.set('solved', true);
      Case.save('solved:' + data.chapter.id, true);
      Case.save('archive:' + data.chapter.id, { label: data.chapter.label, title: data.chapter.title, t: truth.t, score: grade.score, minutes: grade.minutes });
      if (truth.next) Case.saveCode(truth.next.id, truth.next.code);

      card.appendChild(el('span', { className: 'stamp solved-stamp', text: '破案' }));
      title.textContent = '真相';
      card.appendChild(title);
      card.appendChild(el('div', { className: 'verdict-text truth' }, [Case.paragraphs(truth.t)]));
      if ((truth.epilogue || []).length) {
        card.appendChild(el('h3', { className: 'epilogue-title', text: '尾聲' }));
        card.appendChild(el('div', { className: 'verdict-text epilogue' }, [Case.paragraphs(truth.epilogue)]));
      }
      card.appendChild(grade.node);
      card.appendChild(shareBox(grade));
      if (truth.next) {
        card.appendChild(
          el('div', { className: 'next-code' }, [
            el('p', { className: 'label', text: truth.next.label + '通行碼' }),
            el('p', { className: 'code-display', text: Case.formatCode(truth.next.code) }),
            el('p', { className: 'next-help', text: '這支手機已經自動解鎖。另一支手機請在章節選單輸入這組通行碼。' }),
            el('a', { className: 'btn btn-primary btn-block', href: truth.next.href, text: '前往' + truth.next.label + '：' + truth.next.title })
          ])
        );
      }
      card.appendChild(el('div', { className: 'verdict-actions' }, [el('a', { className: 'btn btn-ghost', href: '../index.html', text: '回章節選單' })]));
    }

    // 用時：從這支手機第一次打開本章到第一次破案，之後再破案也不會變
    function elapsedMinutes() {
      var kept = progress.get('minutes', null);
      if (kept !== null) return kept;
      var started = progress.get('startedAt', 0);
      if (!started) return null;
      var minutes = Math.max(1, Math.round((Date.now() - started) / 60000));
      progress.set('minutes', minutes);
      return minutes;
    }

    function formatMinutes(m) {
      if (m > 720) return '超過 12 小時（中間休息過）';
      if (m < 60) return '約 ' + m + ' 分鐘';
      return '約 ' + Math.floor(m / 60) + ' 小時' + (m % 60 ? ' ' + (m % 60) + ' 分' : '');
    }

    // 分享成績：只有章名、星等和數字，不含任何案情。手機有分享選單就用，沒有就複製，再不行就列出文字讓玩家自己選
    function shareBox(grade) {
      var text = '《懷錶檔案》' + data.chapter.label + '《' + data.chapter.title + '》破案 ' + grade.stars + '\n' + grade.summary + '\n' + new URL('../', window.location.href).href;
      var status = el('div', { className: 'share-status', role: 'status' });
      var button = el('button', { className: 'btn btn-ghost btn-block share-button', type: 'button', text: '分享成績' });

      function manual() {
        var box = el('textarea', { className: 'share-text', readonly: true, rows: '4', 'aria-label': '成績文字' });
        box.value = text;
        status.textContent = '';
        status.appendChild(el('p', { text: '這支手機不能自動複製，請長按下面的文字自己複製：' }));
        status.appendChild(box);
        box.select();
      }

      function copy() {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(function () {
            status.textContent = '已複製成績，可以貼給搭檔或朋友。';
          }, manual);
        } else {
          manual();
        }
      }

      button.addEventListener('click', function () {
        status.textContent = '';
        if (navigator.share) {
          navigator.share({ text: text }).catch(function (err) {
            // 玩家自己取消分享就不用再做什麼
            if (!err || err.name !== 'AbortError') copy();
          });
        } else {
          copy();
        }
      });
      return el('div', { className: 'share' }, [button, status]);
    }

    function rating() {
      var attempts = progress.get('attempts', 1);
      var hints = progress.get('hints', {});
      var hintCount = Object.keys(hints).reduce(function (n, k) {
        return n + hints[k];
      }, 0);
      var credibility = progress.get('credibility', null);
      var score = 3;
      if (attempts > 2) score -= 1;
      if (hintCount >= 3) score -= 1;
      if (credibility !== null && credibility <= 2) score -= 1;
      var titles = ['終究還是破案了', '跌跌撞撞的新手', '可靠的搭檔', '名偵探'];
      score = Math.max(0, score);
      var stars = '★★★'.slice(0, score) + '☆☆☆'.slice(0, 3 - score);
      var rows = [el('li', { text: '指控次數：' + attempts }), el('li', { text: '看過的提示：' + hintCount + ' 層' })];
      if (credibility !== null) rows.push(el('li', { text: '剩下的信用：' + credibility }));
      var minutes = elapsedMinutes();
      if (minutes !== null) rows.push(el('li', { text: '用時：' + formatMinutes(minutes) }));
      // 分享用的一行摘要：只有數字，沒有案情
      var summary = (minutes !== null ? ['用時' + formatMinutes(minutes)] : [])
        .concat(['提示 ' + hintCount + ' 層', '指控 ' + attempts + ' 次'])
        .concat(credibility !== null ? ['信用剩 ' + credibility] : [])
        .join('・');
      return {
        score: score,
        minutes: minutes,
        stars: stars,
        summary: summary,
        node: el('div', { className: 'rating' }, [
          el('p', { className: 'label', text: '破案評等（這支手機的紀錄）' }),
          el('p', { className: 'rating-stars', 'aria-label': score + ' 顆星', text: stars }),
          el('p', { className: 'rating-title', text: titles[score] }),
          el('ul', { className: 'rating-list' }, rows)
        ])
      };
    }
  });
})();
