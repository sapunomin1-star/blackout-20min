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
   "salt": "92c44dba2eb10a5c2ddb4f0073d68c3d",
   "check": {
    "iv": "306c28527e52c5d356e41ae9",
    "c": "663d9323ef4d967a559a02de0deae24df488807ef8902631821f637b"
   }
  },
  {
   "id": "ch2",
   "label": "第二章",
   "title": "鐘樓十三響",
   "teaser": "颱風夜的舊鐘樓，有人倒在機芯旁，午夜的鐘多敲了一下。",
   "href": "ch2/",
   "salt": "55621564b89584eb9e8f34f54248fb0e",
   "check": {
    "iv": "fbbbdb9a0a326ac181a20fe1",
    "c": "20b0074ab73d65cd5a91cb150925226d34ed5f735e7a77ff6d34a943"
   }
  },
  {
   "id": "ch3",
   "label": "終章",
   "title": "第十三時",
   "teaser": "三只錶聚齊的那一夜，三十年前那場火，終於要說出真相。",
   "href": "ch3/",
   "salt": "88aae2dd629819aad7b7af096ce5c21f",
   "check": {
    "iv": "82191d76587defdaff572059",
    "c": "ee22b8dbbc48b958038a90c5794e02b776af949ed4a4950837d8f97e"
   }
  }
 ]
};
