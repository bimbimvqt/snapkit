const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
export function invitationMailer({env, fetcher=fetch}) {
  const from=env.SNAPKIT_MAIL_FROM, key=env.RESEND_API_KEY;
  const configured=!!key&&typeof from==='string'&&!/[\r\n]/.test(from)&&/^[^<>\s@]+@[^<>\s@]+\.[^<>\s@]+$/.test(from);
  const origin=new URL(env.SNAPKIT_PUBLIC_URL||'https://snapkit.vn').origin;
  return {configured, async send({invitation,workspace,inviter,idempotencyKey}) {
    if(!configured) throw Error('Email is not configured.');
    const link=origin+'/join/#'+encodeURIComponent(invitation.id);
    const text=`${inviter} mời bạn tham gia workspace ${workspace} trên Snapkit Teams.\n\nChấp nhận lời mời / Accept invitation: ${link}\n\nĐăng nhập Google bằng đúng email nhận lời mời. Lời mời có hiệu lực 7 ngày kể từ lúc tạo.\nSign in with the Google email that received this invitation. Invitations expire 7 days after creation.\n\nNếu không mong đợi lời mời này, bạn có thể bỏ qua email. / You can ignore this email if you were not expecting an invitation.`;
    const response=await fetcher('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json','Idempotency-Key':idempotencyKey},body:JSON.stringify({from:'Snapkit Teams <'+from+'>',to:[invitation.email],subject:'Lời mời tham gia Snapkit Teams / Team invitation',text,html:`<!doctype html><html><body style="margin:0;background:#f4f5f6;font-family:Arial,sans-serif;color:#202428"><div style="max-width:560px;margin:32px auto;padding:32px;background:#fff;border-radius:16px"><p style="color:#7662ad;font-weight:bold">SNAPKIT TEAMS</p><h1 style="font-size:26px">Bạn được mời tham gia team</h1><p><strong>${escape(inviter)}</strong> mời bạn vào workspace <strong>${escape(workspace)}</strong>.</p><p>You have been invited to join this workspace.</p><p style="margin:28px 0"><a href="${escape(link)}" style="display:inline-block;padding:14px 20px;border-radius:8px;background:#7662ad;color:#fff;text-decoration:none">Xem lời mời / View invitation</a></p><p>Đăng nhập Google bằng đúng email nhận lời mời, sau đó bấm chấp nhận.</p><p style="font-size:13px;color:#616975">Sign in using the invited Google email, then accept. Expires 7 days after creation.</p><p style="font-size:12px;color:#616975">Không mong đợi lời mời này? Bạn có thể bỏ qua email.<br>If you were not expecting this invitation, you can ignore it.</p></div></body></html>`}),signal:AbortSignal.timeout(8000)});
    if(!response.ok) throw Error('Invitation email could not be sent.');
    const result=await response.json();if(typeof result.id!=='string'||!result.id)throw Error('Invitation email could not be sent.');
  }};
}
