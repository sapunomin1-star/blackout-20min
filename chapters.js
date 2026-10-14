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
   "salt": "d3357c1929d54129563b14dc0a41c555",
   "check": {
    "iv": "872e33898ff88b67b1ff7af9",
    "c": "14eb98c5d680329cdb1d9811fae6e49d7bc89a047c92ab768d7e9034"
   }
  },
  {
   "id": "ch2",
   "label": "第二章",
   "title": "鐘樓十三響",
   "teaser": "颱風夜的舊鐘樓，有人倒在機芯旁，午夜的鐘多敲了一下。",
   "href": "ch2/",
   "salt": "23c2578074fe3001234005670f72c302",
   "check": {
    "iv": "619afccf5ee0506c92c9af96",
    "c": "d9ea5dd20f25d134c37a7897cb98b45dce5e099f4b5948a37c096549"
   }
  },
  {
   "id": "ch3",
   "label": "終章",
   "title": "第十三時",
   "teaser": "三只錶聚齊的那一夜，三十年前那場火，終於要說出真相。",
   "href": "ch3/",
   "salt": "517b65369d129769b4d4ccabbc6fa75a",
   "check": {
    "iv": "a369c51afac979b6afcbc93d",
    "c": "c352e042d1685eafb4871bcf852ac5e602520a087d8ce3d2ff43fa24"
   }
  }
 ]
};
