// Entirely fictional, read-only showcase data. Never copy tenant data here.
export function teamPreview(){
 const at='2026-01-01T09:00:00.000Z',environments=['development','staging','production'],layers=['mobile','frontend','backend','data','mock'];
 const developers=[...Array.from({length:3},(_,i)=>({userId:'preview-mobile-'+(i+1),name:'Mobile '+String(i+1).padStart(2,'0'),serviceLayers:['mobile','mock']})),...Array.from({length:6},(_,i)=>({userId:'preview-backend-'+(i+1),name:'Backend '+String(i+1).padStart(2,'0'),serviceLayers:['backend','data','mock']}))].map(m=>({...m,role:'developer',email:'',projectIds:['preview-app'],environments:['development','staging'],joinedAt:at}));
 const members=[...developers,{userId:'preview-lead',name:'Team Leader',role:'lead',serviceLayers:layers,email:'',projectIds:null,environments,joinedAt:at},{userId:'preview-pm',name:'Project Manager',role:'pm',serviceLayers:layers,email:'',projectIds:null,environments,joinedAt:at}];
 const names=['Identity API','Product API','Order API','Payment API','Notification API','Data & reporting'];
 const services=[{name:'Flutter app',kind:'mobile',ownerId:'preview-mobile-1',runtime:'Flutter · Android & iOS',repository:''},...names.map((name,i)=>({name,kind:i===5?'data':'backend',ownerId:'preview-backend-'+(i+1),runtime:i===5?'PostgreSQL':'Node.js',repository:''}))];
 const blueprint={version:3,updatedAt:at,updatedBy:'preview-lead',services};
 const history=[{...blueprint,version:2,services:services.slice(0,4)}];
 return {id:'preview-studio',name:'Flutter Delivery Team',membership:{userId:'preview-guest',name:'Guest preview',role:'viewer',projectIds:null,environments,serviceLayers:layers,joinedAt:at,permissions:[]},members,invitations:[],
  projects:[{id:'preview-app',name:'Flutter Commerce',icon:'smartphone',description:'Flutter · Android & iOS',blueprint,history}],
  devices:[{id:'preview-iphone',name:'iPhone · iOS',platform:'ios',projectId:'preview-app',host:'Device Lab',reservation:null},{id:'preview-pixel',name:'Pixel · Android',platform:'android',projectId:'preview-app',host:'Device Lab',reservation:null},{id:'preview-tablet',name:'iPad · Tablet',platform:'ios',projectId:'preview-app',host:'Device Lab',reservation:null}],
  handoffs:[['preview-mobile-build','Flutter checkout','preview-mobile-2'],['preview-api-build','Order API review','preview-backend-3']].map(([id,title,createdBy])=>({id,title,projectId:'preview-app',environment:'development',commit:'',buildUrl:'',artifactSha256:'',fixture:'',steps:'Check checkout, order confirmation and error recovery.',blueprintVersion:3,blueprint,createdBy,createdAt:at,status:'pending',qa:null,approval:null})),
  audit:[['preview-event-blueprint','Team Leader','blueprint.updated'],['preview-event-handoff','Mobile 02','handoff.created'],['preview-event-device','Team Leader','device.registered'],['preview-event-member','Project Manager','invitation.accepted'],['preview-event-project','Team Leader','project.created']].map(([id,actorName,action])=>({id,at,actorName,action,projectId:'preview-app',environment:action==='blueprint.updated'?'development':null}))
 };
}
