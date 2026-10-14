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
   "salt": "ddd5afd692163e4331b7fb1714766bb0",
   "check": {
    "iv": "454ef59ca0b85c09da7e2429",
    "c": "c4970d36cde467dddf5bdaf8b3a879fd1a9a3815c1293c2aadac632b"
   }
  },
  {
   "id": "ch2",
   "label": "第二章",
   "title": "鐘樓十三響",
   "teaser": "颱風夜的舊鐘樓，有人倒在機芯旁，午夜的鐘多敲了一下。",
   "href": "ch2/",
   "salt": "d9e570d801e08a41e8a0908d5743f8f2",
   "check": {
    "iv": "f50d6c0eecd6cd07367f8e1e",
    "c": "c72cda009860a07b4bcf8279edf298819b587eea12ae3cd962e47105"
   }
  },
  {
   "id": "ch3",
   "label": "終章",
   "title": "第十三時",
   "teaser": "三只錶聚齊的那一夜，三十年前那場火，終於要說出真相。",
   "href": "ch3/",
   "salt": "6f912f336c5f2bfa357c9726e35877d1",
   "check": {
    "iv": "47add8bd54a9fa8c9cb3c182",
    "c": "abb1aaa1724453500ccb68a55666b837ff6599b97bf5b323f1bfa54a"
   }
  }
 ]
};
