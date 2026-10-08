// 會員與抽牌資料存放在 Supabase（見 js/auth.js）
(function () {
  const DAILY_LIMIT = 3;
  const $ = (id) => document.getElementById(id);
  const sb = Auth.sb;

  // 工作坊與 IG 貼文：第 3 步起改由後台管理
  const DEMO_WORKSHOPS = [
    { date: "2026/10/25（日）14:00", title: "每月調頻工作坊", meta: "90 分鐘・線上", price: "$1,000", seats: 4 }
  ];
  const DEMO_IG = [
    { text: "@ownmydestiny", url: "https://www.instagram.com/ownmydestiny/", img: "images/ig-1.jpg" },
    { text: "感謝您的信任與支持", url: "https://www.instagram.com/ownmydestiny/", img: "images/ig-2.webp" },
    { text: "感情問題不止愛不愛", url: "https://www.instagram.com/ownmydestiny/", img: "images/ig-3.jpg" }
  ];

  let user = null, topic = null, usedCount = 0, busy = false;
  const hint = (msg) => { $("hint").textContent = msg || ""; };
  const fmtDate = (iso) => { const d = new Date(iso); return `${d.getMonth() + 1}/${d.getDate()}`; };
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  // ---- 會員狀態 ----
  let loading = false;
  async function loadUser() {
    if (loading) return; loading = true;
    try {
      user = await Auth.currentUser();
      if (user && !user.profile?.privacy_accepted_at) {
        $("consentModal").classList.add("show");
      } else if (user) {
        if (!sessionStorage.getItem("mur_login_logged")) { sessionStorage.setItem("mur_login_logged", "1"); sb.rpc("record_login"); }
        const [{ data: notes }, { count }, { data: used }] = await Promise.all([
          sb.from("notifications").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(2),
          sb.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", user.id).is("read_at", null),
          sb.rpc("draws_today")
        ]);
        user.notes = notes || []; user.unread = count || 0; usedCount = used || 0;
      }
    } catch (e) { console.error(e); }
    loading = false;
    renderUser();
  }
  function renderUser() {
    const ok = user && user.profile?.privacy_accepted_at;
    $("loginBtn").textContent = user ? "登出" : "登入／註冊";
    $("navMember").style.display = ok ? "" : "none";
    $("notices").style.display = ok && user.notes?.length ? "" : "none";
    if (ok && user.notes?.length) {
      $("noticeList").innerHTML = `<span class="lab">( Notice )</span>` + user.notes.map(n =>
        `<div class="notice"><time>${fmtDate(n.created_at)}</time><b>${esc(n.title)}</b><span>${esc(n.body)}</span></div>`).join("") +
        `<a class="more" href="member.html#notices">查看全部通知${user.unread ? `（${user.unread} 則未讀）` : ""} →</a>`;
    }
    renderQuota();
  }
  function renderQuota() {
    $("quota").textContent = user ? `今日剩餘抽牌次數：${Math.max(0, DAILY_LIMIT - usedCount)} / ${DAILY_LIMIT}` : "登入後即可抽牌";
  }
  sb.auth.onAuthStateChange((ev) => { if (ev === "SIGNED_IN" || ev === "SIGNED_OUT") setTimeout(loadUser, 0); });

  // ---- 主題 ----
  $("topics").innerHTML = TOPICS.map(t => `<button class="topic" data-id="${t.id}">${t.label}</button>`).join("");
  $("topics").addEventListener("click", (e) => {
    const b = e.target.closest(".topic"); if (!b) return;
    topic = TOPICS.find(t => t.id === b.dataset.id);
    document.querySelectorAll(".topic").forEach(x => x.classList.toggle("on", x === b));
    hint("");
  });

  // =====================================================
  // 圓弧流動牌陣：移植自 arc-flow-carousel（原生 JS + GSAP）
  // =====================================================
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const CFG = { radiusRatio: 0.85, cardRatio: 0.19, minW: 104, maxW: 230, aspect: 0.64, overlap: -0.05,
                arcOffset: 0.4, smoothing: 5.5, dragSens: 1.2, momentum: 1, auto: 0.12 };
  const DRAG_SMOOTHING = 14, VELOCITY_WINDOW = 90, MAX_FLICK = 9, STAGGER = 0.85, MIN_FOLLOW = 0.6;
  const clamp = (a, b, v) => Math.min(b, Math.max(a, v));

  const arc = $("arc");
  const total = CARDS.length;
  let deck = [], els = [], inners = [], slotOff = [];
  let L = { radius: 900, cw: 200, ch: 300, step: 0.2, cx: 0, cy: 0, maxAngle: 1 };
  let cur = 0, tgt = 0;
  let dragging = false, hovered = false, chosen = -1, reveal = reduceMotion ? 1 : 0, revealStart = 0;
  let pid = null, lastX = 0, samples = [], downCard = null, travelled = 0;

  const shuffleDeck = () => {
    deck = CARDS.map((_, i) => i);
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
  };

  function measure() {
    const w = arc.offsetWidth, h = arc.offsetHeight;
    if (!w) return;
    const cw = clamp(CFG.minW, CFG.maxW, w * CFG.cardRatio);
    const ch = cw / CFG.aspect;
    const radius = Math.max(w * CFG.radiusRatio, cw * 4.2);
    const step = (cw * (1 - clamp(-0.5, 0.85, CFG.overlap))) / radius;
    const reach = Math.min(1, (w / 2 + cw * 1.2) / radius);
    L = { radius, cw, ch, step, cx: w / 2, cy: h * CFG.arcOffset + radius, maxAngle: Math.asin(reach) + 0.12 };
  }

  function build() {
    chosen = -1;
    arc.classList.remove("picked");
    $("result").classList.remove("show");
    arc.innerHTML = deck.map((ci, i) =>
      `<div class="arc-card" data-i="${i}" style="--bp:${(i * 61) % 100}% ${(i * 29) % 100}%" aria-label="第 ${i + 1} 張牌"><div class="inner"><div class="flip">
         <div class="face back"><img src="images/star-white.svg" alt=""></div>
         <div class="face front"><img src="images/star.svg" alt=""><b>${CARDS[ci].name}</b></div>
       </div></div></div>`).join("");
    els = Array.from(arc.querySelectorAll(".arc-card"));
    inners = els.map(e => e.querySelector(".inner"));
    slotOff = new Array(total).fill(cur);
    reveal = reduceMotion ? 1 : 0; revealStart = 0;
    measure();
    draw(1);
  }

  function draw(dt) {
    const { radius, cw, ch, step, cx, cy, maxAngle } = L;
    const span = total * step, half = span / 2;
    const rate = dragging || reduceMotion ? DRAG_SMOOTHING : CFG.smoothing;
    for (let i = 0; i < total; i++) {
      const card = els[i]; if (!card) continue;
      if (reduceMotion) slotOff[i] = cur;
      else {
        let r = (i * step - slotOff[i]) % span;
        if (r < -half) r += span; else if (r >= half) r -= span;
        const df = clamp(0, 1, Math.abs(r) / maxAngle);
        const fr = Math.max(rate * (1 - df * STAGGER), rate * MIN_FOLLOW);
        slotOff[i] += (cur - slotOff[i]) * (1 - Math.exp(-fr * dt));
      }
      let a = (i * step - slotOff[i]) % span;
      if (a < -half) a += span; else if (a >= half) a -= span;
      if (Math.abs(a) > maxAngle) { if (card.style.visibility !== "hidden") card.style.visibility = "hidden"; continue; }
      if (card.style.visibility === "hidden") card.style.visibility = "visible";
      const x = cx + radius * Math.sin(a) - cw / 2;
      const y = cy - radius * Math.cos(a) - ch / 2;
      card.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(${a}rad)`;
      card.style.width = cw + "px"; card.style.height = ch + "px";
      card.style.zIndex = i === chosen ? 99999 : Math.round((a + half) * 1000);
      const inner = inners[i];
      if (reveal < 1) {
        const delay = Math.min(1, Math.abs(a) / maxAngle) * 0.45;
        const p = clamp(0, 1, (reveal - delay) / (1 - delay || 1));
        const e = 1 - Math.pow(1 - p, 3);
        inner.style.opacity = e; inner.style.transform = `translate3d(0, ${(1 - e) * ch * 0.35}px, 0)`;
      } else if (inner.style.opacity !== "1") { inner.style.opacity = "1"; inner.style.transform = "translate3d(0,0,0)"; }
    }
  }

  gsap.ticker.add((_t, delta) => {
    const dt = Math.min(delta, 50) / 1000;
    const rate = dragging || reduceMotion ? DRAG_SMOOTHING : CFG.smoothing;
    const d = tgt - cur;
    cur += d * (1 - Math.exp(-rate * dt));
    if (Math.abs(d) < 0.00002) cur = tgt;
    if (reveal < 1) {
      const now = performance.now();
      if (!revealStart) revealStart = now;
      reveal = Math.min(1, (now - revealStart) / 1100);
    }
    if (CFG.auto && !reduceMotion && !dragging && !hovered && chosen < 0) tgt += CFG.auto * dt;
    draw(dt);
  });
  new ResizeObserver(measure).observe(arc);

  // 拖曳與慣性
  const pushSample = () => {
    const now = performance.now();
    samples.push({ t: now, v: tgt });
    while (samples.length > 2 && now - samples[0].t > VELOCITY_WINDOW) samples.shift();
  };
  arc.addEventListener("pointerdown", (e) => {
    if (chosen >= 0 || (e.button !== 0 && e.pointerType === "mouse")) return;
    dragging = true; pid = e.pointerId; lastX = e.clientX; travelled = 0;
    downCard = e.target.closest(".arc-card");
    samples = [{ t: performance.now(), v: tgt }];
    tgt = cur;
    arc.setPointerCapture(e.pointerId);
  });
  arc.addEventListener("pointermove", (e) => {
    if (!dragging || e.pointerId !== pid) return;
    const dx = e.clientX - lastX; lastX = e.clientX; travelled += Math.abs(dx);
    tgt -= (dx * CFG.dragSens) / L.radius;
    pushSample();
  });
  const endDrag = (e) => {
    if (!dragging || e.pointerId !== pid) return;
    dragging = false; pid = null;
    if (arc.hasPointerCapture(e.pointerId)) arc.releasePointerCapture(e.pointerId);
    if (travelled < 6 && downCard) { tgt = cur; samples = []; pick(+downCard.dataset.i); return; }
    pushSample();
    if (!reduceMotion && samples.length > 1) {
      const f = samples[0], l = samples[samples.length - 1], dt = (l.t - f.t) / 1000;
      if (dt > 0.008) tgt += clamp(-MAX_FLICK, MAX_FLICK, ((l.v - f.v) / dt) / CFG.smoothing) * CFG.momentum;
    }
    samples = [];
  };
  arc.addEventListener("pointerup", endDrag);
  arc.addEventListener("pointercancel", endDrag);
  arc.addEventListener("pointerenter", () => { hovered = true; });
  arc.addEventListener("pointerleave", () => { hovered = false; });
  arc.addEventListener("wheel", (e) => {
    if (chosen >= 0 || Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
    e.preventDefault();
    tgt += (e.deltaX * CFG.dragSens) / L.radius;
  }, { passive: false });
  arc.addEventListener("keydown", (e) => {
    if (chosen >= 0) return;
    if (e.key === "ArrowRight") { e.preventDefault(); tgt += L.step; }
    else if (e.key === "ArrowLeft") { e.preventDefault(); tgt -= L.step; }
  });
  $("prevBtn").addEventListener("click", () => { if (chosen < 0) tgt -= L.step * 3; });
  $("nextBtn").addEventListener("click", () => { if (chosen < 0) tgt += L.step * 3; });

  // ---- 抽牌 ----
  async function pick(i) {
    if (chosen >= 0 || busy) return;
    if (!user || !user.profile?.privacy_accepted_at) { $("loginModal").classList.add("show"); return; }
    if (!topic) { hint("請先在上方選擇想問的方向 ↑"); $("topics").scrollIntoView({ behavior: "smooth", block: "center" }); return; }
    if (usedCount >= DAILY_LIMIT) { hint("今天的 3 次抽牌已經用完了，明天再來吧 ✦"); return; }
    const card = CARDS[deck[i]];

    // 由資料庫確認次數、記錄抽牌（誰、問哪類、抽到哪張、時間）並計算點數
    busy = true;
    const { data, error } = await sb.rpc("draw_card", { p_topic: topic.id, p_card: card.name });
    busy = false;
    if (error || !data?.ok) {
      if (data?.reason === "limit") { usedCount = DAILY_LIMIT; renderQuota(); hint("今天的 3 次抽牌已經用完了，明天再來吧 ✦"); }
      else hint("抽牌時發生問題，請稍後再試。");
      return;
    }
    usedCount = data.used; renderQuota();
    chosen = i;
    arc.classList.add("picked");
    els[i].classList.add("chosen");

    // 轉到正中央，再翻開
    const off0 = i * L.step, span = total * L.step;
    tgt = off0 + span * Math.round((tgt - off0) / span);
    setTimeout(() => els[i].classList.add("flipped"), 900);

    setTimeout(() => {
      $("rTag").textContent = `${topic.label} ・ 今日第 ${usedCount} 次` + (data.gained ? ` ・ +${data.gained} 點` : "");
      $("rName").textContent = card.name;
      $("rLead").textContent = topic.lead;
      $("rLine").textContent = card.line;
      const q = `?topic=${topic.id}&card=${encodeURIComponent(card.name)}`;
      $("rBook").href = "booking.html" + q;
      $("rChat").href = "booking.html" + q + "&chat=1";
      $("result").classList.add("show");
      $("result").scrollIntoView({ behavior: "smooth", block: "center" });
    }, 2000);
  }

  function reshuffle() { shuffleDeck(); build(); }
  $("shuffleBtn").addEventListener("click", reshuffle);
  $("rAgain").addEventListener("click", () => { reshuffle(); arc.scrollIntoView({ behavior: "smooth", block: "center" }); });

  // ---- 登入 ----
  const msg = (id, t) => { $(id).textContent = t || ""; };
  $("loginBtn").addEventListener("click", async () => {
    if (user) { sessionStorage.removeItem("mur_login_logged"); await sb.auth.signOut(); return; }
    $("loginModal").classList.add("show");
  });
  $("closeModal").addEventListener("click", () => $("loginModal").classList.remove("show"));
  // Email + 密碼（註冊／登入）
  let mode = "in";
  const setMode = (m) => {
    mode = m;
    $("tabIn").classList.toggle("on", m === "in"); $("tabUp").classList.toggle("on", m === "up");
    $("authTitle").textContent = m === "in" ? "登入" : "註冊新帳號";
    $("authGo").textContent = m === "in" ? "登入" : "建立帳號";
    $("pwInput").autocomplete = m === "in" ? "current-password" : "new-password";
    msg("loginMsg", "");
  };
  $("tabIn").addEventListener("click", () => setMode("in"));
  $("tabUp").addEventListener("click", () => setMode("up"));
  const authErr = (e) => {
    const m = (e.message || "").toLowerCase();
    if (m.includes("invalid login")) return "Email 或密碼不正確。";
    if (m.includes("already")) return "這個 Email 已經註冊過了，請改用「登入」。";
    if (m.includes("password")) return "密碼至少需要 8 個字。";
    if (e.status === 429 || m.includes("rate")) return "操作太頻繁，請稍後再試。";
    return "發生問題，請稍後再試。";
  };
  async function submitAuth() {
    const email = $("emailInput").value.trim(), password = $("pwInput").value;
    if (!/^\S+@\S+\.\S+$/.test(email)) { msg("loginMsg", "請輸入正確的 Email"); return; }
    if (password.length < 8) { msg("loginMsg", "密碼至少需要 8 個字"); return; }
    $("authGo").disabled = true; msg("loginMsg", "處理中…");
    const res = mode === "in"
      ? await sb.auth.signInWithPassword({ email, password })
      : await sb.auth.signUp({ email, password, options: { emailRedirectTo: location.origin + location.pathname } });
    $("authGo").disabled = false;
    if (res.error) { msg("loginMsg", authErr(res.error)); return; }
    if (mode === "up" && !res.data.session) { msg("loginMsg", "已寄出驗證信，請到信箱點連結完成註冊，再回來登入。"); return; }
    $("loginModal").classList.remove("show"); msg("loginMsg", ""); $("pwInput").value = "";
  }
  $("authGo").addEventListener("click", submitAuth);
  $("pwInput").addEventListener("keydown", (e) => { if (e.key === "Enter") submitAuth(); });
  // 備用：Email 登入連結
  $("linkLogin").addEventListener("click", async () => {
    const email = $("emailInput").value.trim();
    if (!/^\S+@\S+\.\S+$/.test(email)) { msg("loginMsg", "請先輸入 Email"); return; }
    const { error } = await sb.auth.signInWithOtp({ email, options: { shouldCreateUser: false, emailRedirectTo: location.origin + location.pathname } });
    msg("loginMsg", error ? (error.status === 429 ? "寄信太頻繁，請稍後再試，或改用密碼登入。" : "寄送失敗：這個 Email 可能還沒註冊。") : "登入連結已寄出，請到信箱點連結。");
  });

  // ---- 首次同意 ----
  $("consentOk").addEventListener("click", async () => {
    if (!$("agreePrivacy").checked) { msg("consentMsg", "請先勾選同意隱私權聲明"); return; }
    const { error } = await sb.rpc("accept_consent", { p_marketing: $("agreeMarketing").checked });
    if (error) { msg("consentMsg", "儲存失敗，請稍後再試。"); return; }
    $("consentModal").classList.remove("show");
    await loadUser();
  });
  $("consentCancel").addEventListener("click", async () => { $("consentModal").classList.remove("show"); await sb.auth.signOut(); });

  // ---- 工作坊／IG ----
  $("wsList").innerHTML = DEMO_WORKSHOPS.length ? DEMO_WORKSHOPS.map(w => `
    <article class="ws rv">
      <span class="date">${w.date}</span>
      <h3>${w.title}</h3>
      <span class="meta">${w.meta}・剩餘 ${w.seats} 席</span>
      <div class="foot"><strong>${w.price}</strong><a class="btn primary" href="booking.html?service=workshop">我要報名</a></div>
    </article>`).join("") : `<p class="empty-note">目前沒有開放報名的場次，敬請期待。</p>`;
  $("igList").innerHTML = DEMO_IG.map(p =>
    `<a class="ig-item rv" href="${p.url}" target="_blank" rel="noopener">${p.img ? `<img src="${p.img}" alt="${p.text}" loading="lazy">` : ""}<span>${p.text}</span></a>`).join("");

  // ---- 啟動 ----
  shuffleDeck();
  build();
  loadUser();
  if (window.observeReveal) { observeReveal($("wsList")); observeReveal($("igList")); }
})();
