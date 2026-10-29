document.querySelector('#copy-install').addEventListener('click', async () => {
  const status = document.querySelector('#copy-status');
  try {
    await navigator.clipboard.writeText(document.querySelector('#install-command').textContent);
    status.textContent = 'Đã sao chép. Dán vào Terminal để cài đặt.';
  } catch {
    status.textContent = 'Hãy chọn và sao chép các lệnh phía trên.';
  }
});
