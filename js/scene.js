/*
 * 現場調查頁的互動：房間分頁、平面圖點選、已查看標記。
 * 物品文字都寫在 scene.html；這裡只處理顯示與紀錄。
 */
(function () {
  'use strict';

  var seen = window.Blackout.markSet('scene-seen');
  var tabs = Array.prototype.slice.call(document.querySelectorAll('.room-tab'));
  var panels = Array.prototype.slice.call(document.querySelectorAll('.room'));
  var items = Array.prototype.slice.call(document.querySelectorAll('.item[data-item]'));
  var planRooms = Array.prototype.slice.call(document.querySelectorAll('.fp-room'));
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function roomIds() {
    return tabs.map(function (tab) {
      return tab.getAttribute('data-room');
    });
  }

  function panelOf(room) {
    return document.getElementById('room-' + room);
  }

  function activate(room, options) {
    if (roomIds().indexOf(room) === -1) return;
    tabs.forEach(function (tab) {
      var on = tab.getAttribute('data-room') === room;
      tab.setAttribute('aria-selected', on ? 'true' : 'false');
      tab.tabIndex = on ? 0 : -1;
    });
    panels.forEach(function (panel) {
      panel.hidden = panel.getAttribute('data-room') !== room;
    });
    planRooms.forEach(function (g) {
      g.classList.toggle('is-active', g.getAttribute('data-room') === room);
    });
    if (options && options.focusTab) {
      document.getElementById('tab-' + room).focus();
    }
    if (options && options.reveal) {
      var panel = panelOf(room);
      var top = panel.getBoundingClientRect().top;
      if (top > window.innerHeight * 0.55 || top < 0) {
        panel.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
      }
    }
  }

  function refreshCounts() {
    var total = 0;
    var done = 0;
    roomIds().forEach(function (room) {
      var roomItems = panelOf(room).querySelectorAll('.item[data-item]');
      var roomSeen = 0;
      Array.prototype.forEach.call(roomItems, function (item) {
        var isSeen = seen.has(item.getAttribute('data-item'));
        item.classList.toggle('is-seen', isSeen);
        if (isSeen) roomSeen += 1;
      });
      total += roomItems.length;
      done += roomSeen;
      var text = roomSeen + '/' + roomItems.length;
      var complete = roomSeen === roomItems.length;
      var tab = document.getElementById('tab-' + room);
      tab.querySelector('.tab-count').textContent = text;
      tab.classList.toggle('is-done', complete);
      tab.setAttribute('aria-label', tab.firstChild.nodeValue + '，已查看 ' + roomSeen + ' 件，共 ' + roomItems.length + ' 件');
      Array.prototype.forEach.call(document.querySelectorAll('[data-count-for="' + room + '"]'), function (el) {
        el.textContent = complete ? '✓ ' + text : text;
        el.parentNode.classList.toggle('is-done', complete);
      });
    });
    document.getElementById('seen-count').textContent = String(done);
    document.getElementById('item-total').textContent = String(total);
  }

  tabs.forEach(function (tab, index) {
    tab.addEventListener('click', function () {
      activate(tab.getAttribute('data-room'));
    });
    tab.addEventListener('keydown', function (event) {
      var next = null;
      if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
      else if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = tabs.length - 1;
      if (next === null) return;
      event.preventDefault();
      activate(tabs[next].getAttribute('data-room'), { focusTab: true });
    });
  });

  planRooms.forEach(function (g) {
    g.addEventListener('click', function () {
      activate(g.getAttribute('data-room'), { reveal: true });
    });
  });

  items.forEach(function (item) {
    item.addEventListener('toggle', function () {
      if (item.open) {
        seen.add(item.getAttribute('data-item'));
        refreshCounts();
      }
    });
  });

  document.getElementById('reset-marks').addEventListener('click', function () {
    seen.clear();
    items.forEach(function (item) {
      item.open = false;
      Array.prototype.forEach.call(item.querySelectorAll('details'), function (inner) {
        inner.open = false;
      });
    });
    refreshCounts();
  });

  var fromHash = (window.location.hash || '').replace(/^#room-/, '');
  activate(roomIds().indexOf(fromHash) !== -1 ? fromHash : roomIds()[0]);
  refreshCounts();
})();
