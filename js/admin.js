(function () {
  const $ = (id) => document.getElementById(id);
  const sb = Auth.sb;
  const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const money = (n) => "$" + Number(n).toLocaleString("en-US");
  const fmt = (iso) => iso ? new Date(iso).toLocaleString("zh-TW", { timeZone: "Asia/Taipei", month: "numeric", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false }) : "—";
  const MODES = { online: "線上", offline: "面對面" };
  const STATUS = { pending_payment: "待付款", payment_reported: "已回報付款・待確認", confirmed: "預約成立", completed: "已完成", cancelled: "已取消" };
  const TIERS = { new: "🌱", read: "🌙", regular: "⭐" };
  let services = [];

  async function init() {
    const user = await Auth.currentUser();
    if (!user || user.profile?.role !== "admin") { $("gate").innerHTML = `這個頁面只有管理員可以使用。請先到<a href="index.html" style="color:var(--accent)">首頁</a>用管理員帳號登入。`; return; }
    $("gate").style.display = "none"; $("app").style.display = "";
    const { data } = await sb.from("services").select("*").order("sort");
    services = data || [];
    $("sService").innerHTML = services.map(s => `<option value="${s.id}" data-key="${s.key}">${esc(s.name)}</option>`).join("");
    renderServices(); loadBookings(); loadSlots(); loadPay();
  }

  $("tabs").addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    document.querySelectorAll("#tabs button").forEach(x => x.classList.toggle("on", x === b));
    document.querySelectorAll(".tab").forEach(t => t.style.display = t.id === "t-" + b.dataset.t ? "" : "none");
  });

  // ---------- 預約處理 ----------
  async function loadBookings() {
    const f = $("bFilter").value;
    let q = sb.from("bookings").select("*, services(name), slots(starts_at)").order("created_at", { ascending: false }).limit(100);
    if (f === "open") q = q.in("status", ["pending_payment", "payment_reported"]); else if (f !== "all") q = q.eq("status", f);
    const { data } = await q;
    const ids = [...new Set((data || []).map(b => b.user_id))];
    const { data: ps } = ids.length ? await sb.from("profiles").select("id,display_name,email,ig_handle,tier").in("id", ids) : { data: [] };
    const pm = Object.fromEntries((ps || []).map(p => [p.id, p]));
    $("bList").innerHTML = (data || []).map(b => {
      const p = pm[b.user_id] || {};
      const acts = [];
      if (["pending_payment", "payment_reported"].includes(b.status)) acts.push(`<button class="btn primary" data-a="confirm" data-id="${b.id}">確認收款</button>`);
      if (b.status === "confirmed") acts.push(`<button class="btn primary" data-a="complete" data-id="${b.id}">標示已完成</button>`);
      if (!["completed", "cancelled"].includes(b.status)) acts.push(`<button class="btn" data-a="cancel" data-id="${b.id}">取消</button>`);
      return `<div class="mcard bk ${b.status}">
        <div class="mrow"><span><b>${esc(b.services.name)}</b>　${fmt(b.slots?.starts_at)}（${MODES[b.mode]}${b.people > 1 ? `・${b.people} 人` : ""}）</span><span>${STATUS[b.status]}</span></div>
        <div class="mrow"><span>${TIERS[p.tier] || ""} ${esc(p.display_name || "")}　${esc(p.email || "")}${p.ig_handle ? `　IG: @${esc(p.ig_handle)}` : ""}</span><span><b>${money(b.amount)}</b> ${b.currency}</span></div>
        <div class="mrow"><span>付款編號 <b class="ref">${esc(b.pay_ref)}</b>${b.pay_method ? `　${esc(b.pay_method)}` : ""}${b.pay_note ? `・${esc(b.pay_note)}` : ""}</span><span class="meta">${fmt(b.created_at)}</span></div>
        ${b.note ? `<p class="meta">客人留言：${esc(b.note)}</p>` : ""}${b.card_name ? `<p class="meta">抽到的牌：${esc(b.card_name)}</p>` : ""}${b.admin_note ? `<p class="meta">備註：${esc(b.admin_note)}</p>` : ""}
        <div class="acts">${acts.join("")}</div></div>`;
    }).join("") || `<p class="empty-note">沒有符合的預約。</p>`;
  }
  $("bFilter").addEventListener("change", loadBookings);
  $("bReload").addEventListener("click", loadBookings);
  $("bList").addEventListener("click", async (e) => {
    const b = e.target.closest("button[data-a]"); if (!b) return;
    const id = b.dataset.id, a = b.dataset.a;
    let res;
    if (a === "confirm") { if (!confirm("確認已收到款項？客人會收到預約成立通知，並獲得消費點數。")) return; res = await sb.rpc("admin_confirm_payment", { p_booking: id }); }
    if (a === "complete") { if (!confirm("標示這筆諮詢已完成？系統會自動更新會員等級並邀請回饋。")) return; res = await sb.rpc("admin_complete_booking", { p_booking: id }); }
    if (a === "cancel") { const r = prompt("取消原因（會通知客人，可留空）："); if (r === null) return; res = await sb.rpc("admin_cancel_booking", { p_booking: id, p_reason: r }); }
    if (res?.error || !res?.data?.ok) alert("操作失敗，狀態可能已變更，請重新整理。");
    loadBookings();
  });

  // ---------- 時段 ----------
  $("sService").addEventListener("change", () => { $("sCap").value = $("sService").selectedOptions[0].dataset.key === "workshop" ? 8 : 1; });
  $("sAdd").addEventListener("click", async () => {
    if (!$("sStart").value) { $("sMsg").textContent = "請選擇開始時間"; return; }
    const { error } = await sb.from("slots").insert({
      service_id: $("sService").value, starts_at: new Date($("sStart").value).toISOString(),
      capacity: +$("sCap").value || 1, note: $("sNote").value.trim() || null
    });
    $("sMsg").textContent = error ? "新增失敗" : "已新增 ✦"; if (!error) { $("sNote").value = ""; loadSlots(); }
  });
  async function loadSlots() {
    const { data } = await sb.from("slots").select("*, services(name)").gte("starts_at", new Date(Date.now() - 864e5).toISOString()).order("starts_at").limit(100);
    const ids = (data || []).map(s => s.id);
    const { data: bk } = ids.length ? await sb.from("bookings").select("slot_id,status").in("slot_id", ids).neq("status", "cancelled") : { data: [] };
    const cnt = {}; (bk || []).forEach(b => cnt[b.slot_id] = (cnt[b.slot_id] || 0) + 1);
    $("sList").innerHTML = (data || []).map(s => `<div class="mrow"><span>${fmt(s.starts_at)}　${esc(s.services.name)}${s.note ? `・${esc(s.note)}` : ""}</span>
      <span>${cnt[s.id] || 0} / ${s.capacity}　${s.status === "open" ? "開放中" : "已關閉"}　<button class="btn" data-sid="${s.id}" data-st="${s.status}">${s.status === "open" ? "關閉" : "重新開放"}</button></span></div>`).join("") || `<p class="empty-note">還沒有時段。</p>`;
  }
  $("sList").addEventListener("click", async (e) => {
    const b = e.target.closest("button[data-sid]"); if (!b) return;
    await sb.from("slots").update({ status: b.dataset.st === "open" ? "closed" : "open" }).eq("id", b.dataset.sid); loadSlots();
  });

  // ---------- 服務 ----------
  function renderServices() {
    $("svList").innerHTML = services.map(s => `<div class="mcard" data-sv="${s.id}"><h3>${esc(s.name)}</h3>
      <label class="lbl">名稱</label><input class="field" data-f="name" value="${esc(s.name)}">
      <label class="lbl">說明</label><textarea class="field" data-f="description" rows="2">${esc(s.description)}</textarea>
      <label class="lbl">價格（台灣新台幣／香港港幣同一個數字）</label><input class="field" data-f="price" type="number" min="0" value="${s.price}">
      <label class="chk"><input type="checkbox" data-f="active" ${s.active ? "checked" : ""}> 開放預約</label>
      <button class="btn primary" data-save="${s.id}">儲存</button> <span class="msg"></span></div>`).join("");
  }
  $("svList").addEventListener("click", async (e) => {
    const b = e.target.closest("button[data-save]"); if (!b) return;
    const box = b.closest("[data-sv]"), g = (f) => box.querySelector(`[data-f=${f}]`);
    const { error } = await sb.from("services").update({ name: g("name").value.trim(), description: g("description").value.trim(), price: +g("price").value || 0, active: g("active").checked }).eq("id", b.dataset.save);
    box.querySelector(".msg").textContent = error ? "儲存失敗" : "已儲存 ✦";
  });

  // ---------- 收款 ----------
  async function loadPay() {
    const { data } = await sb.from("payment_settings").select("*");
    (data || []).forEach(r => { $("pay" + r.region).value = r.instructions; });
  }
  $("paySave").addEventListener("click", async () => {
    const a = await sb.from("payment_settings").update({ instructions: $("payTW").value, updated_at: new Date().toISOString() }).eq("region", "TW");
    const b = await sb.from("payment_settings").update({ instructions: $("payHK").value, updated_at: new Date().toISOString() }).eq("region", "HK");
    $("payMsg").textContent = a.error || b.error ? "儲存失敗" : "已儲存 ✦";
  });

  // ---------- 通知 ----------
  $("nTarget").addEventListener("change", () => { $("nEmail").style.display = $("nTarget").value === "email" ? "" : "none"; });
  $("nSend").addEventListener("click", async () => {
    let target = $("nTarget").value;
    if (target === "email") {
      const { data } = await sb.from("profiles").select("id").eq("email", $("nEmail").value.trim()).maybeSingle();
      if (!data) { $("nMsg").textContent = "找不到這位會員"; return; }
      target = "user:" + data.id;
    }
    if (!confirm("確定要發送這則通知嗎？")) return;
    const { data, error } = await sb.rpc("admin_send_notification", { p_target: target, p_title: $("nTitle").value, p_body: $("nBody").value });
    $("nMsg").textContent = error ? "發送失敗（請確認標題與內容）" : `已發送給 ${data} 位會員 ✦`;
    if (!error) { $("nTitle").value = ""; $("nBody").value = ""; }
  });

  init();
})();
