function getSlideHtml({ slideType, data, slideIndex, totalSlides }) {
  const safe = makeSafeData(data);
  const commonHead = `
<meta charset="UTF-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Roboto+Mono:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: 1080px;
    height: 1080px;
    background: #000;
    font-family: 'Canvas Sans', 'Roboto Mono', 'Courier New', monospace;
    overflow: hidden;
  }
  .avatar {
    width: 72px;
    height: 72px;
    border-radius: 50%;
    background: #222;
    border: 2px solid #555;
  }
  .footer {
    position: absolute;
    bottom: 48px;
    left: 80px;
    right: 80px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .footer-user {
    display: flex;
    align-items: center;
    gap: 20px;
  }
  .handle {
    font-size: 28px;
    font-weight: 800;
    color: #fff;
  }
</style>`;

  if (slideType === "cover") {
    return `<!DOCTYPE html><html><head>${commonHead}
<style>
  .slide {
    width: 1080px; height: 1080px; background: #000; display: flex; flex-direction: column;
    align-items: center; justify-content: center; text-align: center; padding: 80px; position: relative;
  }
  .tag { font-size: 18px; color: #22d3ee; letter-spacing: 6px; text-transform: uppercase; margin-bottom: 32px; }
  .title { font-size: 64px; font-weight: 800; color: #22d3ee; line-height: 1.15; margin-bottom: 36px; }
  .subtitle { font-size: 28px; font-weight: 400; color: #aaa; line-height: 1.6; max-width: 900px; margin: 0 auto; }
  .swipe { font-size: 28px; font-weight: 700; color: #fff; }
</style></head><body>
<div class="slide">
  <div class="tag">${escapeHtml(safe.tag || "EDUCATIONAL CAROUSEL")}</div>
  <div class="title">${escapeHtml(safe.title)}</div>
  <div class="subtitle">${escapeHtml(safe.subtitle)}</div>
  <div class="footer">
    <div class="footer-user">
      <img class="avatar" src="${escapeAttrUrl(safe.avatarUrl)}" onerror="this.style.background='#333'">
      <span class="handle">${escapeHtml(safe.handle)}</span>
    </div>
    <span class="swipe">Swipe ›</span>
  </div>
</div>
</body></html>`;
  }

  if (slideType === "list") {
    return `<!DOCTYPE html><html><head>${commonHead}
<style>
  .slide { width: 1080px; height: 1080px; background: #000; display: flex; flex-direction: column; padding: 80px 80px 140px; position: relative; }
  .slide-num { font-size: 22px; color: #a855f7; font-weight: 700; letter-spacing: 2px; margin-bottom: 36px; }
  .heading { font-size: 52px; font-weight: 800; color: #fff; line-height: 1.2; margin-bottom: 32px; }
  .intro { font-size: 28px; color: #aaa; line-height: 1.6; margin-bottom: 32px; }
  .list { list-style: none; display: flex; flex-direction: column; gap: 16px; }
  .list li { font-size: 28px; color: #e2e8f0; padding-left: 28px; position: relative; line-height: 1.4; }
  .list li::before { content: ''; width: 8px; height: 8px; background: #22d3ee; border-radius: 50%; position: absolute; left: 0; top: 10px; }
  .swipe { font-size: 28px; font-weight: 700; color: #fff; }
</style></head><body>
<div class="slide">
  <div class="slide-num">${slideIndex}/${totalSlides}</div>
  <div class="heading">${escapeHtml(safe.heading)}</div>
  <div class="intro">${escapeHtml(safe.intro)}</div>
  <ul class="list">
    <li>${escapeHtml(safe.point1)}</li>
    <li>${escapeHtml(safe.point2)}</li>
    <li>${escapeHtml(safe.point3)}</li>
  </ul>
  <div class="footer">
    <div class="footer-user">
      <img class="avatar" src="${escapeAttrUrl(safe.avatarUrl)}" onerror="this.style.background='#333'">
      <span class="handle">${escapeHtml(safe.handle)}</span>
    </div>
    <span class="swipe">Swipe ›</span>
  </div>
</div>
</body></html>`;
  }

  if (slideType === "code") {
    return `<!DOCTYPE html><html><head>${commonHead}
<style>
  .slide { width: 1080px; height: 1080px; background: #000; display: flex; flex-direction: column; padding: 80px 80px 140px; position: relative; }
  .slide-num { font-size: 22px; color: #a855f7; font-weight: 700; letter-spacing: 2px; margin-bottom: 36px; }
  .heading { font-size: 52px; font-weight: 800; color: #fff; line-height: 1.2; margin-bottom: 28px; }
  .intro { font-size: 28px; color: #aaa; line-height: 1.6; margin-bottom: 28px; }
  .code-block { background: #111; border: 1px solid #2a2a2a; border-radius: 12px; padding: 28px 32px; margin-bottom: 28px; }
  .dots { display: flex; gap: 8px; margin-bottom: 20px; }
  .dot { width: 14px; height: 14px; border-radius: 50%; }
  .dot.r { background: #ef4444; } .dot.y { background: #eab308; } .dot.g { background: #22c55e; }
  .code-line { font-size: 28px; color: #22d3ee; font-family: 'Courier New', monospace; }
  .body-text { font-size: 26px; color: #aaa; line-height: 1.6; }
  .swipe { font-size: 28px; font-weight: 700; color: #fff; }
</style></head><body>
<div class="slide">
  <div class="slide-num">${slideIndex}/${totalSlides}</div>
  <div class="heading">${escapeHtml(safe.heading)}</div>
  <div class="intro">${escapeHtml(safe.intro)}</div>
  <div class="code-block">
    <div class="dots"><span class="dot r"></span><span class="dot y"></span><span class="dot g"></span></div>
    <div class="code-line">${escapeHtml(safe.codeLine)}</div>
  </div>
  <div class="body-text">${escapeHtml(safe.bodyText)}</div>
  <div class="footer">
    <div class="footer-user">
      <img class="avatar" src="${escapeAttrUrl(safe.avatarUrl)}" onerror="this.style.background='#333'">
      <span class="handle">${escapeHtml(safe.handle)}</span>
    </div>
    <span class="swipe">Swipe ›</span>
  </div>
</div>
</body></html>`;
  }

  if (slideType === "quote") {
    return `<!DOCTYPE html><html><head>${commonHead}
<style>
  .slide { width: 1080px; height: 1080px; background: #000; display: flex; flex-direction: column; padding: 80px 80px 140px; position: relative; }
  .slide-num { font-size: 22px; color: #a855f7; font-weight: 700; letter-spacing: 2px; margin-bottom: 36px; }
  .heading { font-size: 52px; font-weight: 800; color: #fff; line-height: 1.2; margin-bottom: 28px; }
  .intro { font-size: 28px; color: #aaa; line-height: 1.6; margin-bottom: 28px; }
  .quote-block { border-left: 5px solid #a855f7; background: #0d0d1a; padding: 28px 32px; margin-bottom: 28px; border-radius: 0 12px 12px 0; }
  .quote-text { font-size: 28px; color: #e2e8f0; line-height: 1.55; font-style: italic; }
  .body-text { font-size: 26px; color: #aaa; line-height: 1.6; }
  .swipe { font-size: 28px; font-weight: 700; color: #fff; }
</style></head><body>
<div class="slide">
  <div class="slide-num">${slideIndex}/${totalSlides}</div>
  <div class="heading">${escapeHtml(safe.heading)}</div>
  <div class="intro">${escapeHtml(safe.intro)}</div>
  <div class="quote-block"><div class="quote-text">${escapeHtml(safe.quoteText)}</div></div>
  <div class="body-text">${escapeHtml(safe.bodyText)}</div>
  <div class="footer">
    <div class="footer-user">
      <img class="avatar" src="${escapeAttrUrl(safe.avatarUrl)}" onerror="this.style.background='#333'">
      <span class="handle">${escapeHtml(safe.handle)}</span>
    </div>
    <span class="swipe">Swipe ›</span>
  </div>
</div>
</body></html>`;
  }

  if (slideType === "concept") {
    return `<!DOCTYPE html><html><head>${commonHead}
<style>
  .slide { width: 1080px; height: 1080px; background: #000; display: flex; flex-direction: column; padding: 80px 80px 140px; position: relative; }
  .slide-num { font-size: 22px; color: #a855f7; font-weight: 700; letter-spacing: 2px; margin-bottom: 36px; }
  .heading { font-size: 52px; font-weight: 800; color: #fff; line-height: 1.2; margin-bottom: 28px; }
  .intro { font-size: 28px; color: #aaa; line-height: 1.6; margin-bottom: 36px; }
  .concept { margin-bottom: 36px; padding-left: 28px; border-left: 3px solid #fb923c; }
  .concept-label { font-size: 30px; color: #fb923c; font-weight: 700; margin-bottom: 10px; }
  .concept-body { font-size: 26px; color: #ccc; line-height: 1.55; }
  .swipe { font-size: 28px; font-weight: 700; color: #fff; }
</style></head><body>
<div class="slide">
  <div class="slide-num">${slideIndex}/${totalSlides}</div>
  <div class="heading">${escapeHtml(safe.heading)}</div>
  <div class="intro">${escapeHtml(safe.intro)}</div>
  <div class="concept">
    <div class="concept-label">${escapeHtml(safe.concept1Label)}</div>
    <div class="concept-body">${escapeHtml(safe.concept1Body)}</div>
  </div>
  <div class="concept">
    <div class="concept-label">${escapeHtml(safe.concept2Label)}</div>
    <div class="concept-body">${escapeHtml(safe.concept2Body)}</div>
  </div>
  <div class="footer">
    <div class="footer-user">
      <img class="avatar" src="${escapeAttrUrl(safe.avatarUrl)}" onerror="this.style.background='#333'">
      <span class="handle">${escapeHtml(safe.handle)}</span>
    </div>
    <span class="swipe">Swipe ›</span>
  </div>
</div>
</body></html>`;
  }

  if (slideType === "cta") {
    return `<!DOCTYPE html><html><head>${commonHead}
<style>
  .slide {
    width: 1080px; height: 1080px; background: #000; display: flex; flex-direction: column;
    align-items: center; justify-content: center; text-align: center; padding: 80px; position: relative;
  }
  .cta-headline { font-size: 56px; font-weight: 800; color: #22d3ee; line-height: 1.15; margin-bottom: 32px; max-width: 900px; }
  .divider { width: 80px; height: 2px; background: #333; margin: 0 auto 32px; }
  .cta-sub { font-size: 28px; font-weight: 400; color: #aaa; line-height: 1.55; margin-bottom: 32px; max-width: 900px; }
  .cta-action { font-size: 32px; color: #f472b6; font-weight: 700; }
</style></head><body>
<div class="slide">
  <div class="cta-headline">${escapeHtml(safe.title)}</div>
  <div class="divider"></div>
  <div class="cta-sub">${escapeHtml(safe.subtitle)}</div>
  <div class="cta-action">↓ ${escapeHtml(safe.ctaAction || "Follow for more")}</div>
  <div class="footer">
    <div class="footer-user">
      <img class="avatar" src="${escapeAttrUrl(safe.avatarUrl)}" onerror="this.style.background='#333'">
      <span class="handle">${escapeHtml(safe.handle)}</span>
    </div>
  </div>
</div>
</body></html>`;
  }

  return `<!DOCTYPE html><html><head>${commonHead}</head><body></body></html>`;
}

function escapeHtml(input) {
  return String(input || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/** For img src (data: and file: URLs) — do not mangle; only make attribute-safe */
function escapeAttrUrl(input) {
  if (!input) return "";
  return String(input)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "%3C");
}

function makeSafeData(data) {
  return {
    tag: data?.tag || "ESSENTIAL GUIDE",
    title: data?.title || "Untitled",
    subtitle: data?.subtitle || "",
    ctaAction: data?.ctaAction || "",
    heading: data?.heading || data?.title || "Untitled",
    intro: data?.intro || "",
    point1: data?.point1 || "No point provided",
    point2: data?.point2 || "No point provided",
    point3: data?.point3 || "No point provided",
    codeLine: data?.codeLine || "const improve = true;",
    bodyText: data?.bodyText || "",
    quoteText: data?.quoteText || "",
    concept1Label: data?.concept1Label || "Concept 1",
    concept1Body: data?.concept1Body || "",
    concept2Label: data?.concept2Label || "Concept 2",
    concept2Body: data?.concept2Body || "",
    avatarUrl: data?.avatarUrl || "",
    handle: data?.handle || "venky"
  };
}

module.exports = { getSlideHtml };
