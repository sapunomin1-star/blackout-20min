/* 由 tools/build-chapters.mjs 產生，不要手改。只有章節標題、一句話簡介與解鎖用的驗證密文。 */
window.BLACKOUT_CHAPTERS = {
 "v": 1,
 "series": {
  "title": "懷錶檔案",
  "subtitle": "雙人合作推理・序章與三個案件"
 },
 "chapters": [
  {
   "id": "prologue",
   "label": "序章",
   "title": "停電的二十分鐘",
   "teaser": "雨夜跳電的二十分鐘裡，書房抽屜裡的古董懷錶不見了。",
   "href": "prologue/",
   "open": true
  },
  {
   "id": "ch1",
   "label": "第一章",
   "title": "贗品之夜",
   "teaser": "中秋夜的拍賣預展，上了鎖的展示櫃裡，第二只懷錶變成了贗品。",
   "href": "ch1/",
   "salt": "134fce955769cf1d37390f90aacaa19f",
   "check": {
    "iv": "bf2fd8a8544685b0412d0d02",
    "c": "a2cd1bd51c5a2b2ada282db503c67ea7998494758060f2d7776d93c1"
   }
  },
  {
   "id": "ch2",
   "label": "第二章",
   "title": "鐘樓十三響",
   "teaser": "颱風夜的舊鐘樓，有人倒在機芯旁，午夜的鐘多敲了一下。",
   "href": "ch2/",
   "salt": "afd7b69a431d2446ca507c864a153e03",
   "check": {
    "iv": "2aaee300d36d29b1eb98d18f",
    "c": "5c2200f1bba07b8773d8f374af86eff8eb9c934c69292cfd9488ff68"
   }
  },
  {
   "id": "ch3",
   "label": "終章",
   "title": "第十三時",
   "teaser": "三只錶聚齊的那一夜，三十年前那場火，終於要說出真相。",
   "href": "ch3/",
   "salt": "7b40096baff0082e53e6f16ae26d4a54",
   "check": {
    "iv": "55804509b2f0ce4e39a96eba",
    "c": "b1607b79de2ecac289718335ccfff9e166c531fec62bc8285905d864"
   }
  }
 ]
};
