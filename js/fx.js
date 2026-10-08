// 視覺動畫：載入畫面、捲動淡入、標題亂碼解碼、首屏視差
(function () {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // 載入畫面
  const loader = document.getElementById("loader");
  const pct = document.getElementById("loaderPct");
  if (loader) {
    let p = 0;
    const t = setInterval(() => {
      p = Math.min(100, p + 4 + Math.random() * 9);
      pct.textContent = Math.floor(p) + "%";
      if (p >= 100) {
        clearInterval(t);
        setTimeout(() => {
          loader.classList.add("done");
          document.body.classList.remove("loading");
          start();
        }, 250);
      }
    }, 50);
  } else start();

  // 亂碼解碼（像參考網站標題）
  const GLYPHS = "!*?gNIuP#%";
  function scramble(el) {
    const final = el.dataset.text || el.textContent;
    el.dataset.text = final;
    if (reduce) { el.textContent = final; return; }
    const total = 900, t0 = performance.now();
    (function tick(now) {
      const k = Math.min(1, (now - t0) / total);
      let out = "";
      for (let i = 0; i < final.length; i++) {
        const c = final[i];
        out += c === " " || i < final.length * k ? c : GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
      }
      el.textContent = out;
      if (k < 1) requestAnimationFrame(tick); else el.textContent = final;
    })(t0);
  }

  function start() {
    // 捲動淡入
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.classList.add("in");
        e.target.querySelectorAll("[data-scr]").forEach(scramble);
        io.unobserve(e.target);
      });
    }, { threshold: 0.15 });
    document.querySelectorAll(".rv").forEach((el, i) => { el.style.setProperty("--d", (i % 4) * 0.08 + "s"); io.observe(el); });
    document.querySelectorAll("#heroInner [data-scr]").forEach(scramble);

    // 首屏視差
    const hero = document.getElementById("heroInner");
    let ticking = false;
    window.addEventListener("scroll", () => {
      if (ticking || reduce) return; ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY, k = Math.min(1, y / 600);
        hero.style.transform = `translateY(${y * 0.28}px)`;
        hero.style.opacity = 1 - k;
        hero.style.filter = `blur(${k * 10}px)`;
        ticking = false;
      });
    }, { passive: true });
  }

  // 動態內容（工作坊、IG）出現後也要淡入
  window.observeReveal = function (root) {
    root.querySelectorAll(".rv:not(.in)").forEach((el, i) => {
      el.style.setProperty("--d", i * 0.1 + "s");
      requestAnimationFrame(() => new IntersectionObserver((es, o) => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add("in"); o.disconnect(); } }), { threshold: 0.15 }).observe(el));
    });
  };
})();
