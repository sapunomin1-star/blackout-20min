/*
 * 共用工具：只有本機紀錄的讀寫。
 * 這個檔會被每一頁載入，所以不放任何案件內容。
 */
(function () {
  'use strict';

  var PREFIX = 'blackout20:';

  // localStorage 在私密瀏覽、停用儲存時可能丟錯，一律包 try/catch，失敗就當作沒有紀錄。
  function loadList(key) {
    try {
      var raw = window.localStorage.getItem(PREFIX + key);
      var list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch (e) {
      return [];
    }
  }

  function saveList(key, list) {
    try {
      window.localStorage.setItem(PREFIX + key, JSON.stringify(list));
    } catch (e) {
      /* 存不了就算了，不影響遊戲 */
    }
  }

  function clear(key) {
    try {
      window.localStorage.removeItem(PREFIX + key);
    } catch (e) {
      /* 同上 */
    }
  }

  // 記錄「看過哪些東西」的集合
  function markSet(key) {
    var items = loadList(key);
    return {
      has: function (id) {
        return items.indexOf(id) !== -1;
      },
      add: function (id) {
        if (items.indexOf(id) === -1) {
          items.push(id);
          saveList(key, items);
        }
      },
      size: function () {
        return items.length;
      },
      clear: function () {
        items = [];
        clear(key);
      }
    };
  }

  window.Blackout = { markSet: markSet };
})();
