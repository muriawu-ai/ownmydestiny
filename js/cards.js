// 39 張紫微斗數牌：14 主星 + 24 雙主星 + 1 空宮
// kind: single | double | empty
window.CARDS = [
  // 十四主星
  { name: "紫微", kind: "single", line: "你習慣把責任扛在肩上，其實你更需要被好好看見。今天，先允許自己不必完美。" },
  { name: "天機", kind: "single", line: "你的腦袋總是停不下來，答案其實早就在你心裡，只差一次安靜的整理。" },
  { name: "太陽", kind: "single", line: "你願意照亮身邊的人，也請記得，替自己留一盞燈。" },
  { name: "武曲", kind: "single", line: "你重承諾、有實力，只是偶爾忘了：休息，也是行動的一部分。" },
  { name: "天同", kind: "single", line: "你要的不是轟轟烈烈，而是一份安心。慢一點，也是在前進。" },
  { name: "廉貞", kind: "single", line: "你心裡有很深的熱度與原則，把它用在選擇上，而不是消耗在糾結裡。" },
  { name: "天府", kind: "single", line: "你比自己想像的更有底氣。穩住節奏，資源自然會靠近。" },
  { name: "太陰", kind: "single", line: "細膩的感受是你的天賦，今天，先聽聽內心真正的聲音。" },
  { name: "貪狼", kind: "single", line: "你對世界有太多好奇，挑一件最想做的事，專注地開始。" },
  { name: "巨門", kind: "single", line: "你看見了別人沒說出口的細節。把疑慮說出來，反而會鬆一口氣。" },
  { name: "天相", kind: "single", line: "你總在照顧周圍的人，今天，也試著開口請人幫你一把。" },
  { name: "天梁", kind: "single", line: "你有一種讓人安心的力量，也別忘了讓自己被照顧。" },
  { name: "七殺", kind: "single", line: "你敢於決斷。現在的課題，是在衝刺之前，先確認方向。" },
  { name: "破軍", kind: "single", line: "舊的格局正在鬆動，這不是失去，而是替新的可能騰出空間。" },
  // 雙主星
  { name: "紫微天府", kind: "double", line: "你同時擁有領導力與穩定力，今天適合做一個長遠的決定。" },
  { name: "紫微破軍", kind: "double", line: "你想突破，又想守住價值，兩者可以並存，一步一步來就好。" },
  { name: "紫微七殺", kind: "double", line: "你的氣場很強。先收一收帆，看清風向，再全力張帆。" },
  { name: "紫微貪狼", kind: "double", line: "魅力與企圖心同在，選對舞台，你的努力才會被看見。" },
  { name: "紫微天相", kind: "double", line: "你重視體面與責任，今天不必事事親力親為，借力也是一種智慧。" },
  { name: "武曲天府", kind: "double", line: "你對安全感很有主見，穩穩地累積，就是你的順風。" },
  { name: "武曲破軍", kind: "double", line: "你想突破現有的做法。先盤點手上的資源，再出手。" },
  { name: "武曲七殺", kind: "double", line: "你行動力十足，也請替身心保留一點餘裕。" },
  { name: "武曲貪狼", kind: "double", line: "企圖心與執行力都在線上，把心力放在最值得的那一件事。" },
  { name: "武曲天相", kind: "double", line: "你把事情處理得很周到，今天，也為自己安排一段被善待的時間。" },
  { name: "廉貞天府", kind: "double", line: "你有原則也有底線，守住它，同時允許自己有一點彈性。" },
  { name: "廉貞破軍", kind: "double", line: "你正在重新定義自己，不必急著給出答案。" },
  { name: "廉貞七殺", kind: "double", line: "你面對關卡很有膽識。先把情緒放下，再做決定。" },
  { name: "廉貞貪狼", kind: "double", line: "你的吸引力很強，真正的課題，是分辨哪些值得你投入。" },
  { name: "廉貞天相", kind: "double", line: "你在意人際間的分寸，今天誠實表達一點，關係反而更輕鬆。" },
  { name: "天機太陰", kind: "double", line: "你思考細膩、感受敏銳，今天適合把想法寫下來，讓它變清楚。" },
  { name: "天機巨門", kind: "double", line: "你想得多、問得深。別急著找標準答案，先釐清真正的疑問。" },
  { name: "天機天梁", kind: "double", line: "你有智慧，也有責任感。今天適合向值得信任的人請教。" },
  { name: "太陽太陰", kind: "double", line: "你同時承載理性與感性，不必二選一，兩者都是你的力量。" },
  { name: "太陽巨門", kind: "double", line: "你的話語有份量，用溫柔的方式說出來，會被更多人聽見。" },
  { name: "太陽天梁", kind: "double", line: "你像一位自然的守護者，今天，也讓自己被守護一下。" },
  { name: "天同太陰", kind: "double", line: "你需要一段安靜的時光，讓心慢慢回到柔軟。" },
  { name: "天同巨門", kind: "double", line: "心裡有些放不下的念頭，說出來，它就不再那麼沉重。" },
  { name: "天同天梁", kind: "double", line: "你有一種溫和的包容力，今天適合放鬆，順著節奏走。" },
  // 空宮
  { name: "空宮", kind: "empty", line: "這張牌留白，邀請你問自己：此刻，我最想要的是什麼？答案由你來寫。" }
];

window.TOPICS = [
  { id: "love",   label: "愛情", lead: "關於感情，這張牌想對你說：" },
  { id: "money",  label: "財運", lead: "關於財運，這張牌想對你說：" },
  { id: "career", label: "事業", lead: "關於事業，這張牌想對你說：" },
  { id: "study",  label: "學業", lead: "關於學業，這張牌想對你說：" },
  { id: "health", label: "健康", lead: "關於身心健康，這張牌想對你說：" },
  { id: "self",   label: "自身", lead: "關於你自己，這張牌想對你說：" }
];
