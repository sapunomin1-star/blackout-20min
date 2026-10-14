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
   "salt": "6ede99cad49ca5cee5c7b052f83b0075",
   "check": {
    "iv": "6e84270669a977f18cbd17c2",
    "c": "82463a65c526347cb41a17b1d5ccffe6d5efdf3ca01687fdbc599020"
   }
  },
  {
   "id": "ch2",
   "label": "第二章",
   "title": "鐘樓十三響",
   "teaser": "颱風夜的舊鐘樓，有人倒在機芯旁，午夜的鐘多敲了一下。",
   "href": "ch2/",
   "salt": "791a811947a999897c159f028d207e2f",
   "check": {
    "iv": "82e171d5501a2d4f9ff06a6d",
    "c": "761df75bb566302eab5bc967d999fd6e4ff26d71f211e7c930938a23"
   }
  },
  {
   "id": "ch3",
   "label": "終章",
   "title": "第十三時",
   "teaser": "三只錶聚齊的那一夜，三十年前那場火，終於要說出真相。",
   "href": "ch3/",
   "salt": "792ab33c625c1b41c37912216bb3a852",
   "check": {
    "iv": "315d37a3a89a83b0ec98d485",
    "c": "196326a1554778d6df34f55445914060d3ccd19db9a8d226385bd631"
   }
  }
 ]
};
