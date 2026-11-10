import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { guides } from './content/seo-guides.js';
const origin = 'https://snapkit.vn';
const verification = 'h-jvHlvNiofEYSwQKFkzZWamKLfht3U6WtMXhk_v2CA';
const escape = value => String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const route = (lang, slug = '') => `${lang === 'vi' ? 'huong-dan' : 'en/guides'}/${slug ? slug + '/' : ''}`;
const home = lang => lang === 'vi' ? '' : 'en/';
const screenshotAlt = (image, lang) => ({
 teams: {vi:'Bảng công việc Snapkit Teams với dữ liệu minh hoạ',en:'Snapkit Teams task board with fictional data'},
 devices: { vi: 'Danh sách Android Emulator và iOS Simulator cùng trạng thái thiết bị trong Snapkit', en: 'Android Emulator and iOS Simulator list with device status in Snapkit' },
 setup: { vi: 'Màn hình thiết lập workspace, project và công cụ phát triển trong Snapkit', en: 'Workspace, project and development tool setup in Snapkit' }
}[image][lang]);
function alternates(vi, en) { return `<link rel="alternate" hreflang="vi" href="${origin}/${vi}"><link rel="alternate" hreflang="en" href="${origin}/${en}"><link rel="alternate" hreflang="x-default" href="${origin}/${vi}">`; }
const graph = nodes => `<script type="application/ld+json">${JSON.stringify({'@context':'https://schema.org','@graph':nodes}).replaceAll('<','\\u003c')}</script>`;
// Translate authored HTML without depending on a client-side render or third-party service.
function englishHTML(html, translations) {
 let script = false;
 return html.split(/(<[^>]+>)/g).map(token => {
  if (token.startsWith('<')) {
   if (/^<\/(script|style)/i.test(token)) script = false;
   else if (/^<(script|style)\b/i.test(token)) script = true;
   return token.replace(/\b(content|alt|aria-label|title|placeholder)="([^"]*)"/g, (all, attr, value) => translations[value] ? `${attr}="${escape(translations[value])}"` : all);
  }
  if (script) return token;
  const key = token.trim(); return translations[key] ? token.replace(key, escape(translations[key])) : token;
 }).join('');
}
export async function buildSeoPages(out) {
 const context = {window:{}};
 vm.runInNewContext(await readFile(path.join(out,'locales.js'),'utf8'), context);
 const translations = context.window.SnapkitMessages.translations;
 const original = await readFile(path.join(out,'index.html'),'utf8');
 let english = englishHTML(original, translations).replace('<html lang="vi" data-page-language="vi">','<html lang="en" data-page-language="en">');
 english = english.replace('<head>', '<head><base href="../">').replace('<link rel="canonical" href="https://snapkit.vn/">','<link rel="canonical" href="https://snapkit.vn/en/">').replace('property="og:url" content="https://snapkit.vn/"','property="og:url" content="https://snapkit.vn/en/"').replace('property="og:locale" content="vi_VN"','property="og:locale" content="en_US"').replace('property="og:locale:alternate" content="en_US"','property="og:locale:alternate" content="vi_VN"').replaceAll('assets/devices-vi.png','assets/devices.png');
 const description = /<meta name="description" content="([^"]*)"/.exec(english)?.[1];
 if (description) english = english.replace(/(<meta (?:property="og:description"|name="twitter:description") content=")[^"]*/g, '$1' + description);
 english = english.replace(/href="#([^"]*)"/g, 'href="en/#$1"').replaceAll('href="huong-dan/', 'href="en/guides/');
 // Match the language picker to the authored page before deferred localization runs.
 english = english.replace('data-language-current="vi"', 'data-language-current="en"').replace('<span data-language-label>VN</span>', '<span data-language-label>EN</span>').replace('data-language="en" aria-checked="false"', 'data-language="en" aria-checked="true"').replace('data-language="vi" aria-checked="true"', 'data-language="vi" aria-checked="false"');
 // Keep the generated English social and schema copy consistent before JavaScript runs.
 english = english.replace('property="og:image:alt" content="Giao diện Snapkit quản lý thiết bị Flutter và React Native"', 'property="og:image:alt" content="Snapkit Flutter and React Native device workspace"');
 await mkdir(path.join(out,'en'),{recursive:true}); await writeFile(path.join(out,'en/index.html'),english);
 const urls = ['', 'en/'];
 for (const lang of ['vi','en']) {
  const rootRoute = route(lang), isVi = lang === 'vi';
  const title = isVi ? 'Hướng dẫn Snapkit cho Flutter và React Native' : 'Snapkit guides for Flutter and React Native';
  const intro = isVi ? 'Từ cài đặt đến debug nhiều thiết bị: những bước cụ thể để chuẩn bị môi trường, quản lý máy ảo và làm việc trong editor của bạn.' : 'From installation to multi-device debugging: practical steps to prepare your environment, manage virtual devices and work in your editor.';
  const cards = guides.map(g => `<a class="guide-card" href="${route(lang,g.slug)}"><span class="eyebrow">${isVi ? 'HƯỚNG DẪN' : 'GUIDE'}</span><h2>${escape(g[lang].title)}</h2><p>${escape(g[lang].description)}</p><span class="guide-read">${isVi ? 'Đọc hướng dẫn →' : 'Read guide →'}</span></a>`).join('');
  await save(rootRoute, shell({lang,slug:'',title,description:intro,body:`<header class="guide-heading"><p class="eyebrow">SNAPKIT / ${isVi ? 'TÀI LIỆU' : 'DOCUMENTATION'}</p><h1>${title}</h1><p>${intro}</p></header><div class="guide-grid">${cards}</div>`, schema:[{'@type':'CollectionPage',name:title,url:origin+'/'+rootRoute,inLanguage:lang,description:intro}]}));
  urls.push(rootRoute);
  for (const guide of guides) {
   const data = guide[lang], publicPath = route(lang,guide.slug);
   const toc = data.sections.map(([heading], index)=>`<a href="${publicPath}#step-${index+1}"><span>${String(index+1).padStart(2,'0')}</span>${escape(heading)}</a>`).join('');
   const body = `<header class="guide-heading"><p class="eyebrow">SNAPKIT / ${isVi ? 'HƯỚNG DẪN' : 'GUIDE'}</p><h1>${escape(data.title)}</h1><p>${escape(data.intro)}</p></header><figure class="guide-figure"><img src="assets/${guide.image}${isVi ? '-vi' : ''}.webp?v=20261106-images46" alt="${escape(screenshotAlt(guide.image, lang))}" width="1440" height="1020" loading="eager" fetchpriority="high" decoding="async"><figcaption>${isVi ? 'Giao diện Snapkit; yêu cầu công cụ phụ thuộc project và hệ điều hành của bạn.' : 'Snapkit interface; tool requirements depend on your project and operating system.'}</figcaption></figure><div class="guide-layout"><aside class="guide-toc"><p>${isVi ? 'TRONG HƯỚNG DẪN NÀY' : 'ON THIS PAGE'}</p><nav aria-label="${isVi ? 'Mục lục' : 'Table of contents'}">${toc}</nav></aside><article class="guide-article">${data.sections.map(([heading,paragraphs],index)=>`<section id="step-${index+1}"><h2>${escape(heading)}</h2>${paragraphs.map(p=>`<p>${escape(p)}</p>`).join('')}</section>`).join('')}<section class="guide-references"><h2>${isVi ? 'Tài liệu công cụ nền tảng' : 'Platform documentation'}</h2><a href="https://docs.flutter.dev/get-started/install">Flutter SDK</a><a href="https://reactnative.dev/docs/set-up-your-environment">React Native environment</a><a href="https://developer.android.com/studio/run/managing-avds">Android virtual devices</a><a href="https://developer.apple.com/documentation/xcode/running-your-app-in-simulator-or-on-a-device">Xcode Simulator</a></section></article></div><section class="guide-related"><h2>${isVi ? 'Tiếp tục tìm hiểu' : 'Keep learning'}</h2><div class="guide-grid">${guides.filter(g=>g.slug!==guide.slug).map(g=>`<a class="guide-card" href="${route(lang,g.slug)}"><h3>${escape(g[lang].title)}</h3><p>${escape(g[lang].description)}</p></a>`).join('')}</div></section>`;
   await save(publicPath,shell({lang,slug:guide.slug,title:data.title,description:data.description,body,schema:[{'@type':'TechArticle',headline:data.title,description:data.description,inLanguage:lang,url:origin+'/'+publicPath,author:{'@type':'Organization',name:'Snapkit',url:origin+'/'},about:{'@id':origin+'/#app'},mainEntityOfPage:origin+'/'+publicPath}]}));
   urls.push(publicPath);
  }
 }
 await writeFile(path.join(out,'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${urls.map(url=>{const en=url.startsWith('en/'); const slug=url.split('/').filter(Boolean).at(-1); const landing=url===''||url==='en/'; const vi=landing?'':route('vi',slug==='huong-dan'||slug==='guides'?'':slug); const english=landing?'en/':route('en',slug==='huong-dan'||slug==='guides'?'':slug); return `<url><loc>${origin}/${url}</loc><xhtml:link rel="alternate" hreflang="vi" href="${origin}/${vi}"/><xhtml:link rel="alternate" hreflang="en" href="${origin}/${english}"/></url>`;}).join('')}</urlset>\n`);
 async function save(relative,html) {await mkdir(path.join(out,relative),{recursive:true});await writeFile(path.join(out,relative,'index.html'),html);}
}
function shell({lang,slug,title,description,body,schema}) {
 const vi=lang==='vi', url=route(lang,slug), base='../'.repeat(url.split('/').filter(Boolean).length);
 return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><base href="${base}"><script src="reload.js?v=20261106-scroll2"></script><title>${escape(title)} | Snapkit</title><meta name="description" content="${escape(description)}"><meta name="robots" content="index,follow,max-image-preview:large"><meta name="google-site-verification" content="${verification}"><link rel="canonical" href="${origin}/${url}">${alternates(route('vi',slug),route('en',slug))}<meta property="og:type" content="${slug ? 'article':'website'}"><meta property="og:site_name" content="Snapkit"><meta property="og:locale" content="${vi?'vi_VN':'en_US'}"><meta property="og:title" content="${escape(title)}"><meta property="og:description" content="${escape(description)}"><meta property="og:url" content="${origin}/${url}"><meta property="og:image" content="${origin}/assets/${slug ? guides.find(g => g.slug === slug).image : 'devices'}${vi?'-vi':''}.png?v=20261106-images46"><meta property="og:image:width" content="1440"><meta property="og:image:height" content="1020"><meta property="og:image:alt" content="${escape(screenshotAlt(slug ? guides.find(g => g.slug === slug).image : 'devices', lang))}"><meta property="og:locale:alternate" content="${vi?'en_US':'vi_VN'}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${escape(title)}"><meta name="twitter:description" content="${escape(description)}"><meta name="twitter:image" content="${origin}/assets/${slug ? guides.find(g => g.slug === slug).image : 'devices'}${vi?'-vi':''}.png?v=20261106-images46"><meta name="theme-color" content="#000000"><link rel="icon" href="favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="site.css?v=20261106-seo"><link rel="stylesheet" href="guides.css?v=20261106-seo">${graph([...schema,{'@type':'BreadcrumbList',itemListElement:[{'@type':'ListItem',position:1,name:'Snapkit',item:origin+'/'+home(lang)},{'@type':'ListItem',position:2,name:vi?'Hướng dẫn':'Guides',item:origin+'/'+route(lang)},...(slug?[{'@type':'ListItem',position:3,name:title,item:origin+'/'+url}]:[])]}])}</head><body class="guides-page"><a class="skip-link" href="${url}#main">${vi?'Đến nội dung chính':'Skip to main content'}</a><header class="header"><nav class="nav wrap" aria-label="${vi?'Điều hướng chính':'Main navigation'}"><a class="brand" href="${home(lang)||'./'}"><img src="favicon.svg" width="34" height="34" alt="">Snapkit</a><div class="guide-nav"><a href="${route(lang)}">${vi?'Hướng dẫn':'Guides'}</a><a href="${route(vi?'en':'vi',slug)}" hreflang="${vi?'en':'vi'}" lang="${vi?'en':'vi'}">${vi?'English':'Tiếng Việt'}</a><a class="button primary" href="${home(lang)}#downloads">${vi?'Tải Snapkit':'Download Snapkit'}</a></div></nav></header><main id="main" class="wrap">${body}<section class="guide-cta"><h2>${vi?'Chuẩn bị thiết bị cho project tiếp theo.':'Prepare devices for your next project.'}</h2><p>${vi?'Snapkit cho macOS và Windows. Các tính năng hiện có đang miễn phí.':'Snapkit for macOS and Windows. Current features are free.'}</p><a class="button primary" href="${home(lang)}#downloads">${vi?'Chọn bộ cài phù hợp':'Choose your installer'}</a></section></main><footer class="footer"><div class="wrap footer-bottom"><span>© 2026 Snapkit</span><a href="${home(lang)||'./'}">${vi?'Về trang chủ':'Back to home'}</a></div></footer></body></html>`;
}
