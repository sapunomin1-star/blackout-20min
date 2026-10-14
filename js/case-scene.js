/*
 * 新章節的現場頁：平面圖、房間分頁、證物卡（含編號）、翻開的細節、密碼鎖。
 * 物品內容來自加密的 scene.data.js；鎖裡的東西另外加密，要輸入正確密碼才解得開。
 */
(function () {
  'use strict';

  var el = Case.el;
  var SVG = 'http://www.w3.org/2000/svg';

  Case.boot('scene', function (app, data, ctx) {
    var progress = ctx.progress;
    var seen = progress.get('seen', []);
    var openedLocks = progress.get('locks', {});
    var status = document.getElementById('topbar-status');
    var roomIds = data.rooms.map(function (r) {
      return r.id;
    });
    var tabs = {};
    var panels = {};
    var planGroups = [];

    document.title = data.chapter.label + '・現場調查｜懷錶檔案';

    app.appendChild(
      el('p', { className: 'privacy-note', text: '這是現場調查員的畫面，別讓偵訊官看到。每件證物都有編號，偵訊官「出示證物」時要用：先把每件證物的編號和名稱念給對方聽。' })
    );
    app.appendChild(
      el('div', { className: 'page-head' }, [
        el('p', { className: 'kicker', text: data.chapter.label + '・現場調查' }),
        el('h1', { className: 'page-title', text: data.chapter.title }),
        data.intro ? el('p', { className: 'lead', text: data.intro }) : null
      ])
    );

    if (data.plan) app.appendChild(floorPlan(data.plan));

    var tabCols = data.rooms.length <= 5 ? data.rooms.length : Math.ceil(data.rooms.length / 2);
    var tablist = el('div', { className: 'room-tabs', role: 'tablist', 'aria-label': '房間', style: '--tabs:' + tabCols });
    app.appendChild(tablist);

    data.rooms.forEach(function (room) {
      var tab = el('button', {
        className: 'room-tab',
        type: 'button',
        role: 'tab',
        id: 'tab-' + room.id,
        'aria-controls': 'room-' + room.id,
        'data-room': room.id
      }, [room.name, el('span', { className: 'tab-count' })]);
      tab.addEventListener('click', function () {
        activate(room.id);
      });
      tablist.appendChild(tab);
      tabs[room.id] = tab;

      var panel = el('section', { className: 'room', id: 'room-' + room.id, 'data-room': room.id, role: 'tabpanel', 'aria-labelledby': 'tab-' + room.id }, [
        el('h2', { className: 'room-title' }, [el('span', { className: 'label', text: '房間' }), room.name]),
        room.intro ? el('p', { className: 'room-intro', text: room.intro }) : null
      ]);
      var list = el('div', { className: 'items' });
      room.items.forEach(function (item) {
        list.appendChild(itemCard(item, false));
      });
      panel.appendChild(list);
      app.appendChild(panel);
      panels[room.id] = panel;
    });

    tablist.addEventListener('keydown', function (event) {
      var index = roomIds.indexOf(document.activeElement && document.activeElement.getAttribute('data-room'));
      if (index === -1) return;
      var next = null;
      if (event.key === 'ArrowRight') next = (index + 1) % roomIds.length;
      else if (event.key === 'ArrowLeft') next = (index - 1 + roomIds.length) % roomIds.length;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = roomIds.length - 1;
      if (next === null) return;
      event.preventDefault();
      activate(roomIds[next]);
      tabs[roomIds[next]].focus();
    });

    app.appendChild(
      el('footer', { className: 'page-footer' }, [
        el('p', { text: '證物編號有缺號，代表還有東西藏在某處。查完了？回本章簡報，和偵訊官一起提出指控。' }),
        el('div', { className: 'footer-actions' }, [el('a', { className: 'btn btn-ghost', href: 'index.html', text: '回本章簡報' })])
      ])
    );

    // 之前打開過的鎖，重新整理後自動打開
    Object.keys(openedLocks).forEach(function (no) {
      var form = app.querySelector('.lock[data-no="' + no + '"]');
      if (form) tryUnlock(form, openedLocks[no], true);
    });

    activate(roomIds[0]);
    refresh();

    /* ---------- 平面圖 ---------- */

    function floorPlan(plan) {
      var figure = el('figure', { className: 'paper floorplan' });
      var svg = document.createElementNS(SVG, 'svg');
      svg.setAttribute('viewBox', '0 0 ' + plan.w + ' ' + plan.h);
      svg.setAttribute('role', 'img');
      svg.setAttribute('aria-label', '平面示意圖');
      svg.innerHTML =
        '<defs><pattern id="fp-rain" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(18)"><line x1="1" y1="0" x2="1" y2="4" stroke="currentColor" stroke-width="1" opacity=".35"/></pattern>' +
        '<pattern id="fp-steps" width="10" height="9" patternUnits="userSpaceOnUse"><line x1="0" y1="0.5" x2="10" y2="0.5" stroke="currentColor" stroke-width="1" opacity=".35"/></pattern>' +
        '<pattern id="fp-grid" width="12" height="12" patternUnits="userSpaceOnUse"><path d="M12 0H0V12" fill="none" stroke="currentColor" stroke-width=".6" opacity=".18"/></pattern></defs>';
      (plan.links || []).forEach(function (l) {
        var line = document.createElementNS(SVG, 'path');
        line.setAttribute('class', 'fp-link');
        line.setAttribute('d', 'M' + l[0] + ' ' + l[1] + ' L' + l[2] + ' ' + l[3]);
        svg.appendChild(line);
      });
      (plan.notes || []).forEach(function (n) {
        var t = document.createElementNS(SVG, 'text');
        t.setAttribute('class', 'fp-level');
        t.setAttribute('x', n.x);
        t.setAttribute('y', n.y);
        t.textContent = n.text;
        svg.appendChild(t);
      });
      plan.rooms.forEach(function (r) {
        var g = document.createElementNS(SVG, 'g');
        g.setAttribute('class', 'fp-room' + (r.room ? '' : ' fp-static'));
        if (r.room) g.setAttribute('data-room', r.room);
        var rect = document.createElementNS(SVG, 'rect');
        rect.setAttribute('class', 'fp-fill');
        ['x', 'y', 'w', 'h'].forEach(function (k) {
          rect.setAttribute(k === 'w' ? 'width' : k === 'h' ? 'height' : k, r[k]);
        });
        if (r.dashed) rect.setAttribute('stroke-dasharray', '5 3');
        g.appendChild(rect);
        if (r.hatch) {
          var hatch = document.createElementNS(SVG, 'rect');
          hatch.setAttribute('class', 'fp-hatch');
          hatch.setAttribute('x', r.x + 2);
          hatch.setAttribute('y', r.y + 2);
          hatch.setAttribute('width', Math.max(0, r.w - 4));
          hatch.setAttribute('height', Math.max(0, r.h - 4));
          hatch.setAttribute('fill', 'url(#fp-' + r.hatch + ')');
          g.appendChild(hatch);
        }
        var cx = r.x + r.w / 2;
        var cy = r.y + r.h / 2;
        var name = document.createElementNS(SVG, 'text');
        name.setAttribute('class', 'fp-name');
        name.setAttribute('x', cx);
        name.setAttribute('y', cy - (r.room ? 7 : 0));
        name.textContent = r.label;
        g.appendChild(name);
        if (r.room) {
          var count = document.createElementNS(SVG, 'text');
          count.setAttribute('class', 'fp-count');
          count.setAttribute('x', cx);
          count.setAttribute('y', cy + 13);
          count.setAttribute('data-count-for', r.room);
          g.appendChild(count);
          g.addEventListener('click', function () {
            activate(r.room, true);
          });
          planGroups.push(g);
        }
        svg.appendChild(g);
      });
      figure.appendChild(svg);
      figure.appendChild(el('figcaption', { text: '平面示意圖（點房間查看）' }));
      return figure;
    }

    /* ---------- 證物卡 ---------- */

    function itemCard(item, fresh) {
      var card = el('details', { className: 'item paper' + (fresh ? ' is-fresh' : ''), 'data-item': String(item.no) });
      var summary = el('summary', null, [
        el('span', { className: 'item-head' }, [
          el('span', { className: 'item-icon', 'aria-hidden': 'true', text: item.icon }),
          el('span', { className: 'item-title' }, [
            el('span', { className: 'item-name', text: item.name }),
            el('span', { className: 'item-marks' }, [
              el('span', { className: 'evidence-tag', text: 'No.' + pad(item.no) }),
              fresh ? el('span', { className: 'fresh-mark', text: '新發現' }) : null,
              el('span', { className: 'seen-mark', text: '已查看' })
            ])
          ]),
          el('span', { className: 'chevron', 'aria-hidden': 'true' })
        ])
      ]);
      card.appendChild(summary);
      var body = el('div', { className: 'item-body' }, [el('p', { className: 'item-desc', text: item.desc })]);
      if (item.reveal) {
        body.appendChild(
          el('details', { className: 'dig' }, [el('summary', null, [el('span', { className: 'dig-button', text: item.reveal.button })]), el('p', { className: 'item-desc dig-result', text: item.reveal.text })])
        );
      }
      if (item.lock) body.appendChild(lockForm(item));
      card.appendChild(body);
      card.addEventListener('toggle', function () {
        if (card.open && seen.indexOf(item.no) === -1) {
          seen.push(item.no);
          progress.set('seen', seen);
          refresh();
        }
      });
      return card;
    }

    function lockForm(item) {
      var lock = item.lock;
      var form = el('form', { className: 'lock', 'data-no': String(item.no), novalidate: true });
      form.appendChild(el('p', { className: 'lock-label' }, [el('span', { className: 'lock-icon', 'aria-hidden': 'true', text: '🔒' }), lock.label]));
      if (lock.prompt) form.appendChild(el('p', { className: 'lock-prompt', text: lock.prompt }));
      var row = el('div', { className: 'lock-row' });
      if (lock.kind === 'clock') {
        row.appendChild(clockDial(form));
        row.appendChild(el('button', { className: 'btn btn-primary lock-submit', type: 'submit', text: '撥到這個時刻' }));
      } else {
        row.appendChild(
          el('input', {
            className: 'lock-input',
            name: 'code',
            type: 'text',
            inputmode: lock.kind === 'digits' ? 'numeric' : 'text',
            autocomplete: 'off',
            autocapitalize: lock.kind === 'letters' ? 'characters' : 'off',
            spellcheck: 'false',
            maxlength: String(lock.length || 8),
            placeholder: lock.kind === 'digits' ? repeat('0', lock.length || 4) : repeat('A', lock.length || 4),
            'aria-label': lock.label + '的密碼'
          })
        );
        row.appendChild(el('button', { className: 'btn btn-primary lock-submit', type: 'submit', text: '開鎖' }));
      }
      form.appendChild(row);
      form.appendChild(el('p', { className: 'lock-message', role: 'status' }));
      form.addEventListener('submit', function (event) {
        event.preventDefault();
        var value = lock.kind === 'clock' ? form.__clock.h + ':' + pad(form.__clock.m) : form.elements.code.value;
        tryUnlock(form, value, false);
      });
      form.__lock = lock;
      form.__no = item.no;
      return form;
    }

    // 撥時鐘：畫一個錶面，用大按鈕撥時、分（手機好按，也能用鍵盤）
    function clockDial(form) {
      var state = { h: 12, m: 0 };
      form.__clock = state;
      var svg = document.createElementNS(SVG, 'svg');
      svg.setAttribute('viewBox', '0 0 120 120');
      svg.setAttribute('class', 'clock-face');
      svg.setAttribute('aria-hidden', 'true');
      var ticks = '';
      for (var i = 0; i < 60; i += 1) {
        var long = i % 5 === 0;
        ticks += '<line x1="60" y1="' + (long ? 9 : 11) + '" x2="60" y2="15" transform="rotate(' + i * 6 + ' 60 60)" class="' + (long ? 'tick-hour' : 'tick') + '"/>';
      }
      svg.innerHTML =
        '<circle cx="60" cy="60" r="55" class="dial"/>' +
        ticks +
        '<line x1="60" y1="60" x2="60" y2="34" class="hand-hour"/>' +
        '<line x1="60" y1="64" x2="60" y2="20" class="hand-minute"/>' +
        '<circle cx="60" cy="60" r="3.2" class="hub"/>';
      var hourHand = svg.querySelector('.hand-hour');
      var minuteHand = svg.querySelector('.hand-minute');
      var readout = el('p', { className: 'clock-readout', 'aria-live': 'polite' });
      function render() {
        hourHand.setAttribute('transform', 'rotate(' + ((state.h % 12) * 30 + state.m / 2) + ' 60 60)');
        minuteHand.setAttribute('transform', 'rotate(' + state.m * 6 + ' 60 60)');
        readout.textContent = state.h + ' 點 ' + pad(state.m) + ' 分';
      }
      function step(label, dh, dm) {
        return el('button', {
          className: 'btn btn-ghost clock-step',
          type: 'button',
          text: label,
          'aria-label': (dh ? '時' : '分') + (dh > 0 || dm > 0 ? '加' : '減') + Math.abs(dh || dm),
          onclick: function () {
            state.h = ((state.h - 1 + dh + 12) % 12) + 1;
            state.m = (state.m + dm + 60) % 60;
            render();
          }
        });
      }
      render();
      return el('div', { className: 'clock-dial' }, [
        svg,
        readout,
        el('div', { className: 'clock-row' }, [el('span', { className: 'clock-unit', text: '時' }), step('−1', -1, 0), step('＋1', 1, 0)]),
        el('div', { className: 'clock-row' }, [el('span', { className: 'clock-unit', text: '分' }), step('−10', 0, -10), step('−1', 0, -1), step('＋1', 0, 1), step('＋10', 0, 10)])
      ]);
    }

    function normalize(kind, value) {
      var v = String(value || '').trim();
      if (kind === 'digits') return v.replace(/\D/g, '');
      if (kind === 'letters') return v.toUpperCase().replace(/[^A-Z]/g, '');
      if (kind === 'clock') {
        var m = v.match(/^(\d{1,2})\D*(\d{2})$/);
        return m ? pad(Number(m[1])) + m[2] : '';
      }
      return v;
    }

    function tryUnlock(form, rawValue, silent) {
      var lock = form.__lock;
      var no = String(form.__no);
      var code = normalize(lock.kind, rawValue);
      var message = form.querySelector('.lock-message');
      var button = form.querySelector('.lock-submit');
      if (!code || (lock.length && lock.kind !== 'clock' && code.length !== lock.length)) {
        message.textContent = lock.kind === 'digits' ? '要輸入 ' + lock.length + ' 位數字。' : '要輸入 ' + lock.length + ' 個英文字母。';
        return;
      }
      button.disabled = true;
      ctx
        .hashHex(['lockidx', ctx.salt, no, code])
        .then(function (index) {
          if (index !== lock.i) throw new Error('wrong');
          return ctx.openBox(['lock', ctx.salt, no, code], lock);
        })
        .then(function (inner) {
          openedLocks[no] = code;
          progress.set('locks', openedLocks);
          var opened = el('div', { className: 'unlocked' + (silent ? '' : ' is-just-opened') }, [
            el('p', { className: 'unlocked-label' }, [el('span', { 'aria-hidden': 'true', text: '🔓 ' }), '打開了']),
            el('p', { className: 'item-desc', text: inner.text })
          ]);
          if ((inner.items || []).length) {
            var list = el('div', { className: 'items nested-items' });
            inner.items.forEach(function (child) {
              list.appendChild(itemCard(child, !silent));
            });
            opened.appendChild(list);
          }
          form.replaceWith(opened);
          // 鎖裡如果還有鎖，套用之前的紀錄
          opened.querySelectorAll('.lock').forEach(function (nestedForm) {
            var saved = openedLocks[nestedForm.getAttribute('data-no')];
            if (saved) tryUnlock(nestedForm, saved, true);
          });
          refresh();
        })
        .catch(function () {
          button.disabled = false;
          if (silent) {
            delete openedLocks[no];
            progress.set('locks', openedLocks);
            return;
          }
          message.textContent = lock.kind === 'clock' ? '指針撥過去了，什麼也沒發生。' : '鎖沒有打開。';
          form.classList.remove('is-shaking');
          void form.offsetWidth;
          form.classList.add('is-shaking');
        });
    }

    /* ---------- 分頁與計數 ---------- */

    function activate(room, reveal) {
      roomIds.forEach(function (id) {
        var on = id === room;
        tabs[id].setAttribute('aria-selected', on ? 'true' : 'false');
        tabs[id].tabIndex = on ? 0 : -1;
        panels[id].hidden = !on;
      });
      planGroups.forEach(function (g) {
        g.classList.toggle('is-active', g.getAttribute('data-room') === room);
      });
      if (reveal) {
        var top = panels[room].getBoundingClientRect().top;
        if (top > window.innerHeight * 0.55 || top < 0) Case.scrollIntoView(panels[room]);
      }
    }

    function refresh() {
      var total = 0;
      var done = 0;
      roomIds.forEach(function (id) {
        var cards = panels[id].querySelectorAll('.item[data-item]');
        var roomSeen = 0;
        Array.prototype.forEach.call(cards, function (card) {
          var isSeen = seen.indexOf(Number(card.getAttribute('data-item'))) !== -1;
          card.classList.toggle('is-seen', isSeen);
          if (isSeen) roomSeen += 1;
        });
        total += cards.length;
        done += roomSeen;
        var text = roomSeen + '/' + cards.length;
        var complete = cards.length > 0 && roomSeen === cards.length;
        tabs[id].querySelector('.tab-count').textContent = text;
        tabs[id].classList.toggle('is-done', complete);
        Array.prototype.forEach.call(document.querySelectorAll('[data-count-for="' + id + '"]'), function (node) {
          node.textContent = complete ? '✓ ' + text : text;
          node.parentNode.classList.toggle('is-done', complete);
        });
      });
      status.innerHTML = '';
      status.appendChild(document.createTextNode('已查看 '));
      status.appendChild(el('strong', { text: String(done) }));
      status.appendChild(document.createTextNode('/' + total));
    }
  });

  function pad(n) {
    return (n < 10 ? '0' : '') + n;
  }

  function repeat(ch, n) {
    return new Array(n + 1).join(ch);
  }
})();
