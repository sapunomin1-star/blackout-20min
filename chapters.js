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
   "salt": "72e3efa27998d25e7c8948d07ce0d9ab",
   "check": {
    "iv": "c96b2f38a8beb026ca19f81f",
    "c": "116fba23c8fba03384d6a2763092e8470851702a6d5e3b5afa97b5d0"
   }
  },
  {
   "id": "ch2",
   "label": "第二章",
   "title": "鐘樓十三響",
   "teaser": "颱風夜的舊鐘樓，有人倒在機芯旁，午夜的鐘多敲了一下。",
   "href": "ch2/",
   "salt": "9c9771d6b6e55369cef154932d600f82",
   "check": {
    "iv": "5abf4187859d6db7dc0daac9",
    "c": "cb67ac856cd883a7635ad8bd93d834591d5038960846faaf91e89f61"
   }
  },
  {
   "id": "ch3",
   "label": "終章",
   "title": "第十三時",
   "teaser": "三只錶聚齊的那一夜，三十年前那場火，終於要說出真相。",
   "href": "ch3/",
   "salt": "d8e0961d3e4cfd7dd7406f34415a177f",
   "check": {
    "iv": "123968487b682fc0293da834",
    "c": "66129d79c0c49a85cbc742e9c534bcd3605727b060b61fb82b792e9e"
   }
  }
 ]
};
