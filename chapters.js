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
   "salt": "c1ff348d854949ff4e2a0b98a4f09c00",
   "check": {
    "iv": "078773330551271e81449e1b",
    "c": "c9084f0a8e79f77bba14a5c4dca17bf0770fb2aef579aafba954e36a"
   }
  },
  {
   "id": "ch2",
   "label": "第二章",
   "title": "鐘樓十三響",
   "teaser": "颱風夜的舊鐘樓，有人倒在機芯旁，午夜的鐘多敲了一下。",
   "href": "ch2/",
   "salt": "7b5e17c56d029ebc5220d077aaeef1ee",
   "check": {
    "iv": "ea606629d33c521056a2f922",
    "c": "9bca8e3602c45c1af21d3e2cebae22b549f60980ef5693e6863193a4"
   }
  },
  {
   "id": "ch3",
   "label": "終章",
   "title": "第十三時",
   "teaser": "三只錶聚齊的那一夜，三十年前那場火，終於要說出真相。",
   "href": "ch3/",
   "salt": "cae12bc8cea3ee2ec8cb44a42451e844",
   "check": {
    "iv": "57c541263510baadff44632b",
    "c": "7d0696ed76fff62b488a3b704a86d9acac0711f0048922d3e0da5e96"
   }
  }
 ]
};
