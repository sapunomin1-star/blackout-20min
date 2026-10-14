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
   "salt": "6ecff6e0ea6a83d034dafe35c3cec9b9",
   "check": {
    "iv": "faa56de7a740c08d8a459f2f",
    "c": "8d52e64271dc07815c44aea7e26e7110de30ab830c8e05d28a74a731"
   }
  },
  {
   "id": "ch2",
   "label": "第二章",
   "title": "鐘樓十三響",
   "teaser": "颱風夜的舊鐘樓，有人倒在機芯旁，午夜的鐘多敲了一下。",
   "href": "ch2/",
   "salt": "3e07e6ae4dde199f613f865f3233cbee",
   "check": {
    "iv": "21917121e9b948d363697c7f",
    "c": "86fe4b5c804544694a4181e5cc42434e95cf0e88eae0adba2ad1b410"
   }
  },
  {
   "id": "ch3",
   "label": "終章",
   "title": "第十三時",
   "teaser": "三只錶聚齊的那一夜，三十年前那場火，終於要說出真相。",
   "href": "ch3/",
   "salt": "e302a94d25440bc113f7bb6838733462",
   "check": {
    "iv": "e0b0a1ab51e6a58e4b1bb528",
    "c": "0822a120feeb779a129855fb850cce6e815d06b5e84a3e19a9fdfbbc"
   }
  }
 ]
};
