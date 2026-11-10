import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
const origin = 'https://snapkit.vn';
const verification = 'h-jvHlvNiofEYSwQKFkzZWamKLfht3U6WtMXhk_v2CA';
const escape = value => String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
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
 english = english.replace(/href="#([^"]*)"/g, 'href="en/#$1"');
 // Match the language picker to the authored page before deferred localization runs.
 english = english.replace('data-language-current="vi"', 'data-language-current="en"').replace('<span data-language-label>VN</span>', '<span data-language-label>EN</span>').replace('data-language="en" aria-checked="false"', 'data-language="en" aria-checked="true"').replace('data-language="vi" aria-checked="true"', 'data-language="vi" aria-checked="false"');
 // Keep the generated English social and schema copy consistent before JavaScript runs.
 english = english.replace('property="og:image:alt" content="Giao diện Snapkit quản lý thiết bị Flutter và React Native"', 'property="og:image:alt" content="Snapkit Flutter and React Native device workspace"');
 await mkdir(path.join(out,'en'),{recursive:true}); await writeFile(path.join(out,'en/index.html'),english);
 const urls = ['', 'en/'];
 await writeFile(path.join(out,'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${urls.map(url=>`<url><loc>${origin}/${url}</loc><xhtml:link rel="alternate" hreflang="vi" href="${origin}/"/><xhtml:link rel="alternate" hreflang="en" href="${origin}/en/"/></url>`).join('')}</urlset>\n`);
}
