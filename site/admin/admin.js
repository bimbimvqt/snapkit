(() => {
  const canonical = 'https://snapkit.45.119.214.94.sslip.io';
  if (location.hostname === 'bimbimvqt.github.io') { location.replace(canonical + '/admin/'); return; }
  const $ = s => document.querySelector(s); let content, offset = 0, total = 0;
  async function api(route, body) {
    const res = await fetch('/v1/' + route, { credentials: 'same-origin', method: body === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json', 'X-Snapkit-Request': '1' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const data = await res.json(); if (!res.ok) { const e = Error(res.status === 409 ? 'Nội dung đã đổi ở cửa sổ khác. Tải lại trước khi lưu.' : data.error); e.status = res.status; throw e; } return data;
  }
  const fail = error => { $('#error').textContent = error.message; if (error.status === 401) { $('#dashboard').hidden = true; $('#login').hidden = false; } };
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
  (async () => { try { const config = await api('auth/config'); const result = new URLSearchParams(location.search).get('auth'); if (!config.configured) { $('#login-message').textContent = 'Google OAuth chưa được cấu hình trên server.'; $('#login a').hidden = true; return; } if (result === 'failed') $('#login-message').textContent = 'Đăng nhập chưa hoàn tất hoặc tài khoản bị khóa. Hãy thử lại.'; const account = await api('account'); if (account.user.role !== 'admin') { $('#login-message').textContent = 'Tài khoản này không có quyền quản trị.'; $('#logout').hidden = false; return; } $('#identity').textContent = account.user.email; $('#logout').hidden = false; await overview(); await users(); $('#login').hidden = true; $('#dashboard').hidden = false; } catch (e) { if (e.status !== 401) fail(e); } })();
})();
