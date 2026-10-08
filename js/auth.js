// Supabase 連線（publishable key 可安全放在前端；資料安全由資料庫的 RLS 規則保護）
(function () {
  const SUPABASE_URL = "https://olknbjixskabjoxihhez.supabase.co";
  const SUPABASE_KEY = "sb_publishable_f30XVBqI83sMvBEGlTmJOA_bvj7Dv8w";
  const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
  window.Auth = {
    sb,
    async currentUser() {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) return null;
      const { data: profile } = await sb.from("profiles").select("*").eq("id", session.user.id).single();
      return { id: session.user.id, email: session.user.email, profile };
    }
  };
})();
