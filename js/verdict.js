/*
 * 判定核心：把玩家的選擇拿去雜湊、解密，不含任何答案或訊息原文。
 *
 * 判定資料（js/secrets.js，由 tools/build-secrets.mjs 產生）只有鹽、雜湊與 AES-GCM 密文：
 *   suspects：每位嫌疑人一筆，索引是 SHA-256(…|idx|鹽|嫌疑人)，金鑰由同一位嫌疑人另外推導。
 *             四筆的密文長度一樣，依索引排序，看不出哪一筆屬於誰。
 *   solved：  「嫌疑人＋證據＋破綻」全對時的雜湊清單。
 *   truth：   真相的密文，金鑰由「嫌疑人＋破綻」推導。
 *
 * 瀏覽器（classic script）與 node（tools/ 用 vm 載入）共用這一份。
 */
(function (root) {
  'use strict';

  var NS = 'blackout20';

  function subtle() {
    return root.crypto && root.crypto.subtle ? root.crypto.subtle : null;
  }

  function isSupported() {
    return Boolean(subtle()) && typeof root.TextEncoder === 'function';
  }

  function hexToBytes(hex) {
    if (typeof hex !== 'string' || hex.length % 2 !== 0 || /[^0-9a-f]/.test(hex)) {
      throw new Error('判定資料格式錯誤');
    }
    var out = new Uint8Array(hex.length / 2);
    for (var i = 0; i < out.length; i += 1) {
      out[i] = parseInt(hex.substr(i * 2, 2), 16);
    }
    return out;
  }

  function bytesToHex(buffer) {
    var bytes = new Uint8Array(buffer);
    var hex = '';
    for (var i = 0; i < bytes.length; i += 1) {
      hex += (bytes[i] < 16 ? '0' : '') + bytes[i].toString(16);
    }
    return hex;
  }

  function material(label, salt, parts) {
    return [NS, label, salt].concat(parts).join('|');
  }

  function digest(text) {
    return subtle().digest('SHA-256', new root.TextEncoder().encode(text));
  }

  function hashHex(label, salt, parts) {
    return digest(material(label, salt, parts)).then(bytesToHex);
  }

  function openBox(label, salt, parts, box) {
    return digest(material(label, salt, parts))
      .then(function (raw) {
        return subtle().importKey('raw', raw, { name: 'AES-GCM' }, false, ['decrypt']);
      })
      .then(function (key) {
        return subtle().decrypt({ name: 'AES-GCM', iv: hexToBytes(box.iv) }, key, hexToBytes(box.c));
      })
      .then(function (plain) {
        return JSON.parse(new root.TextDecoder().decode(plain));
      });
  }

  function checkChoice(choice) {
    ['suspect', 'evidence', 'flaw'].forEach(function (field) {
      var value = choice && choice[field];
      if (typeof value !== 'string' || !value || value.indexOf('|') !== -1) {
        throw new Error('選項不完整：' + field);
      }
    });
  }

  /*
   * 回傳 Promise：
   *   { outcome: 'solved', text: 真相 }
   *   { outcome: 'message', text: 判定訊息 }（兇手對但理由不完整、選錯人，畫面上一律同樣呈現）
   */
  function judge(data, choice) {
    return Promise.resolve().then(function () {
      if (!isSupported()) throw new Error('這個環境不能使用加密功能');
      if (!data || data.v !== 1) throw new Error('判定資料尚未建立');
      checkChoice(choice);
      var salt = data.salt;
      return hashHex('full', salt, [choice.suspect, choice.evidence, choice.flaw]).then(function (full) {
        if (data.solved.indexOf(full) !== -1) {
          return openBox('truth', salt, [choice.suspect, choice.flaw], data.truth).then(function (payload) {
            return { outcome: 'solved', text: payload.t };
          });
        }
        return hashHex('idx', salt, [choice.suspect]).then(function (index) {
          var entry = null;
          for (var i = 0; i < data.suspects.length; i += 1) {
            if (data.suspects[i].i === index) entry = data.suspects[i];
          }
          if (!entry) throw new Error('找不到這位嫌疑人的判定資料');
          return openBox('key', salt, [choice.suspect], entry).then(function (payload) {
            return { outcome: 'message', text: payload.m, kind: payload.k };
          });
        });
      });
    });
  }

  root.BlackoutVerdict = { isSupported: isSupported, judge: judge };
})(typeof window !== 'undefined' ? window : this);
