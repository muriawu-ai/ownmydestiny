(function () {
  const $ = (id) => document.getElementById(id);
  const sb = Auth.sb;
  const qs = new URLSearchParams(location.search);
  const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const money = (n) => "$" + Number(n).toLocaleString("en-US");
  const fmt = (iso) => new Date(iso).toLocaleString("zh-TW", { timeZone: "Asia/Taipei", month: "numeric", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false });
  const MODES = { online: "線上", offline: "面對面" };
  const STATUS = { pending_payment: "待付款", payment_reported: "已回報付款，等待確認", confirmed: "預約成立", completed: "已完成", cancelled: "已取消" };
  const errText = { tier: "這項服務僅限已完成解盤的舊客戶。", full: "這個時段剛剛被預約滿了，請選別的時段。", slot: "這個時段已不開放。", consent: "請先到首頁完成註冊同意。", people: "人數不符合這項服務的規定。", mode: "不支援這個方式。" };

  let user = null, services = [], current = null, slotId = null;

  async function init() {
    user = await Auth.currentUser();
    if (!user || !user.profile?.privacy_accepted_at) {
      $("gate").innerHTML = `請先到<a href="index.html" style="color:var(--accent)">首頁</a>登入或完成註冊，再回來預約。`;
      return;
    }
    $("gate").style.display = "none";
    if (qs.get("card")) $("fromCard").textContent = `你抽到的牌：${qs.get("card")}，帶著這個問題來聊聊吧`;

    if (qs.get("id")) { await showPay(qs.get("id")); return; }

    const { data } = await sb.from("services").select("*").order("sort");
    services = data || [];
    $("stepService").style.display = "";
    $("serviceList").innerHTML = services.map(s => {
      const locked = s.requires_tier === "read" && !["read", "regular"].includes(user.profile.tier);
      return `<article class="ws${locked ? " locked" : ""}">
        <span class="date">${esc(s.duration_label)}・${s.modes.map(m => MODES[m]).join("／")}${s.max_people > 1 ? `・${s.min_people}–${s.max_people} 人` : ""}</span>
        <h3>${esc(s.name)}</h3><span class="meta">${esc(s.description)}</span>
        <div class="foot"><strong>${money(s.price)}</strong>
        ${locked ? `<span class="meta">僅限已解盤舊客戶</span>` : `<button class="btn primary" data-id="${s.id}">選擇</button>`}</div></article>`;
    }).join("");
    $("serviceList").addEventListener("click", (e) => { const b = e.target.closest("button[data-id]"); if (b) choose(b.dataset.id); });
    const pre = qs.get("service");
    if (pre) { const s = services.find(x => x.key === pre); if (s) choose(s.id); }
  }

  async function choose(id) {
    current = services.find(s => s.id === id); slotId = null;
    $("stepForm").style.display = ""; $("stepPay").style.display = "none";
    $("formTitle").textContent = current.name;
    $("fPeople").innerHTML = Array.from({ length: current.max_people - current.min_people + 1 }, (_, i) => `<option>${current.min_people + i}</option>`).join("");
    $("peopleBox").style.display = current.max_people > 1 ? "" : "none";
    $("fMode").innerHTML = current.modes.map(m => `<option value="${m}">${MODES[m]}</option>`).join("");
    $("modeBox").style.display = current.modes.length > 1 ? "" : "none";
    $("fRegion").value = user.profile.region || "TW";
    if (!$("fNote").value && qs.get("card")) {
      const t = (TOPICS.find(x => x.id === qs.get("topic")) || {}).label;
      $("fNote").value = `我抽到「${qs.get("card")}」${t ? `（${t}）` : ""}，想跟你聊聊。`;
    }
    $("priceLine").textContent = "費用：" + money(current.price);
    $("slotList").innerHTML = "載入時段…";
    const { data } = await sb.rpc("open_slots", { p_service: id });
    $("slotList").innerHTML = (data || []).map(s =>
      `<label class="slot${s.remaining ? "" : " full"}"><input type="radio" name="slot" value="${s.id}" ${s.remaining ? "" : "disabled"}>
       <span>${fmt(s.starts_at)}${s.note ? `・${esc(s.note)}` : ""}</span><em>${s.remaining ? `剩 ${s.remaining} 席` : "已額滿"}</em></label>`).join("")
      || `<p class="empty-note">目前沒有開放的時段，請稍後再來看看，或先到首頁用 IG 私訊我。</p>`;
    $("stepForm").scrollIntoView({ behavior: "smooth", block: "start" });
  }
  $("slotList").addEventListener("change", (e) => { if (e.target.name === "slot") slotId = e.target.value; });

  $("submitBooking").addEventListener("click", async () => {
    if (!slotId) { $("formMsg").textContent = "請先選擇一個時段"; return; }
    $("submitBooking").disabled = true; $("formMsg").textContent = "送出中…";
    const { data, error } = await sb.rpc("create_booking", {
      p_service: current.id, p_slot: slotId, p_people: +$("fPeople").value || 1, p_mode: $("fMode").value,
      p_region: $("fRegion").value, p_note: $("fNote").value.trim(), p_topic: qs.get("topic"), p_card: qs.get("card")
    });
    $("submitBooking").disabled = false;
    if (error || !data?.ok) { $("formMsg").textContent = errText[data?.reason] || "送出失敗，請稍後再試。"; if (data?.reason === "full") choose(current.id); return; }
    history.replaceState(null, "", "booking.html?id=" + data.id);
    $("stepService").style.display = "none"; $("stepForm").style.display = "none";
    await showPay(data.id);
  });

  async function showPay(id) {
    const { data: b } = await sb.from("bookings").select("*, services(name), slots(starts_at)").eq("id", id).eq("user_id", user.id).single();
    if (!b) { $("gate").style.display = ""; $("gate").textContent = "找不到這筆預約。"; return; }
    const { data: ps } = await sb.from("payment_settings").select("*").eq("region", b.region).single();
    $("stepPay").style.display = "";
    const open = ["pending_payment", "payment_reported"].includes(b.status);
    $("payInfo").innerHTML = `
      <div class="mrow"><span>服務</span><span>${esc(b.services.name)}</span></div>
      <div class="mrow"><span>時間</span><span>${b.slots ? fmt(b.slots.starts_at) : "—"}（${MODES[b.mode]}${b.people > 1 ? `・${b.people} 人` : ""}）</span></div>
      <div class="mrow"><span>金額</span><span><b>${money(b.amount)}</b></span></div>
      <div class="mrow"><span>付款編號</span><span><b class="ref">${esc(b.pay_ref)}</b></span></div>
      <div class="mrow"><span>狀態</span><span>${STATUS[b.status]}</span></div>
      ${open ? `<div class="paybox"><b>${b.region === "TW" ? "台灣付款方式" : "香港付款方式"}</b><pre>${esc(ps?.instructions || "")}</pre>
        <p class="meta">轉帳時請在備註填寫付款編號 <b>${esc(b.pay_ref)}</b>。</p></div>
        <label class="lbl">付款後，請回報（付款方式與帳號末五碼／備註）</label>
        <input class="field" id="rMethod" placeholder="付款方式，例如：LINE Pay／銀行轉帳／FPS／PayMe" maxlength="40" value="${esc(b.pay_method || "")}">
        <input class="field" id="rNote" placeholder="帳號末五碼或備註" maxlength="200" value="${esc(b.pay_note || "")}">
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:6px"><button class="btn primary" id="reportBtn">我已付款，回報</button><button class="btn" id="cancelBtn">取消預約</button></div>
        <p class="msg" id="payMsg" aria-live="polite"></p>` : ""}
      <p class="meta" style="margin-top:14px">我確認收款後，預約才會正式成立，並會在會員中心通知你。</p>`;
    if (open) {
      $("reportBtn").addEventListener("click", async () => {
        const m = $("rMethod").value.trim(); if (!m) { $("payMsg").textContent = "請填寫付款方式"; return; }
        const { data: r } = await sb.rpc("report_payment", { p_booking: id, p_method: m, p_note: $("rNote").value.trim() });
        if (r?.ok) showPay(id); else $("payMsg").textContent = "回報失敗，請稍後再試。";
      });
      $("cancelBtn").addEventListener("click", async () => {
        if (!confirm("確定要取消這筆預約嗎？")) return;
        const { data: r } = await sb.rpc("cancel_booking", { p_booking: id });
        if (r?.ok) showPay(id); else $("payMsg").textContent = "取消失敗。";
      });
    }
  }
  init();
})();
