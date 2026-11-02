document.querySelector('#copy-install').addEventListener('click', async () => {
  const status = document.querySelector('#copy-status');
  try {
    await navigator.clipboard.writeText(document.querySelector('#install-command').textContent);
    status.textContent = 'Đã sao chép. Dán vào Terminal để cài đặt.';
  } catch {
    status.textContent = 'Hãy chọn và sao chép các lệnh phía trên.';
  }
});

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
    if (status) status.textContent = count === 3 ? 'Bản desktop beta đã sẵn sàng. Chọn đúng loại máy của bạn.' : 'Gói desktop đang được chuẩn bị. Xem tiến độ và các bản tải có sẵn tại GitHub Releases.';
  } catch { const status = document.querySelector('#download-status'); if (status) status.textContent = 'Không thể kiểm tra phiên bản lúc này. Bạn vẫn có thể xem các bản tải tại GitHub Releases.'; }
}
loadDesktopDownloads();
