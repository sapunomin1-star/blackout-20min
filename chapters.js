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
   "salt": "413780c637ab4746c3562eba66f66894",
   "check": {
    "iv": "ebc633e269ff360ab17e9a05",
    "c": "13d062df59bd4cff3e8e2d89f1a9d62631ce7e9ac5126f55ee43ab56"
   }
  },
  {
   "id": "ch2",
   "label": "第二章",
   "title": "鐘樓十三響",
   "teaser": "颱風夜的舊鐘樓，有人倒在機芯旁，午夜的鐘多敲了一下。",
   "href": "ch2/",
   "salt": "df33606b2a8acc867a4d7050490b84ac",
   "check": {
    "iv": "7b1e987ab5e5d32ab1c23086",
    "c": "28f8493f47a7e05b2d9988e87b198ea0da586f9a202cb5b1ceaeb2fd"
   }
  },
  {
   "id": "ch3",
   "label": "終章",
   "title": "第十三時",
   "teaser": "三只錶聚齊的那一夜，三十年前那場火，終於要說出真相。",
   "href": "ch3/",
   "salt": "5fed1d32b29bf7924c0e792a929dfc62",
   "check": {
    "iv": "644eeae724e84ae919579dd7",
    "c": "dccf6790f5aeee039ea0e32adb249cfb742bb5703342a630c92b48ae"
   }
  }
 ]
};
