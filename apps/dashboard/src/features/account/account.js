const accountReady = (() => {
  if (window.SNAPKIT_PREVIEW || window.SNAPKIT_CONTROLLER) return Promise.resolve();
  const cloud = 'https://snapkit.vn';
  const accountOrigins = new Set([cloud, 'https://snapkit.45.119.214.94.sslip.io']);
  let token, polling = false, starting = false, checking = false, timer;
  const vi = () => window.SnapkitI18n?.language === 'vi';
  const words = (en, vn) => vi() ? vn : en;
  const errorText = error => error.message === 'Cannot connect to the Snapkit account service. Check your connection and try again.' ? words(error.message, 'Không thể kết nối dịch vụ tài khoản Snapkit. Kiểm tra kết nối mạng và thử lại.') : error.message;
  const gate = document.createElement('section'); gate.className = 'account-gate'; gate.setAttribute('aria-label', 'Snapkit sign in');
  gate.innerHTML = '<div class="account-card"><img src="/favicon.svg" width="56" height="56" alt="Snapkit"><p class="product-kicker">SNAPKIT BETA</p><h1></h1><p class="account-copy"></p><button class="button primary" id="google-signin"><svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.9-1.75 2.98-4.33 2.98-7.36Z"/><path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.62-2.41l-3.24-2.51c-.9.6-2.04.96-3.38.96-2.6 0-4.8-1.76-5.58-4.12H3.08v2.59A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.42 13.92a6 6 0 0 1 0-3.84V7.49H3.08a10 10 0 0 0 0 9.02l3.34-2.59Z"/><path fill="#EA4335" d="M12 5.96c1.47 0 2.79.51 3.83 1.51l2.87-2.87A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.92 5.49l3.34 2.59A5.9 5.9 0 0 1 12 5.96Z"/></svg><span class="google-signin-label"></span></button><button class="button" id="account-retry" hidden></button><p id="account-message" role="status" aria-live="polite"></p><div class="account-languages"><button class="button" data-account-lang="en">English</button><button class="button" data-account-lang="vi">Tiếng Việt</button></div></div>';
  document.body.append(gate); document.documentElement.classList.add('account-locked');
  const button = gate.querySelector('#google-signin'), message = gate.querySelector('#account-message'), retry = gate.querySelector('#account-retry');
  function render() {
    gate.querySelector('h1').textContent = words('Your devices. Your flow.', 'Thiết bị của bạn. Nhịp làm việc của bạn.');
    gate.querySelector('.account-copy').textContent = words('Sign in to your free Snapkit beta with Google.', 'Đăng nhập bằng Google để sử dụng Snapkit beta miễn phí.');
    button.querySelector('.google-signin-label').textContent = checking ? words('Checking connection…', 'Đang kiểm tra kết nối…') : starting ? words('Opening Google…', 'Đang mở Google…') : polling ? words('Waiting for sign-in…', 'Đang chờ đăng nhập…') : words('Continue with Google', 'Tiếp tục với Google');
    button.disabled = checking || starting || polling || !token;
    retry.textContent = checking ? words('Checking connection…', 'Đang kiểm tra kết nối…') : words('Check connection again', 'Kiểm tra kết nối lại');
    retry.disabled = checking;

  }
  render(); document.addEventListener('snapkit:language', render);
  gate.querySelectorAll('[data-account-lang]').forEach(b => b.onclick = () => window.SnapkitI18n.setLanguage(b.dataset.accountLang));
  async function api(route, body) {
    const res = await fetch('/api/auth/' + route, { method: body === undefined ? 'GET' : 'POST', signal: AbortSignal.timeout(15000), headers: { 'Content-Type': 'application/json', 'X-Snapkit-Token': token || '' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const data = await res.json(); if (!res.ok) throw Error(data.error || 'Unable to sign in'); return data;
  }
  function unlock(data) {
    document.documentElement.classList.remove('account-locked'); gate.remove();
    if (!data.user) return;
    setInterval(async () => { try { const status = await api('status'); if (!status.authenticated) location.reload(); } catch {} }, 60000);
    const profile = document.createElement('div'); profile.className = 'account-profile';
    const label = document.createElement('span'); label.textContent = data.user.name; label.title = data.user.email; profile.append(label);
    if (data.user.role === 'admin') { const admin = document.createElement('button'); admin.className = 'button'; admin.textContent = 'Admin'; admin.onclick = () => openBrowser(cloud + '/admin/'); profile.append(admin); }
    const out = document.createElement('button'); out.className = 'button'; const update = () => out.textContent = words('Sign out', 'Đăng xuất'); update(); document.addEventListener('snapkit:language', update);
    out.onclick = async () => { out.disabled = true; try { await api('logout', {}); location.reload(); } catch (e) { out.disabled = false; alert(e.message); } }; profile.append(out);
    document.querySelector('.topbar-right')?.append(profile);
    const avatar = document.querySelector('.avatar'); if (avatar) { avatar.textContent = data.user.name.slice(0, 1).toUpperCase(); avatar.setAttribute('aria-label', data.user.email); }
    fetch('/api/account/content').then(r => r.ok ? r.json() : null).then(content => {
      if (!content) return;
      const notice = document.createElement('div'); notice.id = 'admin-announcement'; notice.className = 'notice'; notice.setAttribute('role', 'status');
      const paint = () => {
        const raw = content.announcement?.[vi() ? 'vi' : 'en'];
        const text = typeof raw === 'string' ? raw.trim() : '';
        if (!text) { notice.remove(); return; }
        notice.textContent = text;
        if (!notice.isConnected) document.querySelector('main')?.prepend(notice);
      };
      paint(); document.addEventListener('snapkit:language', paint);
    }).catch(() => {});
  }
  async function openBrowser(raw) { const url = new URL(raw); if (!accountOrigins.has(url.origin) || url.username || url.password || !['/auth/google/start', '/admin/'].includes(url.pathname)) throw Error('Invalid sign-in URL'); if (window.snapkitDesktop) await window.snapkitDesktop.openExternal(url.href); else { const win = window.open(url.href, '_blank', 'noopener,noreferrer'); void win; } }
  async function check(fresh = false) {
    if (checking || starting || polling) return;
    checking = true; message.textContent = words('Checking connection…', 'Đang kiểm tra kết nối…'); render();
    try {
      const data = await api(fresh ? 'status?fresh=1' : 'status'); token = data.localToken;
      if (!data.required || data.authenticated) { unlock(data); return; }
      message.textContent = data.error || ''; retry.hidden = !data.error;
    } catch {
      message.textContent = words('Cannot connect to Snapkit. Check your connection and try again.', 'Không thể kết nối Snapkit. Kiểm tra kết nối và thử lại.'); retry.hidden = false;
    } finally { checking = false; render(); }
  }
  retry.onclick = () => check(true);
  button.onclick = async () => {
    if (polling || starting || checking || !token) return;
    starting = true; retry.hidden = true; render();
    try {
      const flow = await api('start', {}); await openBrowser(flow.browserUrl); polling = true; starting = false; render();
      message.textContent = words('Complete sign-in in your browser. You can return here afterwards.', 'Hoàn tất đăng nhập trong trình duyệt, sau đó quay lại Snapkit.');
      const deadline = Date.now() + flow.expiresIn * 1000;
      const poll = async () => { try { if (Date.now() > deadline) throw Error(words('Sign-in expired. Try again.', 'Phiên đăng nhập hết hạn. Hãy thử lại.')); const result = await api('poll', {}); if (result.authenticated) { location.reload(); return; } timer = setTimeout(poll, 3000); } catch (e) { polling = false; render(); message.textContent = errorText(e); } }; timer = setTimeout(poll, 3000);
    } catch (e) { starting = false; render(); message.textContent = errorText(e); }
  };
  window.addEventListener('pagehide', () => clearTimeout(timer)); return check();
})();

export { accountReady };
