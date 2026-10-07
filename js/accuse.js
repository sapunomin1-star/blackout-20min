/*
 * 指控頁的互動：開場確認、三個欄位、送出判定、顯示結果。
 * 選項文字都寫在 accuse.html；答案不在這裡，判定交給 js/verdict.js 和 js/secrets.js。
 */
(function () {
  'use strict';

  var form = document.getElementById('accuse-form');
  var gate = document.getElementById('gate');
  var errorBox = document.getElementById('form-error');
  var submit = document.getElementById('submit');
  var verdict = document.getElementById('verdict');
  var verdictTitle = document.getElementById('verdict-title');
  var verdictText = document.getElementById('verdict-text');
  var solvedStamp = document.getElementById('solved-stamp');
  var retry = document.getElementById('retry');
  var homeLink = document.getElementById('home-link');
  var lights = document.getElementById('lights');
  var dropdowns = Array.prototype.slice.call(document.querySelectorAll('.dropdown'));
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var FIELD_NAMES = { suspect: '兇手', evidence: '現場證據', flaw: '口供中的破綻' };
  var secureOk = window.isSecureContext !== false && window.BlackoutVerdict.isSupported();
  var dataState = 'loading'; // loading | ready | missing

  /* ---------- 判定資料 ---------- */

  function loadSecrets() {
    var script = document.createElement('script');
    script.src = 'js/secrets.js';
    script.onload = function () {
      dataState = window.BLACKOUT_SECRETS ? 'ready' : 'missing';
    };
    script.onerror = function () {
      dataState = 'missing';
    };
    document.body.appendChild(script);
  }

  if (!secureOk) {
    document.getElementById('insecure-notice').hidden = false;
    submit.disabled = true;
  }
  loadSecrets();

  /* ---------- 開場確認 ---------- */

  document.getElementById('gate-ready').addEventListener('click', function () {
    gate.hidden = true;
    form.hidden = false;
    var first = form.querySelector('legend');
    first.setAttribute('tabindex', '-1');
    first.focus();
  });

  /* ---------- 下拉選單 ---------- */

  function closeDropdown(dropdown, focusSummary) {
    dropdown.open = false;
    if (focusSummary) dropdown.querySelector('summary').focus();
  }

  function updateDropdownValue(dropdown) {
    var valueBox = dropdown.querySelector('.dropdown-value');
    var checked = dropdown.querySelector('input:checked');
    valueBox.textContent = '';
    if (!checked) {
      valueBox.textContent = valueBox.getAttribute('data-placeholder');
      valueBox.classList.add('is-placeholder');
      return;
    }
    var group = checked.closest('.opt-group').querySelector('.opt-group-label');
    var groupLine = document.createElement('span');
    groupLine.className = 'value-group';
    groupLine.textContent = group.textContent;
    var text = checked.parentNode.querySelector('.opt-text');
    var valueLine = document.createElement('span');
    valueLine.className = text.className;
    valueLine.textContent = text.textContent;
    valueBox.appendChild(groupLine);
    valueBox.appendChild(valueLine);
    valueBox.classList.remove('is-placeholder');
  }

  dropdowns.forEach(function (dropdown) {
    var panel = dropdown.querySelector('.dropdown-panel');

    dropdown.addEventListener('toggle', function () {
      if (!dropdown.open) return;
      dropdowns.forEach(function (other) {
        if (other !== dropdown) other.open = false;
      });
      var checked = panel.querySelector('input:checked');
      if (checked) {
        var label = checked.parentNode;
        panel.scrollTop = Math.max(0, label.offsetTop - panel.clientHeight / 3);
      }
    });

    panel.addEventListener('change', function () {
      updateDropdownValue(dropdown);
      syncCheckedClasses();
      hideError();
    });

    // 用手指或滑鼠點選項：選好就收起來。鍵盤用方向鍵切換時不收，按 Enter 或 Esc 才收。
    panel.addEventListener('click', function (event) {
      var opt = event.target.closest('.opt');
      if (!opt || event.detail === 0) return;
      window.setTimeout(function () {
        closeDropdown(dropdown, false);
      }, 120);
    });

    panel.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' || event.key === 'Escape') {
        event.preventDefault();
        closeDropdown(dropdown, true);
      }
    });

    updateDropdownValue(dropdown);
  });

  document.addEventListener('click', function (event) {
    dropdowns.forEach(function (dropdown) {
      if (dropdown.open && !dropdown.contains(event.target)) dropdown.open = false;
    });
  });

  document.addEventListener('keydown', function (event) {
    if (event.key !== 'Escape') return;
    dropdowns.forEach(function (dropdown) {
      if (dropdown.open) closeDropdown(dropdown, true);
    });
  });

  // 不支援 :has() 的瀏覽器靠這個 class 顯示選取狀態
  function syncCheckedClasses() {
    Array.prototype.forEach.call(form.querySelectorAll('.suspect-option, .opt'), function (label) {
      var input = label.querySelector('input');
      label.classList.toggle('is-checked', Boolean(input && input.checked));
    });
  }

  form.addEventListener('change', function () {
    syncCheckedClasses();
    hideError();
  });

  /* ---------- 送出 ---------- */

  function hideError() {
    errorBox.hidden = true;
  }

  function showError(message, focusTarget) {
    errorBox.textContent = message;
    errorBox.hidden = false;
    if (focusTarget) focusTarget.focus();
  }

  function valueOf(name) {
    var checked = form.querySelector('input[name="' + name + '"]:checked');
    return checked ? checked.value : '';
  }

  function renderParagraphs(container, text) {
    container.textContent = '';
    String(text)
      .split(/\n\s*\n|\n/)
      .map(function (line) {
        return line.trim();
      })
      .filter(Boolean)
      .forEach(function (line) {
        var p = document.createElement('p');
        p.textContent = line;
        container.appendChild(p);
      });
  }

  function showVerdict(result) {
    var solved = result.outcome === 'solved';
    verdict.classList.toggle('verdict-solved', solved);
    verdict.classList.toggle('verdict-message', !solved);
    solvedStamp.hidden = !solved;
    verdictTitle.textContent = solved ? '真相' : '判定';
    verdictText.className = 'verdict-text' + (solved ? ' truth' : '');
    renderParagraphs(verdictText, result.text);
    retry.hidden = solved;
    homeLink.hidden = !solved;
    form.hidden = solved;
    verdict.hidden = false;

    if (solved && !reduceMotion) {
      lights.classList.remove('is-on');
      void lights.offsetWidth; // 重新觸發動畫
      lights.classList.add('is-on');
    }
    verdict.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    verdictTitle.focus({ preventScroll: true });
  }

  function waitForData() {
    return new Promise(function (resolve) {
      (function poll(tries) {
        if (dataState !== 'loading' || tries > 50) resolve();
        else window.setTimeout(function () { poll(tries + 1); }, 100);
      })(0);
    });
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    if (!secureOk) return;

    var choice = { suspect: valueOf('suspect'), evidence: valueOf('evidence'), flaw: valueOf('flaw') };
    var missing = ['suspect', 'evidence', 'flaw'].filter(function (name) {
      return !choice[name];
    });
    if (missing.length) {
      var target = document.getElementById('field-' + missing[0]);
      var focusable = missing[0] === 'suspect' ? target.querySelector('input') : target.querySelector('summary');
      showError('還沒選：' + missing.map(function (name) { return FIELD_NAMES[name]; }).join('、') + '。三個欄位都要選。', focusable);
      return;
    }

    hideError();
    submit.disabled = true;
    submit.textContent = '判定中…';

    waitForData()
      .then(function () {
        if (dataState !== 'ready') {
          throw new Error('missing');
        }
        return window.BlackoutVerdict.judge(window.BLACKOUT_SECRETS, choice);
      })
      .then(showVerdict)
      .catch(function (err) {
        if (err && err.message === 'missing') {
          showError('判定資料尚未建立（找不到 js/secrets.js），目前還不能判定。', null);
        } else {
          showError('判定時發生錯誤，請重新整理頁面再試一次。', null);
        }
      })
      .then(function () {
        submit.disabled = false;
        submit.textContent = '提出指控';
      });
  });

  retry.addEventListener('click', function () {
    verdict.hidden = true;
    form.hidden = false;
    var legend = form.querySelector('legend');
    legend.setAttribute('tabindex', '-1');
    form.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    legend.focus({ preventScroll: true });
  });

  syncCheckedClasses();
})();
