(() => {
  if (location.hostname === 'bimbimvqt.github.io') { location.replace('https://snapkit.vn/admin/'); return; }
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const roles = {
    admin:{label:'Quản trị viên',description:'Quản lý tài khoản, phân quyền, nội dung và đánh giá.',permissions:['overview.read','users.read','users.manage','roles.manage','content.read','content.write','feedback.read','feedback.manage','audit.read','teams.read']},
    editor:{label:'Biên tập viên',description:'Biên tập và xuất bản nội dung website, thông báo ứng dụng.',permissions:['overview.read','content.read','content.write']},
    moderator:{label:'Kiểm duyệt viên',description:'Xử lý góp ý và duyệt hoặc ẩn đánh giá công khai.',permissions:['overview.read','feedback.read','feedback.manage']},
    viewer:{label:'Người xem',description:'Xem tổng quan, nội dung, tài khoản và góp ý; không chỉnh sửa.',permissions:['overview.read','users.read','content.read','feedback.read','audit.read','teams.read']}
  };
  const pages = {
    overview:['Tổng quan','Theo dõi sản phẩm và những điều cần bạn quan tâm.','overview.read'],
    teams:['Snapkit Teams','Theo dõi workspace dùng chung và mức sử dụng. Quyền quản trị nền tảng độc lập với quyền trong team.','teams.read'],
    feedback:['Đánh giá & góp ý','Lắng nghe người dùng. Xử lý góp ý và duyệt những trải nghiệm được chia sẻ.','feedback.read'],
    users:['Tài khoản','Quản lý người dùng, vai trò và quyền truy cập Snapkit.','users.read'],
    content:['Nội dung sản phẩm','Biên tập thông điệp website và thông báo bằng hai ngôn ngữ.','content.read'],
    roles:['Vai trò & phân quyền','Đúng người. Đúng phạm vi công việc.','roles.manage'],
    audit:['Nhật ký hoạt động','Theo dõi ai đã thay đổi nội dung, quyền truy cập và đánh giá.','audit.read','teams.read']
  };
  const typeLabels = {review:'Đánh giá',bug:'Báo lỗi',feature:'Đề xuất tính năng',other:'Góp ý khác'};
  const moderationLabels = {approved:'Đã duyệt · Đang hiển thị',rejected:'Không công khai',pending:'Chờ duyệt'};
  const progressLabels = {new:'Mới',reviewing:'Đang xem xét',done:'Đã xử lý'};
  let account, permissions = new Set(), content, contentLoaded = false, contentBusy = false, contentPromise, contentDirty = false, currentPage = 'overview', offset = 0, total = 0, feedbackOffset = 0, feedbackEntries = [], selectedFeedbackId, feedbackEpoch = 0, loadEpoch = 0;
  const can = permission => permissions.has(permission);
  const icon = name => `<svg class="admin-icon" aria-hidden="true"><use href="icons.svg?v=20261106-icons#${name}"></use></svg>`;
  function paintAvatar(node,user){
    node.replaceChildren();node.textContent=(user.name||user.email||'S').slice(0,1).toUpperCase();node.setAttribute('aria-hidden','true');
    const source=user.avatarImage;
    if(typeof source==='string'&&/^data:image\/(svg\+xml|png|jpeg|webp)[;,]/.test(source)){const image=document.createElement('img');image.alt='';image.src=source;image.loading='lazy';image.onerror=()=>{node.textContent=(user.name||user.email||'S').slice(0,1).toUpperCase();};node.replaceChildren(image);}
  }
  const date = value => value && !Number.isNaN(Date.parse(value)) ? new Date(value).toLocaleString('vi-VN',{dateStyle:'short',timeStyle:'short'}) : 'Chưa có dữ liệu';
  function empty(node,text) { node.innerHTML = icon('inbox'); node.classList.add('has-empty'); const message = document.createElement('p'); message.className='empty-state';message.textContent=text;node.append(message); }
  async function api(route, body) {
    const response = await fetch('/v1/' + route,{credentials:'same-origin',method:body === undefined?'GET':'POST',headers:{'Content-Type':'application/json','X-Snapkit-Request':'1'},signal:AbortSignal.timeout(15000),...(body===undefined?{}:{body:JSON.stringify(body)})});
    const data = await response.json();
    if (!response.ok) { const error = Error(response.status === 409 && route === 'admin/content' ? 'Nội dung đã đổi ở cửa sổ khác. Tải lại trước khi lưu.' : response.status === 403 ? 'Bạn không có quyền thực hiện thao tác này. Quyền truy cập có thể vừa thay đổi.' : data.error || 'Chưa thể kết nối. Vui lòng thử lại.'); error.status=response.status;throw error; }
    return data;
  }
  function authState(state,message='') {
    setMenu(false);document.body.dataset.view='auth';$('#login').hidden=false;$('#dashboard').hidden=true;$('#admin-menu').hidden=true;
    $('#auth-status').hidden=!message;$('#auth-status').dataset.state=state;$('#login-message').textContent=message;$('#auth-spinner').hidden=state!=='loading';
    $('#google-login').hidden=!['ready','failed'].includes(state);$('#auth-retry').hidden=!['error','unavailable'].includes(state);$('#switch-account').hidden=state!=='denied';
  }
  function fail(error) { if(error.status===401)authState('ready','Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');else { const node=$('#error');node.replaceChildren();const message=document.createElement('span');message.textContent=error.message;const close=document.createElement('button');close.type='button';close.textContent='Đóng';close.onclick=()=>node.replaceChildren();node.append(message,close); } }
  function setMenu(open) {
    open = open && matchMedia('(max-width:700px)').matches;
    document.body.dataset.navOpen=String(open);$('#nav-backdrop').hidden=!open;$('#admin-menu').setAttribute('aria-expanded',String(open));$('.admin-workspace').inert=open;
    if(open)$('.admin-sidebar [aria-current=page]')?.focus();
  }
  $('#admin-menu').onclick=()=>setMenu(document.body.dataset.navOpen!=='true');$('#nav-backdrop').onclick=()=>setMenu(false);
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&document.body.dataset.navOpen==='true'){setMenu(false);$('#admin-menu').focus();}});
  matchMedia('(max-width:700px)').addEventListener('change',()=>setMenu(false));
  function applyPermissions() {
    $$('[data-permission]').forEach(node=>{node.hidden=!can(node.dataset.permission);});
    $$('#content input,#content textarea').forEach(node=>{node.disabled=!can('content.write')||!contentLoaded||contentBusy;});
    $('#content').elements.registration.disabled=!can('users.manage')||!contentLoaded||contentBusy;
    $('#content button[type=submit]').disabled=!can('content.write')||!contentLoaded||contentBusy;
    $('#registration-note').textContent=can('content.write')?'Cài đặt truy cập chỉ dành cho Quản trị viên.':'Bạn đang ở chế độ chỉ xem. Không thể xuất bản hoặc chỉnh sửa nội dung.';
  }
  async function showPanel(key,push=false) {
    if(!pages[key]||!can(pages[key][2]))key='overview';
    currentPage=key;setMenu(false);$('#error').textContent='';
    $$('[data-admin-panel]').forEach(node=>{node.hidden=node.dataset.adminPanel!==key;});
    $$('.admin-sidebar [data-admin-page]').forEach(node=>node.setAttribute('aria-current',node.dataset.adminPage===key?'page':'false'));
    $('#page-title').textContent=pages[key][0];$('#page-breadcrumb').textContent=pages[key][0].toUpperCase();$('#page-description').textContent=pages[key][1];
    if(push&&location.hash!=='#'+key)history.pushState(null,'','#'+key);
    const epoch=++loadEpoch;$('#panel-loading').hidden=false;$('#panel-error').hidden=true;
    $(`[data-admin-panel="${key}"]`).setAttribute('aria-busy','true');
    if(push){$('#page-title').focus({preventScroll:true});window.scrollTo({top:0,behavior:'instant'});}
    try { await ({overview,teams,feedback,users,content:loadContent,roles:loadRoles,audit:loadAudit}[key])(); }
    catch(error) { if(epoch===loadEpoch){if(error.status===401)fail(error);else{$('#panel-error span').textContent=error.message;$('#panel-error').hidden=false;}} }
    finally { if(epoch===loadEpoch){$('#panel-loading').hidden=true;$(`[data-admin-panel="${key}"]`).removeAttribute('aria-busy');} }
  }
  $$('[data-admin-page]').forEach(button=>{button.onclick=()=>void showPanel(button.dataset.adminPage,true);});
  window.addEventListener('popstate',()=>{if(account)void showPanel(location.hash.slice(1));});
  $('#panel-retry').onclick=()=>void showPanel(currentPage);
  function renderStats(items) {
    $('#stats').replaceChildren();
    for(const [label,value,note,symbol]of items){const card=document.createElement('div');card.className='stat-card';card.innerHTML=icon(symbol);for(const [tag,text]of [['span',label],['strong',value],['small',note]]){const node=document.createElement(tag);node.textContent=text;card.append(node);}$('#stats').append(card);}
  }
  let teamsOffset = 0;
  async function teams() {
    const data = await api('admin/teams?search='+encodeURIComponent($('#teams-query').value)+'&offset='+teamsOffset);
    $('#teams-summary').textContent = `${data.totals.workspaces} workspace · ${data.totals.memberships} thành viên (theo workspace) · ${data.totals.projects} project · ${data.totals.devices} thiết bị · ${data.totals.handoffs} bàn giao · ${data.totals.tasks||0} task · ${data.totals.activeDebugSessions||0} phiên debug đang hoạt động`;
    const body = $('#teams-list');body.replaceChildren();
    for (const entry of data.entries) {
      const row = document.createElement('tr');
      for (const value of [entry.name,entry.members,entry.projects,entry.devices,entry.reservations,entry.handoffs,date(entry.updatedAt)]) {
        const cell = document.createElement('td');cell.textContent=String(value);row.append(cell);
      }
      body.append(row);
    }
    if (!data.entries.length) {const row=document.createElement('tr'),cell=document.createElement('td');cell.colSpan=7;cell.textContent='Chưa có workspace phù hợp.';row.append(cell);body.append(row);}
    $('#teams-page').textContent=`${data.total} workspace · Trang ${Math.floor(teamsOffset/50)+1}`;
    $('#teams-previous').disabled=teamsOffset===0;$('#teams-next').disabled=teamsOffset+50>=data.total;
  }
  $('#teams-search').onsubmit=event=>{event.preventDefault();teamsOffset=0;void showPanel('teams');};
  $('#teams-previous').onclick=()=>{teamsOffset=Math.max(0,teamsOffset-50);void showPanel('teams');};
  $('#teams-next').onclick=()=>{teamsOffset+=50;void showPanel('teams');};
  async function overview() {
    const data=await api('admin/overview');const feedback=data.feedback||{};
    if(can('users.read'))renderStats([['Tổng tài khoản',data.users,'Đã đăng nhập Snapkit','users'],['Được phép truy cập',data.activeUsers,'Tài khoản đang hoạt động','shield'],['Chờ duyệt công khai',feedback.pending??0,'Đánh giá được cho phép chia sẻ','inbox'],['Đánh giá công khai',feedback.published??0,'Đang hiển thị trên website','grid']]);
    else if(can('feedback.read'))renderStats([['Tổng góp ý',feedback.total??0,'Tất cả loại góp ý','inbox'],['Chưa hoàn tất',feedback.open??0,'Cần được xử lý','history'],['Chờ duyệt công khai',feedback.pending??0,'Đã có sự đồng ý chia sẻ','shield'],['Đã công khai',feedback.published??0,'Đánh giá trên website','grid']]);
    else renderStats([['Ngôn ngữ nội dung',2,'Tiếng Việt và English','content'],['Phiên bản nội dung',data.content?.revision??0,'Bản đã lưu trên máy chủ','history'],['Thông báo',Object.values(data.content?.announcement||{}).filter(value=>value.trim()).length,'Số ngôn ngữ có thông báo','inbox'],['Đăng ký mới',data.content?.registrationOpen?'Mở':'Đóng','Theo cài đặt Quản trị viên','users']]);
    $('#pending-badge').hidden=!feedback.pending;$('#pending-badge').textContent=feedback.pending||'';
    $('#overview-role').textContent=roles[account.user.role].label;$('#overview-permission-description').textContent=roles[account.user.role].description;$('#overview-owner-note').hidden=!account.user.isOwner;
  }
  function updateDraftState(dirty) {contentDirty=dirty;$('#content-draft-state').dataset.dirty=String(dirty);$('#content-draft-state').textContent=dirty?'Thay đổi chưa lưu':'Đã đồng bộ';}
  function fillContent() {
    const form=$('#content');for(const language of ['en','vi']){form.elements['headline-'+language].value=content.landing[language].headline;form.elements['description-'+language].value=content.landing[language].description;form.elements['announcement-'+language].value=content.announcement[language];}form.elements.version.value=content.recommendedVersion;form.elements.registration.checked=content.registrationOpen;updateDraftState(false);applyPermissions();
  }
  async function loadContent(force=false) {
    if(contentLoaded&&!force)return;if(contentPromise)return contentPromise;contentBusy=true;applyPermissions();
    contentPromise=api('admin/content').then(data=>{content=data.content;contentLoaded=true;fillContent();}).finally(()=>{contentBusy=false;contentPromise=null;applyPermissions();});
    return contentPromise;
  }
  $('#content').addEventListener('input',()=>updateDraftState(true));
  $('#content').onsubmit=async event=>{event.preventDefault();if(!can('content.write'))return;const button=event.submitter;button.disabled=true;$('#save-message').textContent='Đang xuất bản…';$('#error').textContent='';const form=event.target;const next=structuredClone(content);for(const language of ['en','vi']){next.landing[language]={headline:form.elements['headline-'+language].value,description:form.elements['description-'+language].value};next.announcement[language]=form.elements['announcement-'+language].value;}next.recommendedVersion=form.elements.version.value.trim();next.registrationOpen=form.elements.registration.checked;try{content=(await api('admin/content',next)).content;updateDraftState(false);$('#save-message').textContent='Đã xuất bản nội dung.';}catch(error){$('#save-message').textContent='Chưa lưu. Các thay đổi vẫn được giữ lại.';fail(error);}finally{button.disabled=false;}};
  $('#reload').onclick=async()=>{if(contentDirty&&!await confirmAction('Tải lại nội dung?','Các thay đổi chưa lưu trong biểu mẫu sẽ được thay bằng nội dung trên máy chủ.','Tải lại'))return;loadContent(true).catch(fail);};
  function confirmAction(title,description,label='Xác nhận') {
    const dialog=$('#action-dialog');$('#action-title').textContent=title;$('#action-description').textContent=description;$('#action-confirm').textContent=label;
    return new Promise(resolve=>{let settled=false;const done=value=>{if(settled)return;settled=true;dialog.close();resolve(value);};$('#action-confirm').onclick=()=>done(true);$('#action-cancel').onclick=()=>done(false);dialog.oncancel=event=>{event.preventDefault();done(false);};dialog.showModal();$('#action-cancel').focus();});
  }
  function renderFeedbackDetail(entry) {
    $('#feedback-inbox').replaceChildren();
    if (!entry) { empty($('#feedback-inbox'),'Chọn một góp ý để xem chi tiết.'); return; }
      const card = document.createElement('article'); card.className = 'feedback-entry';
      const heading = document.createElement('h3'); heading.textContent = ({review:'Đánh giá',bug:'Báo lỗi',feature:'Đề xuất tính năng',other:'Góp ý khác'}[entry.type] || entry.type);
      const meta = document.createElement('p'); meta.className = 'feedback-meta'; meta.textContent = [entry.name, entry.email, new Date(entry.createdAt).toLocaleString('vi-VN')].filter(Boolean).join(' · ');
      const message = document.createElement('p'); message.className = 'feedback-body'; message.textContent = entry.message;
      card.append(heading);
      if (entry.type === 'review' && entry.rating) {
        const stars = document.createElement('span'); stars.className = 'rating-stars'; stars.setAttribute('role','img'); stars.setAttribute('aria-label',entry.rating + '/5 sao');
        stars.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.78 5.63 6.22.9-4.5 4.39 1.06 6.2L12 17.19l-5.56 2.93 1.06-6.2L3 9.53l6.22-.9z"/></svg>'.repeat(5);
        [...stars.children].forEach((star,index) => star.classList.toggle('filled',index < entry.rating)); card.append(stars);
      }
      card.append(meta,message);
      if (entry.type !== 'review') {
      const controls = document.createElement('div'); controls.className = 'feedback-controls';
      const label = document.createElement('span'); label.id = 'feedback-status-' + entry.id; label.className = 'feedback-control-label'; label.textContent = 'Tiến độ xử lý';
      const select = document.createElement('snapkit-select'); select.configure({ labelledby:label.id, value:entry.status, items:[{value:'new',label:'Mới'},{value:'reviewing',label:'Đang xem xét'},{value:'done',label:'Đã xử lý'}], onChange: async value => {
        select.disabled = true;
        try { await api('admin/feedback/status',{id:entry.id,status:value}); entry.status = value; await feedback(); void overview().catch(() => {}); }
        catch (e) { select.value = entry.status; fail(e); }
        finally { select.disabled = false; }
      } });
      select.disabled = !can('feedback.manage');
      controls.append(label,select); card.append(controls);
      }
      if (entry.type === 'review') {
        const moderation = document.createElement('div'); moderation.className = 'review-moderation';
        const badge = document.createElement('span'); badge.className = 'moderation-badge'; badge.dataset.state = entry.moderation || 'pending';
        badge.textContent = moderationLabels[entry.moderation || 'pending'];
        moderation.append(badge);
        const note = document.createElement('p'); note.className = 'moderation-note';
        note.textContent = entry.publishConsent ? 'Người gửi đồng ý công khai tên, nội dung và số sao. Email được giữ riêng.' : 'Đánh giá riêng tư: người gửi chưa đồng ý công khai.';
        moderation.append(note);
        const actions = document.createElement('div'); actions.className = 'moderation-actions';
        const status = document.createElement('p'); status.setAttribute('role','status');
        const addAction = (text, value, primary = false) => {
          const button = document.createElement('button'); button.type = 'button'; button.textContent = text; if (primary) button.className = 'primary';
          button.onclick = async () => {
            actions.querySelectorAll('button').forEach(node => { node.disabled = true; }); status.textContent = 'Đang lưu…';
            try { await api('admin/feedback/moderation',{id:entry.id,moderation:value}); await feedback(); void overview().catch(() => {}); }
            catch (e) { status.textContent = 'Chưa thể cập nhật. Vui lòng thử lại.'; actions.querySelectorAll('button').forEach(node => { node.disabled = false; }); fail(e); }
          }; actions.append(button);
        };
        if (!can('feedback.manage')) { /* View-only users see the moderation state. */ }
        else if (entry.moderation === 'approved') addAction('Ẩn khỏi landing page','pending');
        else {
          if (entry.publishConsent) addAction('Duyệt & hiển thị','approved',true);
          if (entry.moderation !== 'rejected') addAction('Không công khai','rejected');
          else addAction('Đưa về chờ duyệt','pending');
        }
        moderation.append(actions,status); card.append(moderation);
      }
      $('#feedback-inbox').append(card);
  }
  async function feedback() {
    const reviewOnly=$('#feedback-filter-type').value==='review';
    $('#feedback-filter-status').parentElement.hidden=reviewOnly;
    if(reviewOnly)$('#feedback-filter-status').value='all';
    const epoch=++feedbackEpoch;const params=new URLSearchParams({offset:String(feedbackOffset),search:$('#feedback-query').value,type:$('#feedback-filter-type').value,status:$('#feedback-filter-status').value,moderation:$('#feedback-filter-moderation').value});
    $('#feedback-list').setAttribute('aria-busy','true');
    try {
      const data=await api('admin/feedback?'+params);if(epoch!==feedbackEpoch)return;
      feedbackEntries=data.entries;$('#feedback-count').textContent=data.total+' góp ý phù hợp · Chỉ đánh giá được duyệt mới hiển thị công khai.';
      $('#feedback-list').replaceChildren();
      if(!feedbackEntries.some(entry=>entry.id===selectedFeedbackId))selectedFeedbackId=feedbackEntries[0]?.id;
      for(const entry of feedbackEntries){const row=document.createElement('button');row.type='button';row.className='inbox-row';row.setAttribute('aria-pressed',String(entry.id===selectedFeedbackId));
        const top=document.createElement('div');top.className='inbox-row-top';const type=document.createElement('span');type.className='inbox-type';type.textContent=typeLabels[entry.type]||entry.type;const time=document.createElement('time');time.textContent=date(entry.createdAt);top.append(type,time);
        const name=document.createElement('strong');name.textContent=entry.name||'Người dùng Snapkit';const message=document.createElement('p');message.textContent=entry.message;const state=document.createElement('small');state.textContent=entry.type==='review'?moderationLabels[entry.moderation||'pending']:progressLabels[entry.status]||'Mới';
        row.append(top,name,message,state);row.onclick=()=>{selectedFeedbackId=entry.id;$$('.inbox-row').forEach(node=>node.setAttribute('aria-pressed',String(node===row)));renderFeedbackDetail(entry);};$('#feedback-list').append(row);
      }
      renderFeedbackDetail(feedbackEntries.find(entry=>entry.id===selectedFeedbackId));
      if(!feedbackEntries.length)empty($('#feedback-list'),'Chưa có góp ý phù hợp.');
      $('#feedback-previous').disabled=feedbackOffset===0;$('#feedback-next').disabled=feedbackOffset+50>=data.total;$('#feedback-page').textContent='Trang '+(feedbackOffset/50+1);
    } finally {if(epoch===feedbackEpoch)$('#feedback-list').removeAttribute('aria-busy');}
  }
  const resetFeedback=()=>{feedbackOffset=0;feedback().catch(fail);};
  for(const [id,labelledby,items]of [
    ['feedback-filter-type','feedback-filter-type-label',[['all','Tất cả góp ý'],['review','Đánh giá'],['bug','Báo lỗi'],['feature','Đề xuất tính năng'],['other','Góp ý khác']]],
    ['feedback-filter-status','feedback-filter-status-label',[['all','Tất cả tiến độ'],['new','Mới'],['reviewing','Đang xem xét'],['done','Đã xử lý']]],
    ['feedback-filter-moderation','feedback-filter-moderation-label',[['all','Tất cả trạng thái'],['pending','Chờ duyệt'],['approved','Đã công khai'],['rejected','Không công khai']]]
  ])$('#'+id).configure({value:'all',labelledby,items:items.map(([value,label])=>({value,label})),onChange:resetFeedback});
  $('#feedback-search').onsubmit=event=>{event.preventDefault();resetFeedback();};$('#feedback-reload').onclick=()=>feedback().catch(fail);
  $('#feedback-previous').onclick=()=>{feedbackOffset=Math.max(0,feedbackOffset-50);feedback().catch(fail);};$('#feedback-next').onclick=()=>{feedbackOffset+=50;feedback().catch(fail);};
  async function users() {
    const data=await api('admin/users?search='+encodeURIComponent($('#query').value)+'&offset='+offset);total=data.total;$('#users').replaceChildren();$('#users-message').textContent=total?total+' tài khoản':'Chưa có tài khoản phù hợp.';
    for(const user of data.users){
      const row=document.createElement('tr');const identity=document.createElement('td');const name=document.createElement('div');name.className='account-name';const avatar=document.createElement('span');avatar.className='account-avatar';paintAvatar(avatar,user);const nameCopy=document.createElement('div');const strong=document.createElement('strong');strong.textContent=user.name||'Người dùng';const email=document.createElement('small');email.textContent=user.email;nameCopy.append(strong,email);name.append(avatar,nameCopy);identity.append(name);row.append(identity);
      const roleCell=document.createElement('td');roleCell.className='account-role-cell';const protectedUser=user.isOwner||user.id===account.user.id;
      if(can('roles.manage')&&!protectedUser){const label=document.createElement('span');label.id='user-role-'+user.id;label.className='sr-only';label.textContent='Vai trò của '+user.email;
        const select=document.createElement('snapkit-select');const save=document.createElement('button');save.type='button';save.className='account-role-save';save.textContent='Lưu quyền';save.hidden=true;
        select.configure({value:user.role,labelledby:label.id,items:[{value:'user',label:'Người dùng ứng dụng'},...Object.entries(roles).map(([value,role])=>({value,label:role.label}))],onChange:value=>{save.hidden=value===user.role;}});
        save.onclick=async()=>{save.disabled=true;select.disabled=true;try{await api('admin/users/role',{id:user.id,role:select.value});user.role=select.value;save.hidden=true;$('#users-message').textContent='Đã cập nhật quyền của '+user.email+'.';}catch(error){select.value=user.role;save.hidden=true;fail(error);}finally{save.disabled=false;select.disabled=false;}};
        roleCell.append(label,select,save);
      }else{const badge=document.createElement('span');badge.className='role-badge';badge.textContent=user.isOwner?'Chủ tài khoản':roles[user.role]?.label||'Người dùng ứng dụng';roleCell.append(badge);}
      row.append(roleCell);const access=document.createElement('td');const state=document.createElement('span');state.className='account-state';state.dataset.disabled=String(!!user.disabled);state.textContent=user.disabled?'Đã khóa':'Hoạt động';access.append(state);row.append(access);
      const last=document.createElement('td');last.textContent=date(user.lastLoginAt);row.append(last);const action=document.createElement('td');
      if(can('users.manage')&&!protectedUser){const button=document.createElement('button');button.type='button';button.textContent=user.disabled?'Mở khóa':'Khóa truy cập';button.onclick=async()=>{if(!await confirmAction(user.disabled?'Mở khóa tài khoản?':'Khóa quyền truy cập?',user.email+(user.disabled?' sẽ có thể đăng nhập lại.':' sẽ bị đăng xuất và không thể truy cập Snapkit.'),user.disabled?'Mở khóa':'Khóa truy cập'))return;button.disabled=true;try{await api('admin/users/access',{id:user.id,disabled:!user.disabled});await users();}catch(error){fail(error);button.disabled=false;}};action.append(button);}
      else{const note=document.createElement('span');note.className='account-protected';note.textContent=user.isOwner?'Được bảo vệ':user.id===account.user.id?'Tài khoản của bạn':'Chỉ xem';action.append(note);}row.append(action);$('#users').append(row);
    }
    if(!data.users.length){const row=document.createElement('tr');const cell=document.createElement('td');cell.colSpan=5;cell.textContent='Không tìm thấy tài khoản phù hợp.';row.append(cell);$('#users').append(row);}
    $('#previous').disabled=offset===0;$('#next').disabled=offset+50>=total;$('#page').textContent='Trang '+(offset/50+1);
  }
  $('#search').onsubmit=event=>{event.preventDefault();offset=0;users().catch(fail);};$('#previous').onclick=()=>{offset=Math.max(0,offset-50);users().catch(fail);};$('#next').onclick=()=>{offset+=50;users().catch(fail);};
  async function loadRoles() {
    const data=await api('admin/roles');$('#role-cards').replaceChildren();
    for(const role of Object.values(data.roles)){const card=document.createElement('article');card.className='role-card';card.innerHTML=icon('shield');const title=document.createElement('h2');title.textContent=role.label;const description=document.createElement('p');description.textContent=role.description;card.append(title,description);$('#role-cards').append(card);}
    const table=$('#permission-matrix');table.replaceChildren();const header=document.createElement('thead');const headerRow=document.createElement('tr');for(const label of ['Phạm vi quyền',...Object.values(data.roles).map(role=>role.label)]){const cell=document.createElement('th');cell.textContent=label;headerRow.append(cell);}header.append(headerRow);table.append(header);const body=document.createElement('tbody');
    for(const [label,permission]of [['Xem tổng quan','overview.read'],['Xem tài khoản','users.read'],['Quản lý truy cập','users.manage'],['Cấp vai trò','roles.manage'],['Xem nội dung','content.read'],['Xuất bản nội dung','content.write'],['Xem góp ý','feedback.read'],['Xử lý & duyệt đánh giá','feedback.manage'],['Xem nhật ký','audit.read','teams.read']]){const row=document.createElement('tr');const name=document.createElement('td');name.textContent=label;row.append(name);for(const role of Object.values(data.roles)){const cell=document.createElement('td');const yes=role.permissions.includes(permission);cell.innerHTML=icon(yes?'check':'minus');cell.className=yes?'matrix-check':'matrix-no';cell.setAttribute('aria-label',yes?'Được phép':'Không được phép');row.append(cell);}body.append(row);}table.append(body);
  }
  function actionLabel(action){const labels={'sign-in':'Đăng nhập','publish-content':'Xuất bản nội dung','disable-user':'Khóa tài khoản','enable-user':'Mở khóa tài khoản','review-approved':'Duyệt đánh giá công khai','review-pending':'Ẩn đánh giá khỏi website','review-rejected':'Không công khai đánh giá','feedback-new':'Đánh dấu góp ý mới','feedback-reviewing':'Xem xét góp ý','feedback-done':'Hoàn tất xử lý góp ý'};return labels[action]||(action.startsWith('assign-role:')?'Cấp vai trò: '+(roles[action.split(':')[1]]?.label||'Người dùng ứng dụng'):action);}
  async function loadAudit() {const data=await api('admin/audit');$('#audit').replaceChildren();for(const entry of data.entries){const row=document.createElement('div');row.className='audit-row';row.innerHTML=icon('history');const copy=document.createElement('div');const action=document.createElement('strong');action.textContent=actionLabel(entry.action);const meta=document.createElement('p');meta.textContent=entry.actorName||entry.actor;const avatar=document.createElement('span');avatar.className='account-avatar';paintAvatar(avatar,{name:entry.actorName||entry.actor,avatarImage:entry.actorAvatarImage});row.replaceChildren(avatar);if(entry.target)meta.textContent+=' · '+entry.target;copy.append(action,meta);const time=document.createElement('time');time.textContent=date(entry.at);row.append(copy,time);$('#audit').append(row);}if(!data.entries.length)empty($('#audit'),'Chưa có hoạt động nào.');}
  $('#audit-reload').onclick=()=>loadAudit().catch(fail);
  $('#logout').onclick=()=>api('auth/logout',{}).then(()=>location.reload()).catch(fail);
  async function checkSession() {
    authState('loading','Đang kiểm tra phiên đăng nhập…');$('#error').textContent='';
    try {
      const config=await api('auth/config');if(!config.configured){authState('unavailable','Đăng nhập đang được thiết lập. Vui lòng thử lại sau.');return;}
      let current;try{current=await api('account');}catch(error){if(error.status!==401)throw error;const failed=new URLSearchParams(location.search).get('auth')==='failed';authState(failed?'failed':'ready',failed?'Chưa thể đăng nhập. Vui lòng thử lại với tài khoản được cấp quyền.':'');return;}
      account=current;permissions=new Set(current.permissions||roles[current.user.role]?.permissions||[]);
      $('#identity').textContent=current.user.email;$('#logout').hidden=false;
      if(!roles[current.user.role]||!can('overview.read')){authState('denied','Tài khoản '+current.user.email+' chưa được cấp quyền quản trị. Hãy sử dụng tài khoản khác.');return;}
      $('#profile-name').textContent=current.user.name||current.user.email;$('#profile-role').textContent=current.user.isOwner?'Chủ tài khoản':roles[current.user.role].label;paintAvatar($('#profile-initial'),current.user);$('#current-role').textContent=roles[current.user.role].label;
      applyPermissions();$('#login').hidden=true;$('#dashboard').hidden=false;$('#admin-menu').hidden=false;document.body.dataset.view='dashboard';await showPanel(location.hash.slice(1)||'overview');
    }catch(error){if(error.status===401)authState('ready','Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');else if(error.status===403)authState('denied','Tài khoản này chưa được cấp quyền quản trị. Hãy sử dụng tài khoản khác.');else authState('error','Chưa thể kết nối Snapkit. Kiểm tra kết nối mạng rồi thử lại.');}
  }
  $('#auth-retry').onclick=checkSession;
  $('#switch-account').onclick=async()=>{const button=$('#switch-account');button.disabled=true;try{await api('auth/logout',{});location.assign('/auth/google/start');}catch{authState('denied','Chưa thể đổi tài khoản. Vui lòng thử lại.');button.disabled=false;}};
  $('#google-login').onclick=event=>{const link=event.currentTarget;if(link.getAttribute('aria-disabled')==='true'){event.preventDefault();return;}link.setAttribute('aria-disabled','true');link.querySelector('span').textContent='Đang mở Google…';};
  window.addEventListener('pageshow',()=>{$('#google-login').removeAttribute('aria-disabled');$('#google-login span').textContent='Tiếp tục với Google';});
  checkSession();
})();
