const t = (...args) => window.SnapkitI18n.t(...args);
let downloadMessage = null;
let activePreview = 'devices';
async function loadDesktopDownloads() {
  try {
    const response = await fetch('https://api.github.com/repos/bimbimvqt/snapkit/releases?per_page=20', { headers: { Accept: 'application/vnd.github+json' }, signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error('Unavailable');
    const releases = await response.json(); let count = 0;
    for (const button of document.querySelectorAll('.download-button')) {
      const os = button.dataset.platform === 'darwin' ? 'mac' : 'win';
      const ext = os === 'mac' ? 'dmg' : 'exe';
      const release = releases.find(item => !item.draft && item.assets?.some(asset => asset.name === `Snapkit-${item.tag_name.replace(/^v/, '')}-${os}-${button.dataset.arch}.${ext}`));
      const asset = release?.assets.find(asset => asset.name === `Snapkit-${release.tag_name.replace(/^v/, '')}-${os}-${button.dataset.arch}.${ext}`);
      if (asset && asset.browser_download_url.startsWith('https://github.com/bimbimvqt/snapkit/releases/download/')) { button.href = asset.browser_download_url; count++; }
    }
    const status = document.querySelector('#download-status');
    if (status) { downloadMessage = count === 3 ? 'Bản desktop beta đã sẵn sàng. Chọn đúng loại máy của bạn.' : 'Một số bộ cài chưa sẵn sàng. Hãy chọn hệ điều hành phù hợp hoặc thử lại sau.'; status.textContent = t(downloadMessage); }
  } catch { const status = document.querySelector('#download-status'); if (status) { downloadMessage = 'Không thể kiểm tra phiên bản mới. Các nút tải vẫn dùng bản beta hiện có.'; status.textContent = t(downloadMessage); } }
}
loadDesktopDownloads();

const preview = document.querySelector('#app-preview');
const captions = {
  devices: ['Giao diện Snapkit quản lý iPhone Simulator, Android Emulator và điện thoại thật với trạng thái và nút chọn debug', 'Giao diện thật của Snapkit · Thiết bị và dữ liệu minh họa.'],
  setup: ['Giao diện kiểm tra Flutter, Android SDK, iOS và lựa chọn editor trong Snapkit', 'Kiểm tra công cụ trên máy · Trạng thái minh họa.']
};
for (const button of document.querySelectorAll('[data-preview]')) {
  button.addEventListener('click', () => {
    const key = button.dataset.preview; activePreview = key;
    for (const sibling of document.querySelectorAll('[data-preview]')) sibling.setAttribute('aria-pressed', String(sibling === button));
    preview.src = `assets/${key}${window.SnapkitI18n.language === 'vi' ? '-vi' : ''}.webp`;
    preview.alt = t(captions[key][0]);
    document.querySelector('#preview-caption').textContent = t(captions[key][1]);
  });
}
for (const link of document.querySelectorAll('a[href="#install-help"]')) {
  link.addEventListener('click', () => { document.querySelector('#install-help').open = true; });
}

document.addEventListener('snapkit:language', () => {
  if (downloadMessage) document.querySelector('#download-status').textContent = t(downloadMessage);
  preview.src = `assets/${activePreview}${window.SnapkitI18n.language === 'vi' ? '-vi' : ''}.webp`;
  preview.alt = t(captions[activePreview][0]);
  document.querySelector('#preview-caption').textContent = t(captions[activePreview][1]);
});

preview.src = `assets/${activePreview}${window.SnapkitI18n.language === 'vi' ? '-vi' : ''}.webp`;
preview.alt = t(captions[activePreview][0]);
