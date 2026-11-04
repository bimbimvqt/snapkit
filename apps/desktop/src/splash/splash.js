(() => {
  const vi = new URLSearchParams(location.search).get('lang') === 'vi';
  document.documentElement.lang = vi ? 'vi' : 'en';
  document.querySelector('#tagline').textContent = vi ? 'Thiết bị của bạn. Nhịp làm việc của bạn.' : 'Your devices. Your flow.';
  document.querySelector('#loading-label').textContent = vi ? 'Đang mở không gian làm việc…' : 'Opening your workspace…';
})();
