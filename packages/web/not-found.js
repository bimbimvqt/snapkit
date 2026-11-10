const copy = {
  vi: { title: 'Không tìm thấy trang | Snapkit', heading: 'Không tìm thấy trang này.', description: 'Đường dẫn không còn tồn tại. Chọn một mục bên dưới để tiếp tục.', home: 'Về trang chủ', guides: 'Khám phá Snapkit', download: 'Tải Snapkit', label: '404 · KHÔNG TÌM THẤY TRANG', popular: 'Bạn có thể bắt đầu từ đây', install: 'Tải ứng dụng', flutter: 'Snapkit Cá nhân', native: 'Snapkit Teams', skip: 'Đến nội dung chính', nav: 'Điều hướng chính', language: 'English', footer: 'Một nơi cho mọi thiết bị phát triển.' },
  en: { title: 'Page not found | Snapkit', heading: 'We couldn’t find this page.', description: 'This link is unavailable. Choose a destination below to continue.', home: 'Back to home', guides: 'Explore Snapkit', download: 'Download Snapkit', label: '404 · PAGE NOT FOUND', popular: 'A few good places to start', install: 'Download the app', flutter: 'Snapkit Personal', native: 'Snapkit Teams', skip: 'Skip to main content', nav: 'Main navigation', language: 'Tiếng Việt', footer: 'One workspace for your development devices.' }
};
export function notFoundPage({ language = 'vi', base = '/' } = {}) {
  const en = language === 'en', c = copy[en ? 'en' : 'vi'];
  // Base is deployment configuration, never request-controlled input.
  if (!/^\/(?:[a-zA-Z0-9_-]+\/)*$/.test(base)) throw Error('Invalid website base path');
  const home = en ? 'en/' : '', guides = (home || './') + '#products';
  const html = `<!doctype html><html lang="${en ? 'en' : 'vi'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${c.title}</title><meta name="robots" content="noindex,follow"><meta name="theme-color" content="#101214"><link rel="icon" href="favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="site.css?v=20261106-debug-video"><link rel="stylesheet" href="not-found.css?v=20261110-404"></head><body class="not-found-page"><a class="skip-link" href="#main">${c.skip}</a><header class="header"><nav class="nav wrap" aria-label="${c.nav}"><a class="brand" href="${home || './'}"><img src="favicon.svg" alt="" width="34" height="34">Snapkit</a><div class="error-nav"><a href="${en ? '404.html' : 'en/404.html'}" lang="${en ? 'vi' : 'en'}">${c.language}</a><a class="button" href="${home || './'}#downloads">${c.download}</a></div></nav></header><main id="main" class="wrap error-main"><div class="error-hero"><div class="error-art" aria-hidden="true"><span>4</span><div class="error-zero"><i></i><b></b><i></i></div><span>4</span></div><p class="error-eyebrow">${c.label}</p><h1>${c.heading}</h1><p class="error-description">${c.description}</p><div class="error-actions"><a class="button primary" href="${home || './'}">${c.home}<span aria-hidden="true">↗</span></a><a class="button" href="${guides}">${c.guides}</a></div></div><section class="error-help" aria-labelledby="help-heading"><h2 id="help-heading">${c.popular}</h2><div class="error-links"><a href="${home || './'}#downloads"><span>${c.install}</span><span aria-hidden="true">↗</span></a><a href="${home || './'}#products"><span>${c.flutter}</span><span aria-hidden="true">↗</span></a><a href="${home || './'}#teams"><span>${c.native}</span><span aria-hidden="true">↗</span></a></div></section></main><footer class="error-footer wrap"><span>© 2026 Snapkit</span><span>${c.footer}</span></footer></body></html>`;
  return html.replace(/(href|src)="(?!#)([^"]*)"/g, (_, attr, value) => `${attr}="${base}${value}"`);
}
export function websiteNotFound({ base = '/' } = {}) {
  return (req, res) => {
    res.status(404).set({ 'X-Robots-Tag': 'noindex, follow', 'Cache-Control': 'no-store' });
    const apiOrAsset = /^\/(?:api|v1|assets)(\/|$)/.test(req.path) || /\.(?!html$)[a-z0-9]+$/i.test(req.path);
    if (['GET', 'HEAD'].includes(req.method) && req.accepts('html') && !apiOrAsset) return res.type('html').send(notFoundPage({ language: /^\/en(\/|$)/.test(req.path) ? 'en' : 'vi', base }));
    return res.json({ error: 'Not found' });
  };
}
