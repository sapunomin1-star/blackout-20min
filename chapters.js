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
   "salt": "1c0f529fa336a0cd7b54e0f4a5bd8039",
   "check": {
    "iv": "3de6bcba701da075542d8f80",
    "c": "b268368d7a20dcc18286fb79d53f933fbf15a2c7457440b3e431b290"
   }
  },
  {
   "id": "ch2",
   "label": "第二章",
   "title": "鐘樓十三響",
   "teaser": "颱風夜的舊鐘樓，有人倒在機芯旁，午夜的鐘多敲了一下。",
   "href": "ch2/",
   "salt": "165238c1e64808a9ada4088386a04f6f",
   "check": {
    "iv": "486b31f644a62b4134df9e35",
    "c": "17ef2f7cfbd2aa34734c8d8dc2a02e582a3e1bf9f294b16eae76e237"
   }
  },
  {
   "id": "ch3",
   "label": "終章",
   "title": "第十三時",
   "teaser": "三只錶聚齊的那一夜，三十年前那場火，終於要說出真相。",
   "href": "ch3/",
   "salt": "da5d49f94ba8e651205438886566f4ef",
   "check": {
    "iv": "9334624321ecca379fc29d81",
    "c": "b8599bfc44b69e8ade78b5ae4f4253c1150f9cfe3e06275e626b3b57"
   }
  }
 ]
};
