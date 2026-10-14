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
   "salt": "3e98c147db0d73ccf63cfbcb8f5c96c9",
   "check": {
    "iv": "b56c96e51d04cbd3bf691e8d",
    "c": "68a480b869600389b0206b8b217344e44b2df423974b782eb253731c"
   }
  },
  {
   "id": "ch2",
   "label": "第二章",
   "title": "鐘樓十三響",
   "teaser": "颱風夜的舊鐘樓，有人倒在機芯旁，午夜的鐘多敲了一下。",
   "href": "ch2/",
   "salt": "a675289769ff622952ddb832af7fd460",
   "check": {
    "iv": "af3fb0132e135da16deda4eb",
    "c": "d295a7be3ba4ff2b3dbdf2da200a9e4cd9e95f573053167902dca9c9"
   }
  },
  {
   "id": "ch3",
   "label": "終章",
   "title": "第十三時",
   "teaser": "三只錶聚齊的那一夜，三十年前那場火，終於要說出真相。",
   "href": "ch3/",
   "salt": "49d5121fc8fc6d30d9cba0ea6a970282",
   "check": {
    "iv": "e6f25d70eccf72ed45fb5464",
    "c": "88ca8153f5ba41cbd76cc1b07a800ac76dd6e9b9f20a0055fa329ffd"
   }
  }
 ]
};
