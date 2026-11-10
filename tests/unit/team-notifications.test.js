import test from 'node:test';
import assert from 'node:assert/strict';
import {teamNotifications} from '../../apps/cloud/src/domain/team-notifications.js';

const now=Date.now(),at=new Date(now).toISOString();
const member=(userId,role='qa',projectIds=['public'])=>({userId,role,projectIds,environments:['development'],joinedAt:new Date(now-1000).toISOString()});
const workspace=()=>({id:'team',name:'Engineering',members:[member('qa'),member('lead','lead'),member('author','developer'),member('owner','owner',null)],invitations:[],audit:[],handoffs:[]});
test('notification feed enforces recipient, tenant, project, environment and approval permissions',()=>{
 const w=workspace(),db={workspaces:[w]},qa={id:'qa',email:'qa@example.com'};
 w.invitations=[{id:'invite',email:'guest@example.com',expiresAt:now+100000,delivery:{status:'failed'}},{id:'expired',email:'guest@example.com',expiresAt:now-1}];
 const handoff={id:'build',title:'Checkout',projectId:'public',environment:'development',createdAt:at,createdBy:'author',status:'pending'};
 w.handoffs=[handoff,{...handoff,id:'private',projectId:'secret'},{...handoff,id:'production',environment:'production'}];
 assert.deepEqual(teamNotifications(db,qa,now).map(n=>n.id),['handoff:build:pending']);
 assert.equal(teamNotifications(db,{id:'author',email:'author@example.com'},now).length,0);
 assert.equal(teamNotifications(db,{id:'outsider',email:'outsider@example.com'},now).length,0);
 assert.deepEqual(teamNotifications(db,{id:'guest',email:'GUEST@example.com'},now).map(n=>n.id),['invite:invite']);
 assert.equal(teamNotifications(db,{id:'owner',email:'owner@example.com'},now)[0].type,'warning');
 handoff.status='qa-approved';handoff.qa={userId:'qa',at};
 assert.equal(teamNotifications(db,qa,now).length,0);
 assert.equal(teamNotifications(db,{id:'lead',email:'lead@example.com'},now)[0].title,'Release approval needed');
 w.members=w.members.filter(m=>m.userId!=='lead');
 assert.equal(teamNotifications(db,{id:'lead',email:'lead@example.com'},now).length,0);
});
test('activity notifications respect join time, environment-only scope, author exclusion and per-user reads',()=>{
 const w=workspace(),db={workspaces:[w],notificationReads:{qa:['event:visible']}};
 const event={id:'visible',actorId:'author',action:'blueprint.updated',at,projectId:'public',environment:'development'};
 w.audit=[event,{...event,id:'old',at:new Date(now-10000).toISOString()},{...event,id:'own',actorId:'qa'},{...event,id:'environment-only',projectId:null,environment:'production'},{...event,id:'private',projectId:'secret'}];
 assert.deepEqual(teamNotifications(db,{id:'qa',email:'qa@example.com'},now).map(n=>[n.id,n.read]),[['event:visible',true]]);
 assert.equal(teamNotifications(db,{id:'lead',email:'lead@example.com'},now)[0].read,false);
 w.members[0].projectIds=[];
 assert.equal(teamNotifications(db,{id:'qa',email:'qa@example.com'},now).length,0);
});
