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
   "salt": "7217a3853f4f46fdf93d8194f14401c8",
   "check": {
    "iv": "43fed620a7ea7908e69141e3",
    "c": "de7da7539f293921b692ce64b44a709911de98f1a1871086cd4d7965"
   }
  },
  {
   "id": "ch2",
   "label": "第二章",
   "title": "鐘樓十三響",
   "teaser": "颱風夜的舊鐘樓，有人倒在機芯旁，午夜的鐘多敲了一下。",
   "href": "ch2/",
   "salt": "f56d47276106c4af31c1aafe2502c71e",
   "check": {
    "iv": "1a31ab315bf79dd04a4b172e",
    "c": "3a308d13f1ef42c11aef419890bd1fe7d699f9fb3a18bf5a6e92dee0"
   }
  },
  {
   "id": "ch3",
   "label": "終章",
   "title": "第十三時",
   "teaser": "三只錶聚齊的那一夜，三十年前那場火，終於要說出真相。",
   "href": "ch3/",
   "salt": "8a0bc591c66f3b37450ef6c47422f0ba",
   "check": {
    "iv": "c86fa54b9918ffff04291c05",
    "c": "7ddea85fb4256867d01fb16fbb77c9db09006eb413d6e36d9ba5dfe0"
   }
  }
 ]
};
