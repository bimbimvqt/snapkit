// The first successful response is a silent baseline, including after reload/account changes.
export function createNotificationTracker(){
 let account=null,seen=new Set();
 return feed=>{const fresh=account===feed.userId?feed.items.filter(item=>!item.read&&!seen.has(item.id)).map(item=>item.id):[];if(account!==feed.userId)seen=new Set();account=feed.userId;seen=new Set([...seen,...feed.items.map(item=>item.id)].slice(-500));return fresh;};
}
