/*
 * 偵訊頁的互動：記錄哪些嫌疑人已經追問過。
 * 口供文字都寫在 interrogation.html；這裡只處理標記。
 */
(function () {
  'use strict';

  var asked = window.Blackout.markSet('interrogation-asked');
  var cards = Array.prototype.slice.call(document.querySelectorAll('.suspect[data-suspect]'));

  function refresh() {
    var count = 0;
    cards.forEach(function (card) {
      var id = card.getAttribute('data-suspect');
      var isAsked = asked.has(id);
      if (isAsked) count += 1;
      card.classList.toggle('is-asked', isAsked);
      var link = document.querySelector('.suspect-nav a[data-suspect="' + id + '"]');
      if (link) link.classList.toggle('is-asked', isAsked);
    });
    document.getElementById('asked-count').textContent = String(count);
    document.getElementById('suspect-total').textContent = String(cards.length);
  }

  cards.forEach(function (card) {
    var followUp = card.querySelector('.follow-up');
    followUp.addEventListener('toggle', function () {
      if (followUp.open) {
        asked.add(card.getAttribute('data-suspect'));
        refresh();
      }
    });
  });

  document.getElementById('reset-marks').addEventListener('click', function () {
    asked.clear();
    cards.forEach(function (card) {
      card.querySelector('.follow-up').open = false;
    });
    refresh();
  });

  refresh();
})();
