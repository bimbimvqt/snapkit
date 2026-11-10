(() => {
 const $=id=>document.getElementById('join-'+id),status=$('status');let invitationId='';
 try{const hash=location.hash.slice(1);if(/^[a-f0-9-]{36}$/.test(hash)){sessionStorage.setItem('snapkit-team-invitation',hash);history.replaceState(null,'',location.pathname+location.search);}else if(hash){sessionStorage.removeItem('snapkit-team-invitation');}invitationId=sessionStorage.getItem('snapkit-team-invitation')||'';}catch{invitationId=location.hash.slice(1);}
 async function request(url,body){const response=await fetch(url,{credentials:'same-origin',headers:body?{'Content-Type':'application/json','X-Snapkit-Request':'1'}:{},...(body?{method:'POST',body:JSON.stringify(body)}:{})});if(!response.ok)throw Object.assign(Error('Request failed'),{status:response.status});return response.json();}
 async function load(){
  for(const id of ['signin','accept','switch','retry','download'])$(id).hidden=true;$('account').textContent='';
  if(!/^[a-f0-9-]{36}$/.test(invitationId)){status.textContent='Link lời mời không hợp lệ. Hãy mở lại email mời. / Invalid invitation link. Open the link from your email.';return;}
  status.textContent='Đang kiểm tra lời mời… / Checking invitation…';
  try{const {user}=await request('/v1/account');$('account').textContent=user.email;$('switch').hidden=false;
   const listing=await request('/v1/teams');const invitation=listing.invitations.find(i=>i.id===invitationId);
   if(!invitation){status.textContent='Không có lời mời cho tài khoản này, hoặc lời mời đã được dùng, thu hồi hay hết hạn. / No pending invitation for this account. Check the email account, or ask the workspace Owner for a new invitation.';return;}
   status.textContent='Bạn được mời tham gia '+invitation.workspaceName+'. / You are invited to join this workspace.';$('accept').hidden=false;
  }catch(error){if(error.status===401){status.textContent='Đăng nhập Google bằng email nhận lời mời để tiếp tục. / Sign in using the invited Google email.';$('signin').hidden=false;}else{status.textContent='Chưa kết nối được. Hãy thử lại. / Could not connect. Try again.';$('retry').hidden=false;}}
 }
 $('accept').onclick=async()=>{$('accept').disabled=true;try{await request('/v1/teams/invitations/'+invitationId+'/accept',{});$('accept').hidden=true;status.textContent='Đã tham gia workspace. Mở Snapkit → Teams → Làm mới. / You have joined. Open Snapkit → Teams → Refresh.';$('download').hidden=false;try{sessionStorage.removeItem('snapkit-team-invitation');}catch{}}catch{status.textContent='Chưa chấp nhận được lời mời. Hãy kiểm tra lại. / Could not accept this invitation. Check again.';$('retry').hidden=false;}finally{$('accept').disabled=false;}};
 $('switch').onclick=async()=>{$('switch').disabled=true;try{await request('/v1/auth/logout',{});location.assign('/auth/google/start?returnTo=%2Fjoin%2F');}catch{status.textContent='Chưa đổi được tài khoản. Hãy thử lại. / Could not switch accounts. Try again.';}finally{$('switch').disabled=false;}};
 $('retry').onclick=load;void load();
})();
