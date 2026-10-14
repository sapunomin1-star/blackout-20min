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
   "salt": "fc470cdafaefec1ab1ce96fb6321221a",
   "check": {
    "iv": "5ed462cc43b94134b27fa03b",
    "c": "23265939b533a8c3c5710bf793c2b0a989d989d37b681e86f1bab18e"
   }
  },
  {
   "id": "ch2",
   "label": "第二章",
   "title": "鐘樓十三響",
   "teaser": "颱風夜的舊鐘樓，有人倒在機芯旁，午夜的鐘多敲了一下。",
   "href": "ch2/",
   "salt": "3e9331d826b6fa155011bb87991c4200",
   "check": {
    "iv": "3619c9405483454c9b5d7d52",
    "c": "84fa823cca405c754243b53016b53e12a1fb7bb91b4cf8cb71b8f0e2"
   }
  },
  {
   "id": "ch3",
   "label": "終章",
   "title": "第十三時",
   "teaser": "三只錶聚齊的那一夜，三十年前那場火，終於要說出真相。",
   "href": "ch3/",
   "salt": "0074d3ad1022f6666474580a85f92dc8",
   "check": {
    "iv": "1eea2f6fb09428948136a7f7",
    "c": "34587d2b0cb0165738b408e8023bc67870c0909994feed9c418d852c"
   }
  }
 ]
};
