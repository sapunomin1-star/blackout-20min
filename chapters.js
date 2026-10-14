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
   "salt": "475169d92ecb00c3535f05df943836be",
   "check": {
    "iv": "a5a3cb450dded7af6f4f2a4a",
    "c": "45580b2d4b20e80587b4fc2ea3a2d5462fc06b7997391e6943dbaa7f"
   }
  },
  {
   "id": "ch2",
   "label": "第二章",
   "title": "鐘樓十三響",
   "teaser": "颱風夜的舊鐘樓，有人倒在機芯旁，午夜的鐘多敲了一下。",
   "href": "ch2/",
   "salt": "4aee759749daf4c2989f1dba04c3433a",
   "check": {
    "iv": "679fd39950aa309643c7db5b",
    "c": "e84d40b6a521a2f10d2158f140ad59dbde43abc891ddfde089dd5fbc"
   }
  },
  {
   "id": "ch3",
   "label": "終章",
   "title": "第十三時",
   "teaser": "三只錶聚齊的那一夜，三十年前那場火，終於要說出真相。",
   "href": "ch3/",
   "salt": "0be021edad875f286189ff20fc547c6f",
   "check": {
    "iv": "7e44f02ae893ac3fba8ca5bb",
    "c": "fce8f973e16e7effccd6dff10d9f9b5a43fe428d9947d3d5fa6b3dad"
   }
  }
 ]
};
