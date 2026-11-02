(() => {
  if (window.SNAPKIT_PREVIEW || window.SNAPKIT_CONTROLLER) return;
  const cloud = 'https://snapkit.45.119.214.94.sslip.io';
  let token, polling = false, timer;
  const vi = () => window.SnapkitI18n?.language === 'vi';
  const words = (en, vn) => vi() ? vn : en;
  const gate = document.createElement('section'); gate.className = 'account-gate'; gate.setAttribute('aria-label', 'Snapkit sign in');
  gate.innerHTML = '<div class="account-card"><img src="/favicon.svg" width="56" height="56" alt="Snapkit"><p class="product-kicker">SNAPKIT BETA</p><h1></h1><p class="account-copy"></p><button class="button primary" id="google-signin"></button><button class="button" id="account-retry" hidden></button><p id="account-message" role="status" aria-live="polite"></p><small></small><div class="account-languages"><button class="button" data-account-lang="en">English</button><button class="button" data-account-lang="vi">Tiếng Việt</button></div></div>';
  document.body.append(gate); document.documentElement.classList.add('account-locked');
  const button = gate.querySelector('#google-signin'), message = gate.querySelector('#account-message'), retry = gate.querySelector('#account-retry');
  function render() {
    gate.querySelector('h1').textContent = words('Your devices. Your flow.', 'Thiết bị của bạn. Nhịp làm việc của bạn.');
    gate.querySelector('.account-copy').textContent = words('Sign in to your free Snapkit beta with Google.', 'Đăng nhập bằng Google để sử dụng Snapkit beta miễn phí.');
    button.textContent = words('Continue with Google', 'Tiếp tục với Google'); retry.textContent = words('Check connection again', 'Kiểm tra kết nối lại');
    gate.querySelector('small').textContent = words('Your source code stays on this computer. Internet is required to verify your account. No payment required.', 'Source code được giữ trên máy. Cần internet để xác thực tài khoản. Không yêu cầu thanh toán.');
  }
  render(); document.addEventListener('snapkit:language', render);
  gate.querySelectorAll('[data-account-lang]').forEach(b => b.onclick = () => window.SnapkitI18n.setLanguage(b.dataset.accountLang));
  async function api(route, body) {
    const res = await fetch('/api/auth/' + route, { method: body === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json', 'X-Snapkit-Token': token || '' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
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
    fetch('/api/account/content').then(r => r.ok ? r.json() : null).then(content => { if (!content) return; const notice = document.createElement('div'); notice.className = 'notice'; const paint = () => { notice.textContent = content.announcement[vi() ? 'vi' : 'en']; notice.hidden = !notice.textContent; }; paint(); document.addEventListener('snapkit:language', paint); document.querySelector('main')?.prepend(notice); }).catch(() => {});
  }
  async function openBrowser(raw) { const url = new URL(raw); if (url.origin !== cloud || !['/auth/google/start', '/admin/'].includes(url.pathname)) throw Error('Invalid sign-in URL'); if (window.snapkitDesktop) await window.snapkitDesktop.openExternal(url.href); else { const win = window.open(url.href, '_blank', 'noopener,noreferrer'); void win; } }
  async function check() { retry.hidden = true; try { const data = await api('status'); token = data.localToken; if (!data.required || data.authenticated) unlock(data); else message.textContent = data.error || ''; } catch { message.textContent = words('Cannot connect to Snapkit. Check your connection and try again.', 'Không thể kết nối Snapkit. Kiểm tra kết nối và thử lại.'); retry.hidden = false; } }
  retry.onclick = check;
  button.onclick = async () => {
    if (polling) return;
    button.disabled = true;
    try {
      const flow = await api('start', {}); await openBrowser(flow.browserUrl); polling = true;
      message.textContent = words('Complete sign-in in your browser. You can return here afterwards.', 'Hoàn tất đăng nhập trong trình duyệt, sau đó quay lại Snapkit.');
      const deadline = Date.now() + flow.expiresIn * 1000;
      const poll = async () => { try { if (Date.now() > deadline) throw Error(words('Sign-in expired. Try again.', 'Phiên đăng nhập hết hạn. Hãy thử lại.')); const result = await api('poll', {}); if (result.authenticated) { location.reload(); return; } timer = setTimeout(poll, 3000); } catch (e) { polling = false; button.disabled = false; message.textContent = e.message; } }; timer = setTimeout(poll, 3000);
    } catch (e) { button.disabled = false; message.textContent = e.message; }
  };
  window.addEventListener('pagehide', () => clearTimeout(timer)); check();
})();
