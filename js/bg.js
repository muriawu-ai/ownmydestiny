// 背景漸層動畫（移植自 background-gradient-animation，原生 JS）
(function () {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  const root = document.createElement("div");
  root.className = "bga" + (isSafari ? " safari" : "");
  root.setAttribute("aria-hidden", "true");
  root.innerHTML =
    '<svg class="hidden-svg"><defs><filter id="blurMe"><feGaussianBlur in="SourceGraphic" stdDeviation="10" result="blur"/>' +
    '<feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -8" result="goo"/>' +
    '<feBlend in="SourceGraphic" in2="goo"/></filter></defs></svg>' +
    '<div class="g"><div class="b b1"></div><div class="b b2"></div><div class="b b3"></div><div class="b b4"></div><div class="b b5"></div><div class="pointer"></div></div>';
  document.body.prepend(root);
  if (reduce) return;

  const pointer = root.querySelector(".pointer");
  let curX = 0, curY = 0, tgX = 0, tgY = 0;
  window.addEventListener("mousemove", (e) => { tgX = e.clientX - window.innerWidth / 2; tgY = e.clientY - window.innerHeight / 2; }, { passive: true });
  (function move() {
    curX += (tgX - curX) / 20; curY += (tgY - curY) / 20;
    pointer.style.transform = `translate(${Math.round(curX)}px, ${Math.round(curY)}px)`;
    requestAnimationFrame(move);
  })();
})();
