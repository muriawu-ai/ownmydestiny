(function () {
  const $ = (id) => document.getElementById(id);
  const sb = Auth.sb;
  const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const TIERS = { new: "🌱 新會員", read: "🌙 已解盤會員", regular: "⭐ 常客" };
  const topicLabel = (id) => (TOPICS.find(t => t.id === id) || {}).label || id;
  const when = (iso) => new Date(iso).toLocaleString("zh-TW", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
  const row = (a, b) => `<div class="mrow"><span>${a}</span><span>${b}</span></div>`;

  async function load() {
    const user = await Auth.currentUser();
    if (!user || !user.profile?.privacy_accepted_at) {
      $("gate").innerHTML = `請先到<a href="index.html" style="color:var(--accent)">首頁</a>登入或完成註冊。`;
      return;
    }
    $("gate").style.display = "none"; $("panel").style.display = ""; $("logoutBtn").style.display = "";
    const p = user.profile;
    $("who").textContent = (p.display_name || user.email) + "・" + (user.email || "");
    $("tier").textContent = TIERS[p.tier] || p.tier;
    $("points").textContent = p.points;
    $("fName").value = p.display_name || "";
    $("fIg").value = p.ig_handle || "";
    $("fRegion").value = p.region || "";
    $("fMarketing").checked = !!p.marketing_opt_in;

    if (p.role === "admin") $("adminLink").style.display = "";
    const ST = { pending_payment: "待付款", payment_reported: "已回報付款・等待確認", confirmed: "預約成立", completed: "已完成", cancelled: "已取消" };
    sb.from("bookings").select("*, services(name), slots(starts_at)").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20).then(({ data }) => {
      $("bkList").innerHTML = (data || []).map(b => row(`<a href="booking.html?id=${b.id}" style="color:var(--accent)">${esc(b.services.name)}</a><br><time>${b.slots ? new Date(b.slots.starts_at).toLocaleString("zh-TW", { timeZone: "Asia/Taipei", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }) : ""}</time>`, ST[b.status])).join("") || `<p class="empty-note">還沒有預約。</p>`;
    });
    const [notes, ledger, draws, used] = await Promise.all([
      sb.from("notifications").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(30),
      sb.from("points_ledger").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20),
      sb.from("draws").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20),
      sb.rpc("draws_today")
    ]);
    $("used").textContent = (used.data ?? 0) + " / 3";

    const unread = (notes.data || []).filter(n => !n.read_at).length;
    $("unreadTag").textContent = unread ? `（${unread} 則未讀）` : "";
    $("noteList").innerHTML = (notes.data || []).map(n =>
      `<div class="note${n.read_at ? "" : " unread"}"><div><b>${esc(n.title)}</b><time>${when(n.created_at)}</time></div><p>${esc(n.body)}</p></div>`).join("") || `<p class="empty-note">目前沒有通知。</p>`;
    $("ledger").innerHTML = (ledger.data || []).map(l => row(esc(l.reason) + `<br><time>${when(l.created_at)}</time>`, (l.delta > 0 ? "+" : "") + l.delta)).join("") || `<p class="empty-note">還沒有紀錄。</p>`;
    $("history").innerHTML = (draws.data || []).map(d => row(esc(d.card_name) + `<br><time>${when(d.created_at)}</time>`, esc(topicLabel(d.topic)))).join("") || `<p class="empty-note">還沒有抽過牌。</p>`;
  }

  $("readAll").addEventListener("click", async () => {
    const u = await Auth.currentUser();
    await sb.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", u.id).is("read_at", null);
    load();
  });
  $("saveBtn").addEventListener("click", async () => {
    const user = await Auth.currentUser(); if (!user) return;
    const ig = $("fIg").value.trim().replace(/^@/, "");
    const { error } = await sb.from("profiles").update({
      display_name: $("fName").value.trim() || null, ig_handle: ig || null, region: $("fRegion").value || null
    }).eq("id", user.id);
    const { error: e2 } = await sb.rpc("accept_consent", { p_marketing: $("fMarketing").checked, p_region: $("fRegion").value || null });
    $("saveMsg").textContent = error || e2 ? "儲存失敗，請稍後再試。" : "已儲存 ✦";
    if (!error && ig) sb.from("activity_log").insert({ user_id: user.id, type: "ig_linked", meta: { ig } });
  });
  $("logoutBtn").addEventListener("click", async () => { sessionStorage.removeItem("mur_login_logged"); await sb.auth.signOut(); location.href = "index.html"; });

  $("pwSave").addEventListener("click", async () => {
    const pw = $("newPw").value;
    if (pw.length < 8) { $("pwMsg").textContent = "密碼至少需要 8 個字"; return; }
    const { error } = await sb.auth.updateUser({ password: pw });
    $("pwMsg").textContent = error ? "設定失敗，請稍後再試。" : "密碼已設定 ✦ 之後可以用 Email＋密碼登入。";
    if (!error) $("newPw").value = "";
  });

  load();
})();
