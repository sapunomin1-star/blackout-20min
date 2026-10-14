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
   "salt": "ac54dac54bebb0f021070f6aef9e1988",
   "check": {
    "iv": "f2849d8c6f04ad2ca21ff1bf",
    "c": "1a3860debf103a3bbc9786ce81fe7b84493c1a97963b64581f21f01b"
   }
  },
  {
   "id": "ch2",
   "label": "第二章",
   "title": "鐘樓十三響",
   "teaser": "颱風夜的舊鐘樓，有人倒在機芯旁，午夜的鐘多敲了一下。",
   "href": "ch2/",
   "salt": "f4e0fbe22faa534564b234e9ba9ffd99",
   "check": {
    "iv": "2fe946e07dc670696ac795a3",
    "c": "cfd20a2b10f84b0de2c11b77b3765d00087dcdfd4c45790a80f76437"
   }
  },
  {
   "id": "ch3",
   "label": "終章",
   "title": "第十三時",
   "teaser": "三只錶聚齊的那一夜，三十年前那場火，終於要說出真相。",
   "href": "ch3/",
   "salt": "82b6876916f3b3e61de5c10673c74f4f",
   "check": {
    "iv": "a12041bacfb5b9f2ff282faa",
    "c": "76523793ccc7b60584790a14b0e902875bba25082113d82c158b7786"
   }
  }
 ]
};
