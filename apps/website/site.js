// Consolidate old GitHub Pages bookmarks on the canonical site.
if (location.hostname === 'bimbimvqt.github.io') location.replace('https://snapkit.vn/' + location.search + location.hash);
const t = (...args) => window.SnapkitI18n.t(...args);
let downloadMessage = null;
let activePreview = 'devices';
let publicContent;
let downloadsPending = false, lastDownloadCheck = 0;
function applyContent() {
  const copy = publicContent?.landing?.[window.SnapkitI18n.language];
  if (!copy) return;
  for (const [selector, value] of [['.hero h1', copy.headline], ['.hero .intro', copy.description]]) {
    const node = document.querySelector(selector);
    if (typeof value === 'string' && value.trim() && node.textContent.replace(/\s/g, '') !== value.replace(/\s/g, '')) node.textContent = value;
  }
}
async function loadContent() { try { const response = await fetch((location.hostname === 'bimbimvqt.github.io' ? 'https://snapkit.vn' : location.origin) + '/v1/public/content', { signal: AbortSignal.timeout(5000) }); if (response.ok) { publicContent = await response.json(); applyContent(); } } catch {} }
async function loadDesktopDownloads() {
  if (downloadsPending) return;
  downloadsPending = true; lastDownloadCheck = Date.now();
  try {
    const response = await fetch('https://api.github.com/repos/bimbimvqt/snapkit/releases?per_page=20', { headers: { Accept: 'application/vnd.github+json' }, signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error('Unavailable');
    const releases = await response.json(); let count = 0;
    const fallbackTag = /releases\/download\/([^/]+)/.exec(document.querySelector('.download-button')?.href || '')?.[1];
    const tag = publicContent?.recommendedVersion ? 'v' + publicContent.recommendedVersion : fallbackTag;
    if (tag && !releases.some(item => item.tag_name === tag)) {
      try { const tagged = await fetch('https://api.github.com/repos/bimbimvqt/snapkit/releases/tags/' + encodeURIComponent(tag), { signal: AbortSignal.timeout(10000) }); if (tagged.ok) releases.push(await tagged.json()); } catch {}
    }
    releases.sort((a, b) => String(b.published_at || '').localeCompare(String(a.published_at || '')));
    for (const button of document.querySelectorAll('.download-button')) {
      const os = button.dataset.platform === 'darwin' ? 'mac' : 'win';
      const ext = os === 'mac' ? 'dmg' : 'exe';
      const release = releases.find(item => !item.draft && (!publicContent?.recommendedVersion || item.tag_name === 'v' + publicContent.recommendedVersion) && item.assets?.some(asset => asset.name === `Snapkit-${item.tag_name.replace(/^v/, '')}-${os}-${button.dataset.arch}.${ext}`));
      const asset = release?.assets.find(asset => asset.name === `Snapkit-${release.tag_name.replace(/^v/, '')}-${os}-${button.dataset.arch}.${ext}`);
      if (asset && asset.browser_download_url.startsWith('https://github.com/bimbimvqt/snapkit/releases/download/')) { button.href = asset.browser_download_url; button.dataset.version = release.tag_name.replace(/^v/, ''); count++; }
    }
    const versions = [...new Set([...document.querySelectorAll('.download-button')].map(button => button.dataset.version).filter(Boolean))];
    const versionLabel = document.querySelector('#release-version');
    if (versionLabel) versionLabel.textContent = versions.map(version => 'v' + version).join(' · ');
    const status = document.querySelector('#download-status');
    if (status) { downloadMessage = count === 3 ? 'Bản desktop beta đã sẵn sàng. Chọn đúng loại máy của bạn.' : 'Một số bộ cài chưa sẵn sàng. Hãy chọn hệ điều hành phù hợp hoặc thử lại sau.'; status.textContent = t(downloadMessage); }
  } catch { const status = document.querySelector('#download-status'); if (status) { downloadMessage = 'Không thể kiểm tra phiên bản mới. Các nút tải vẫn dùng bản beta hiện có.'; status.textContent = t(downloadMessage); } }
  finally { downloadsPending = false; }
}
loadContent().finally(loadDesktopDownloads);
function refreshDownloads() { if (!document.hidden && Date.now() - lastDownloadCheck >= 60000) void loadDesktopDownloads(); }
window.addEventListener('focus', refreshDownloads);
document.addEventListener('visibilitychange', refreshDownloads);
setInterval(refreshDownloads, 300000);

const preview = document.querySelector('#app-preview');
const captions = {
  captures: ['Ảnh chụp và video được sắp xếp theo project trong Snapkit', 'Thư viện ảnh & video · Giao diện thật, dữ liệu minh họa.'],
  releases: ['Giao diện build Flutter APK, AAB và IPA trong Snapkit', 'Build & phát hành Flutter · Giao diện thật, dữ liệu minh họa.'],
  devices: ['Giao diện Snapkit quản lý iPhone Simulator, Android Emulator và điện thoại thật với trạng thái và nút chọn debug', 'Giao diện thật của Snapkit · Thiết bị và dữ liệu minh họa.'],
  setup: ['Giao diện kiểm tra Flutter, Android SDK, iOS và lựa chọn editor trong Snapkit', 'Kiểm tra công cụ trên máy · Trạng thái minh họa.']
};
let previewEpoch = 0, requestedPreview = activePreview;
async function choosePreview(key) {
  requestedPreview = key;
  const epoch = ++previewEpoch;
  const language = window.SnapkitI18n.language;
  const source = `assets/${key}${language === 'vi' ? '-vi' : ''}.png?v=20261106-gallery`;
  const figure = preview.closest('figure'); figure.setAttribute('aria-busy', 'true');
  try {
    const next = new Image(); next.src = source; await next.decode();
    if (epoch !== previewEpoch) return;
    preview.src = source; activePreview = key;
    for (const button of document.querySelectorAll('[data-preview]')) button.setAttribute('aria-pressed', String(button.dataset.preview === key));
    preview.alt = t(captions[key][0]);
    document.querySelector('#preview-caption').textContent = t(captions[key][1]);
  } catch {
    if (epoch === previewEpoch) { requestedPreview = activePreview; document.querySelector('#preview-caption').textContent = t('Chưa tải được ảnh xem trước. Hãy chọn lại để thử.'); }
  } finally { if (epoch === previewEpoch) figure.removeAttribute('aria-busy'); }
}
for (const button of document.querySelectorAll('[data-preview]')) button.addEventListener('click', () => void choosePreview(button.dataset.preview));
for (const link of document.querySelectorAll('a[href="#install-help"]')) {
  link.addEventListener('click', () => { document.querySelector('#install-help').open = true; });
}

document.addEventListener('snapkit:language', () => {
  applyContent();
  if (downloadMessage) document.querySelector('#download-status').textContent = t(downloadMessage);
  void choosePreview(requestedPreview);
});
void choosePreview(activePreview);

const workflowTabs = [...document.querySelectorAll('[data-workflow]')];
function chooseWorkflow(button) {
  for (const tab of workflowTabs) {
    const selected = tab === button;
    tab.setAttribute('aria-selected', String(selected)); tab.tabIndex = selected ? 0 : -1;
    document.getElementById(tab.getAttribute('aria-controls')).hidden = !selected;
  }
}
for (const [index, button] of workflowTabs.entries()) {
  button.addEventListener('click', () => chooseWorkflow(button));
  button.addEventListener('keydown', event => {
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? workflowTabs.length - 1 : event.key === 'ArrowRight' ? (index + 1) % workflowTabs.length : event.key === 'ArrowLeft' ? (index + workflowTabs.length - 1) % workflowTabs.length : null;
    if (next === null) return;
    event.preventDefault(); chooseWorkflow(workflowTabs[next]); workflowTabs[next].focus();
  });
}

const feedbackForm = document.querySelector('#feedback-form');
const feedbackType = document.querySelector('#feedback-type');
function updateRating() {
  const review = feedbackType.value === 'review';
  document.querySelector('#feedback-rating-field').hidden = !review;
  document.querySelector('#feedback-rating').required = review;
}
feedbackType.addEventListener('change', updateRating);
let feedbackMessage = '';
function showFeedback(message, state) {
  feedbackMessage = message;
  const status = document.querySelector('#feedback-status'); status.textContent = t(message); status.dataset.state = state;
}
feedbackForm.addEventListener('submit', async event => {
  event.preventDefault();
  const button = feedbackForm.querySelector('button[type=submit]');
  if (button.disabled) return;
  const fields = new FormData(feedbackForm); const body = Object.fromEntries(fields);
  body.rating = body.type === 'review' ? Number(body.rating) : null;
  button.disabled = true; feedbackForm.setAttribute('aria-busy', 'true'); showFeedback('Đang gửi góp ý…', 'pending');
  try {
    const origin = location.hostname === 'bimbimvqt.github.io' ? 'https://snapkit.vn' : location.origin;
    const response = await fetch(origin + '/v1/feedback', { method:'POST', headers:{'Content-Type':'application/json','X-Snapkit-Request':'1'}, body:JSON.stringify(body), signal:AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(response.status === 429 ? 'rate' : 'failed');
    const data = await response.json(); if (data.received !== true) throw new Error('failed');
    feedbackForm.reset(); updateRating(); showFeedback('Đã nhận góp ý. Cảm ơn bạn đã giúp Snapkit tốt hơn!', 'success');
  } catch (error) {
    showFeedback(error.message === 'rate' ? 'Bạn đã gửi nhiều góp ý. Vui lòng thử lại sau một giờ.' : 'Chưa thể gửi góp ý. Nội dung vẫn được giữ lại, bạn hãy thử lại.', 'error');
  } finally { button.disabled = false; feedbackForm.removeAttribute('aria-busy'); }
});
document.addEventListener('snapkit:language', () => { if (feedbackMessage) document.querySelector('#feedback-status').textContent = t(feedbackMessage); });
updateRating();

function updateSocialMetadata() {
  const title = document.title;
  const description = document.querySelector('meta[name="description"]').content;
  for (const key of ['og:title','twitter:title']) document.querySelector(`meta[property="${key}"],meta[name="${key}"]`).content = title;
  for (const key of ['og:description','twitter:description']) document.querySelector(`meta[property="${key}"],meta[name="${key}"]`).content = description;
  document.querySelector('meta[property="og:locale"]').content = window.SnapkitI18n.language === 'vi' ? 'vi_VN' : 'en_US';
}
document.addEventListener('snapkit:language', updateSocialMetadata);
updateSocialMetadata();
