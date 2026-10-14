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
   "salt": "b35042656ddfdf0efe8f9661987a1b79",
   "check": {
    "iv": "516f7b66f2fc462f15f21ba7",
    "c": "c2364f3f8ced0b049fc13ae931e403e81a4f805e06c72e7233b1dfaf"
   }
  },
  {
   "id": "ch2",
   "label": "第二章",
   "title": "鐘樓十三響",
   "teaser": "颱風夜的舊鐘樓，有人倒在機芯旁，午夜的鐘多敲了一下。",
   "href": "ch2/",
   "salt": "adc144a69cba0b396096d1f2410fd068",
   "check": {
    "iv": "9ca1bd7b0f3546188e8c04eb",
    "c": "0c161c53ce0a8092b4e4cd653751e8cef226ba8ff7394c68c3da687d"
   }
  },
  {
   "id": "ch3",
   "label": "終章",
   "title": "第十三時",
   "teaser": "三只錶聚齊的那一夜，三十年前那場火，終於要說出真相。",
   "href": "ch3/",
   "salt": "bb4d8915ba5076d83f4b5c0f7cc3455e",
   "check": {
    "iv": "0456e7d3b0ffc39c834e1fc6",
    "c": "fd891650da224e6e1a4222fa5531128523f9395c2502e664390d79c9"
   }
  }
 ]
};
