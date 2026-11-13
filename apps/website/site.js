// Consolidate old GitHub Pages bookmarks on the canonical site.
if (location.hostname === 'bimbimvqt.github.io') location.replace('https://snapkit.vn' + location.pathname.replace(/^\/snapkit(?=\/|$)/, '') + location.search + location.hash);
const t = (...args) => window.SnapkitI18n.t(...args);
let downloadMessage = null;
let activePreview = 'debug';
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
    if (versionLabel) versionLabel.textContent = versions.map(version => 'v' + version.replace(/-beta\.(\d+)$/, ' ($1)')).join(' · ');
    const status = document.querySelector('#download-status');
    if (status) { downloadMessage = count === 3 ? 'Bản desktop đã sẵn sàng. Chọn đúng loại máy của bạn.' : 'Một số bộ cài chưa sẵn sàng. Hãy chọn hệ điều hành phù hợp hoặc thử lại sau.'; status.textContent = t(downloadMessage); }
  } catch { const status = document.querySelector('#download-status'); if (status) { downloadMessage = 'Không thể kiểm tra phiên bản mới. Các nút tải vẫn dùng bộ cài hiện có.'; status.textContent = t(downloadMessage); } }
  finally { downloadsPending = false; }
}
loadContent().finally(loadDesktopDownloads);
function refreshDownloads() { if (!document.hidden && Date.now() - lastDownloadCheck >= 60000) void loadDesktopDownloads(); }
window.addEventListener('focus', refreshDownloads);
document.addEventListener('visibilitychange', refreshDownloads);
setInterval(refreshDownloads, 300000);

const preview = document.querySelector('#app-preview');
const captions = {
  teams: ['Giao diện Snapkit Teams với dữ liệu minh hoạ', 'Snapkit Teams · Giao diện thật, dữ liệu minh hoạ.'],
  debug: ['Video minh họa Debug Sync', 'Debug Sync · Video minh họa Flutter Hot Reload trên 3 thiết bị.'],
  captures: ['Ảnh chụp và video được sắp xếp theo project trong Snapkit', 'Thư viện ảnh & video · Giao diện thật, dữ liệu minh họa.'],
  releases: ['Giao diện build Flutter APK, AAB và IPA trong Snapkit', 'Build & phát hành Flutter · Giao diện thật, dữ liệu minh họa.'],
  devices: ['Giao diện Snapkit quản lý iPhone Simulator, Android Emulator và điện thoại thật với trạng thái và nút chọn debug', 'Giao diện thật của Snapkit · Thiết bị và dữ liệu minh họa.'],
  setup: ['Giao diện kiểm tra Flutter, Android SDK, iOS và lựa chọn editor trong Snapkit', 'Kiểm tra công cụ trên máy · Trạng thái minh họa.']
};
const debugPreview = document.querySelector('#debug-preview');
const debugVideo = document.querySelector('#debug-video');
const videoPlay = document.querySelector('#debug-play');
const videoStatus = document.querySelector('#debug-video-status');
const videoRetry = document.querySelector('#debug-retry');
const desktopVideo = matchMedia('(min-width:601px)');
const reducedVideo = matchMedia('(prefers-reduced-motion:reduce)');
let videoInView = false, userPausedVideo = false, ignoredPauses = 0, videoLoading = false, previewPending = false;
const previewFigure = preview.closest('figure');
const previewLoading = document.querySelector('#preview-loading');
function updatePreviewLoading() {
  const busy = previewPending || activePreview === 'debug' && videoLoading;
  if (busy) previewFigure.setAttribute('aria-busy','true'); else previewFigure.removeAttribute('aria-busy');
  previewLoading.hidden = !busy;
}
function pauseDebugVideo() {
  if (!debugVideo.paused) { ignoredPauses++; debugVideo.pause(); }
}
function playDebugVideo() {
  debugVideo.muted = true;
  videoLoading = debugVideo.readyState < 3; updatePreviewLoading();
  return debugVideo.play().catch(() => { videoLoading = false; updatePreviewLoading(); if (!debugVideo.error) videoPlay.hidden = false; });
}
function syncDebugVideo() {
  if (activePreview !== 'debug' || !videoInView || document.hidden) { pauseDebugVideo(); return; }
  if (debugVideo.getAttribute('src') && desktopVideo.matches && !reducedVideo.matches && !navigator.connection?.saveData && !userPausedVideo && debugVideo.paused) void playDebugVideo();
}
videoPlay.onclick = () => { userPausedVideo = false; void playDebugVideo(); };
debugVideo.addEventListener('play', () => { userPausedVideo = false; videoPlay.hidden = true; });
debugVideo.addEventListener('pause', () => {
  videoPlay.hidden = false; videoLoading = false; updatePreviewLoading();
  if (ignoredPauses) ignoredPauses--; else userPausedVideo = true;
});
for (const event of ['waiting','stalled']) debugVideo.addEventListener(event, () => { if (!debugVideo.paused) { videoLoading = true; updatePreviewLoading(); } });
for (const event of ['playing','canplay']) debugVideo.addEventListener(event, () => { videoLoading = false; updatePreviewLoading(); });
debugVideo.addEventListener('error', () => {
  videoLoading = false; updatePreviewLoading();
  videoStatus.textContent = t('Chưa tải được video. Hãy thử lại hoặc chọn tab ảnh.');
  videoStatus.hidden = false; videoRetry.hidden = false; videoPlay.hidden = true;
});
videoRetry.onclick = () => { videoStatus.hidden = true; videoRetry.hidden = true; debugVideo.load(); userPausedVideo = false; void playDebugVideo(); };
new IntersectionObserver(entries => { videoInView = entries[0].isIntersecting; syncDebugVideo(); }, { threshold: .25 }).observe(debugPreview);
document.addEventListener('visibilitychange', syncDebugVideo);
desktopVideo.addEventListener('change', syncDebugVideo); reducedVideo.addEventListener('change', syncDebugVideo);
let previewEpoch = 0, requestedPreview = activePreview;
async function choosePreview(key) {
  requestedPreview = key;
  const epoch = ++previewEpoch;
  const language = window.SnapkitI18n.language;
  if (key !== 'debug') pauseDebugVideo();
  const source = `assets/${key}${language === 'vi' ? '-vi' : ''}.webp?v=20261113-cleanup83`;
  const figure = previewFigure; previewPending = true; updatePreviewLoading();
  try {
    const next = new Image(); next.src = key === 'debug' ? `assets/debug-sync/${language}.webp` : source; await next.decode();
    if (epoch !== previewEpoch) return;
    if (key !== 'debug') preview.src = source;
    const demoLink = document.querySelector('#preview-demo-link');
    demoLink.href = key === 'teams' ? 'demo/?product=teams' : 'demo/';
    activePreview = key; preview.hidden = key === 'debug';
    debugPreview.hidden = key !== 'debug'; figure.querySelector('.window-top').hidden = key === 'debug';
    if (key === 'debug') {
      const videoSource = `assets/debug-sync/${language}.mp4`;
      debugVideo.poster = `assets/debug-sync/${language}.webp`;
      debugVideo.setAttribute('aria-label', t(captions.debug[0]));
      if (debugVideo.getAttribute('src') !== videoSource) {
        pauseDebugVideo(); debugVideo.src = videoSource; debugVideo.load();
        videoStatus.hidden = true; videoRetry.hidden = true;
      }
      syncDebugVideo();
    } else pauseDebugVideo();
    for (const button of document.querySelectorAll('[data-preview]')) button.setAttribute('aria-pressed', String(button.dataset.preview === key));
    preview.alt = t(captions[key][0]);
    document.querySelector('#preview-caption').textContent = t(captions[key][1]);
  } catch {
    if (epoch === previewEpoch) { requestedPreview = activePreview; document.querySelector('#preview-caption').textContent = t('Chưa tải được ảnh xem trước. Hãy chọn lại để thử.'); }
  } finally { if (epoch === previewEpoch) { previewPending = false; updatePreviewLoading(); } }
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
feedbackType.configure({ name: 'type', value: 'feature', labelledby: 'feedback-type-label', items: [
  {value:'feature',label:'Đề xuất tính năng'},{value:'bug',label:'Báo lỗi'},{value:'review',label:'Đánh giá trải nghiệm'},{value:'other',label:'Góp ý khác'}
] });
const ratingField = document.querySelector('#feedback-rating-field');
const ratingInputs = [...document.querySelectorAll('input[name=rating]')];
function renderStars(previewValue) {
  const chosen = Number(ratingInputs.find(input => input.checked)?.value || 0);
  ratingInputs.forEach(input => {
    input.closest('label').classList.toggle('filled', Number(input.value) <= (previewValue ?? chosen));
    input.setAttribute('aria-label', t('{0} sao', [input.value]));
  });
  document.querySelector('#rating-description').textContent = chosen ? t('{0}/5 sao', [chosen]) : t('Chọn số sao để đánh giá');
}
function updateRating() {
  const review = feedbackType.value === 'review';
  ratingField.hidden = !review; ratingField.disabled = !review;
  ratingInputs.forEach(input => { input.required = review; });
  renderStars();
}
ratingInputs.forEach(input => {
  input.addEventListener('change', () => renderStars());
  input.closest('label').addEventListener('pointerenter', () => renderStars(Number(input.value)));
});
document.querySelector('.star-picker').addEventListener('pointerleave', () => renderStars());
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
  body.publishConsent = body.type === 'review' && fields.get('publishConsent') === 'on';
  button.disabled = true; feedbackForm.setAttribute('aria-busy', 'true'); showFeedback('Đang gửi góp ý…', 'pending');
  try {
    const origin = location.hostname === 'bimbimvqt.github.io' ? 'https://snapkit.vn' : location.origin;
    const response = await fetch(origin + '/v1/feedback', { method:'POST', headers:{'Content-Type':'application/json','X-Snapkit-Request':'1'}, body:JSON.stringify(body), signal:AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(response.status === 429 ? 'rate' : 'failed');
    const data = await response.json(); if (data.received !== true) throw new Error('failed');
    feedbackForm.reset(); feedbackType.value = 'feature'; updateRating(); showFeedback(body.publishConsent ? 'Đã nhận đánh giá. Nội dung sẽ hiển thị sau khi được duyệt.' : 'Đã nhận góp ý. Cảm ơn bạn đã giúp Snapkit tốt hơn!', 'success');
  } catch (error) {
    showFeedback(error.message === 'rate' ? 'Bạn đã gửi nhiều góp ý. Vui lòng thử lại sau một giờ.' : 'Chưa thể gửi góp ý. Nội dung vẫn được giữ lại, bạn hãy thử lại.', 'error');
  } finally { button.disabled = false; feedbackForm.removeAttribute('aria-busy'); }
});
document.addEventListener('snapkit:language', () => { renderStars(); if (feedbackMessage) document.querySelector('#feedback-status').textContent = t(feedbackMessage); });
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

const starShape = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.78 5.63 6.22.9-4.5 4.39 1.06 6.2L12 17.19l-5.56 2.93 1.06-6.2L3 9.53l6.22-.9z"/></svg>';
let publicReviews = [], reviewTotal = 0, reviewsBusy = false, reviewsMessage = '', lastReviewsCheck = 0;
function renderReviews() {
  const list = document.querySelector('#reviews-list'); list.replaceChildren();
  for (const review of publicReviews) {
    const card = document.createElement('article'); card.className = 'review-card';
    const stars = document.createElement('span'); stars.className = 'rating-stars'; stars.setAttribute('role','img'); stars.setAttribute('aria-label',t('{0}/5 sao',[review.rating]));
    stars.innerHTML = starShape.repeat(5); [...stars.children].forEach((star,index) => star.classList.toggle('filled',index < review.rating));
    const message = document.createElement('p'); message.className = 'review-message'; message.textContent = review.message;
    const name = document.createElement('strong'); name.textContent = review.name || t('Người dùng Snapkit');
    const date = document.createElement('time'); date.dateTime = review.createdAt; date.textContent = new Date(review.createdAt).toLocaleDateString(window.SnapkitI18n.language === 'vi' ? 'vi-VN' : 'en-US');
    card.append(stars,message,name,date); list.append(card);
  }
  document.querySelector('#reviews-status').textContent = t(reviewsMessage);
  document.querySelector('#reviews-more').hidden = publicReviews.length >= reviewTotal;
}
async function loadReviews(append = false) {
  if (reviewsBusy) return;
  reviewsBusy = true; lastReviewsCheck = Date.now();
  const list = document.querySelector('#reviews-list'); list.setAttribute('aria-busy','true');
  const more = document.querySelector('#reviews-more'); more.disabled = true;
  document.querySelector('#reviews-retry').hidden = true;
  try {
    const response = await fetch('/v1/public/reviews?offset=' + (append ? publicReviews.length : 0), {signal:AbortSignal.timeout(10000)});
    if (!response.ok) throw Error('Reviews unavailable');
    const data = await response.json(); if (!Array.isArray(data.reviews)) throw Error('Invalid reviews');
    publicReviews = append ? [...publicReviews,...data.reviews.filter(review => !publicReviews.some(existing => existing.id === review.id))] : data.reviews;
    reviewTotal = data.total; reviewsMessage = reviewTotal ? '' : 'Chưa có đánh giá được duyệt. Hãy chia sẻ trải nghiệm đầu tiên của bạn.'; renderReviews();
  } catch {
    reviewsMessage = 'Chưa tải được đánh giá. Vui lòng thử lại.'; document.querySelector('#reviews-status').textContent = t(reviewsMessage); document.querySelector('#reviews-retry').hidden = false;
  } finally { reviewsBusy = false; more.disabled = false; list.removeAttribute('aria-busy'); }
}
document.querySelector('#reviews-more').onclick = () => void loadReviews(true);
document.querySelector('#reviews-retry').onclick = () => void loadReviews();
document.addEventListener('snapkit:language', renderReviews);
function refreshReviews() { if (!document.hidden && Date.now() - lastReviewsCheck > 60000) void loadReviews(); }
window.addEventListener('focus', refreshReviews); document.addEventListener('visibilitychange', refreshReviews); setInterval(refreshReviews,300000);
void loadReviews();

// Use app captures in the selected language, including direct /en/ visits.
function updateVisualImages() {
  const suffix = window.SnapkitI18n.language === 'vi' ? '-vi' : '';
  for (const image of document.querySelectorAll('[data-visual-image]')) {
    const source = `assets/visual/${image.dataset.visualImage}${suffix}.webp?v=20261113-cleanup83`;
    if (image.getAttribute('src') !== source) image.src = source;
  }
}
document.addEventListener('snapkit:language', updateVisualImages);
updateVisualImages();

for(const button of document.querySelectorAll('[data-mini-view]'))button.addEventListener('click',()=>{
 const view=button.dataset.miniView;
 if(!['focus','utility','debug'].includes(view))return;
 const image=document.getElementById('mini-feature-image');
 if(!image)return;
 image.dataset.visualImage=view==='focus'?'kit-mini':view==='utility'?'kit-mini-tools':`kit-mini-${view}`;
 for(const peer of document.querySelectorAll('[data-mini-view]'))peer.setAttribute('aria-pressed',String(peer===button));
 updateVisualImages();
});

function updateDevLabGuide(){const link=document.getElementById('dev-lab-guide');if(link)link.setAttribute('href',(window.SnapkitI18n.language==='vi'?'huong-dan/':'en/guides/')+'dev-lab-mcp-performance/');}
document.addEventListener('snapkit:language',updateDevLabGuide);
updateDevLabGuide();
