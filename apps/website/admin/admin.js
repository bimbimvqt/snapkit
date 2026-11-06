(() => {
  const canonical = 'https://snapkit.vn';
  if (location.hostname === 'bimbimvqt.github.io') { location.replace(canonical + '/admin/'); return; }
  const $ = s => document.querySelector(s); let content, offset = 0, total = 0;
  async function api(route, body) {
    const res = await fetch('/v1/' + route, { credentials: 'same-origin', method: body === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json', 'X-Snapkit-Request': '1' }, signal: AbortSignal.timeout(15000), ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const data = await res.json(); if (!res.ok) { const e = Error(res.status === 409 ? 'Nội dung đã đổi ở cửa sổ khác. Tải lại trước khi lưu.' : data.error); e.status = res.status; throw e; } return data;
  }
  function authState(state, message = '') {
    document.body.dataset.view = 'auth'; $('#login').hidden = false; $('#dashboard').hidden = true;
    $('#auth-status').hidden = !message; $('#auth-status').dataset.state = state; $('#login-message').textContent = message;
    $('#auth-spinner').hidden = state !== 'loading';
    $('#google-login').hidden = !['ready', 'failed'].includes(state);
    $('#auth-retry').hidden = !['error', 'unavailable'].includes(state);
    $('#switch-account').hidden = state !== 'denied';
  }
  const fail = error => { if (error.status === 401) { authState('ready', 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'); } else { $('#error').textContent = error.message; } };
  function fill() { const form = $('#content'); for (const lang of ['en','vi']) { form.elements['headline-' + lang].value = content.landing[lang].headline; form.elements['description-' + lang].value = content.landing[lang].description; form.elements['announcement-' + lang].value = content.announcement[lang]; } form.elements.version.value = content.recommendedVersion; form.elements.registration.checked = content.registrationOpen; }
  async function overview() {
    const data = await api('admin/overview'); content = data.content; fill(); $('#stats').replaceChildren();
    for (const [label,value] of [['Tổng tài khoản',data.users],['Được phép truy cập',data.activeUsers],['Phiên đăng nhập',data.sessions]]) { const card = document.createElement('div'); card.className = 'card'; card.textContent = label; const number = document.createElement('strong'); number.textContent = value; card.append(number); $('#stats').append(card); }
    $('#audit').replaceChildren(); for (const entry of data.audit) { const row = document.createElement('p'); row.textContent = new Date(entry.at).toLocaleString('vi-VN') + ' · ' + entry.action + ' · ' + entry.actor + (entry.target ? ' → ' + entry.target : ''); $('#audit').append(row); }
  }
  async function users() {
    const data = await api('admin/users?search=' + encodeURIComponent($('#query').value) + '&offset=' + offset); total = data.total; $('#users').replaceChildren(); $('#users-message').textContent = total ? total + ' tài khoản' : 'Chưa có tài khoản phù hợp.';
    for (const user of data.users) {
      const row = document.createElement('tr'); const name = document.createElement('td'); name.textContent = user.name; const email = document.createElement('small'); email.textContent = user.email; name.append(email); row.append(name);
      for (const value of [user.role === 'admin' ? 'Quản trị' : 'Người dùng', user.disabled ? 'Đã khóa' : 'Hoạt động']) { const cell = document.createElement('td'); cell.textContent = value; row.append(cell); }
      const action = document.createElement('td'); if (user.role !== 'admin') { const button = document.createElement('button'); button.textContent = user.disabled ? 'Mở khóa' : 'Khóa truy cập'; button.onclick = async () => { if (!confirm((user.disabled ? 'Mở khóa ' : 'Khóa truy cập ') + user.email + '?')) return; button.disabled = true; try { await api('admin/users/access', { id: user.id, disabled: !user.disabled }); await users(); } catch (e) { fail(e); button.disabled = false; } }; action.append(button); } row.append(action); $('#users').append(row);
    }
    $('#previous').disabled = offset === 0; $('#next').disabled = offset + 50 >= total; $('#page').textContent = 'Trang ' + (offset / 50 + 1);
  }
  $('#content').onsubmit = async event => { event.preventDefault(); const button = event.submitter; button.disabled = true; $('#save-message').textContent = ''; $('#error').textContent = ''; const form = event.target; const next = structuredClone(content); for (const lang of ['en','vi']) { next.landing[lang] = { headline: form.elements['headline-' + lang].value, description: form.elements['description-' + lang].value }; next.announcement[lang] = form.elements['announcement-' + lang].value; } next.recommendedVersion = form.elements.version.value.trim(); next.registrationOpen = form.elements.registration.checked; try { content = (await api('admin/content', next)).content; $('#save-message').textContent = 'Đã xuất bản nội dung.'; } catch (e) { fail(e); } finally { button.disabled = false; } };
  $('#reload').onclick = () => overview().catch(fail);
  $('#search').onsubmit = event => { event.preventDefault(); offset = 0; users().catch(fail); };
  $('#previous').onclick = () => { offset = Math.max(0, offset - 50); users().catch(fail); }; $('#next').onclick = () => { offset += 50; users().catch(fail); };
  $('#logout').onclick = () => api('auth/logout', {}).then(() => location.reload()).catch(fail);
  async function checkSession() {
    authState('loading', 'Đang kiểm tra phiên đăng nhập…'); $('#error').textContent = '';
    try {
      const config = await api('auth/config');
      if (!config.configured) { authState('unavailable', 'Đăng nhập đang được thiết lập. Vui lòng thử lại sau.'); return; }
      const result = new URLSearchParams(location.search).get('auth');
      let account;
      try { account = await api('account'); } catch (error) {
        if (error.status !== 401) throw error;
        authState(result === 'failed' ? 'failed' : 'ready', result === 'failed' ? 'Chưa thể đăng nhập. Vui lòng thử lại với tài khoản được cấp quyền.' : ''); return;
      }
      $('#identity').textContent = account.user.email; $('#logout').hidden = false;
      if (account.user.role !== 'admin') { authState('denied', 'Tài khoản ' + account.user.email + ' chưa được cấp quyền quản trị. Hãy sử dụng tài khoản khác.'); return; }
      await overview(); await users(); $('#login').hidden = true; $('#dashboard').hidden = false; document.body.dataset.view = 'dashboard';
    } catch (error) {
      if (error.status === 401) authState('ready', 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
      else if (error.status === 403) authState('denied', 'Tài khoản này chưa được cấp quyền quản trị. Hãy sử dụng tài khoản khác.');
      else authState('error', 'Chưa thể kết nối Snapkit. Kiểm tra kết nối mạng rồi thử lại.');
    }
  }
  $('#auth-retry').onclick = checkSession;
  $('#switch-account').onclick = async () => {
    const button = $('#switch-account'); button.disabled = true;
    try { await api('auth/logout', {}); location.assign('/auth/google/start'); }
    catch { authState('denied', 'Chưa thể đổi tài khoản. Vui lòng thử lại.'); button.disabled = false; }
  };
  $('#google-login').onclick = event => {
    const link = event.currentTarget;
    if (link.getAttribute('aria-disabled') === 'true') { event.preventDefault(); return; }
    link.setAttribute('aria-disabled', 'true'); link.querySelector('span').textContent = 'Đang mở Google…';
  };
  window.addEventListener('pageshow', () => { $('#google-login').removeAttribute('aria-disabled'); $('#google-login span').textContent = 'Tiếp tục với Google'; });
  checkSession();
})();
