// Entirely fictional, read-only showcase data. Never copy tenant data here.
export function teamPreview() {
  const at = '2026-01-01T09:00:00.000Z';
  const layers = ['mobile','frontend','backend','data','mock'];
  const environments = ['development','staging','production'];
  const members = [['preview-owner','Workspace owner','owner'],['preview-lead','Team lead','lead'],['preview-dev','Developer','developer'],['preview-qa','QA specialist','qa'],['preview-ops','Operations','devops'],['preview-design','Designer','designer'],['preview-viewer','Guest preview','viewer']].map(([userId,name,role])=>({userId,name,role,email:'',projectIds:null,environments,serviceLayers:layers,joinedAt:at}));
  const blueprint = {version:3,updatedAt:at,updatedBy:'preview-lead',services:[['Mobile experience','mobile','preview-dev'],['Web experience','frontend','preview-design'],['App services','backend','preview-ops']].map(([name,kind,ownerId])=>({name,kind,ownerId,repository:'',runtime:''}))};
  return {id:'preview-studio',name:'Product Studio',membership:{...members[6],permissions:[]},members,invitations:[],
    projects:[{id:'preview-app',name:'Customer Experience',description:'A sample project for exploring teamwork.',blueprint,history:[]},{id:'preview-web',name:'Team Portal',description:'A fictional web project.',blueprint:{...blueprint,services:blueprint.services.slice(1)},history:[]}],
    devices:[{id:'preview-iphone',name:'iPhone · QA',platform:'ios',projectId:'preview-app',host:'Shared device lab',reservation:null},{id:'preview-pixel',name:'Pixel · QA',platform:'android',projectId:'preview-app',host:'Shared device lab',reservation:null}],
    handoffs:[{id:'preview-review',title:'Customer experience review',projectId:'preview-app',environment:'development',commit:'',buildUrl:'',artifactSha256:'',fixture:'',steps:'Review the welcome screen. Check the layout on a phone and tablet.',blueprintVersion:3,blueprint,createdBy:'preview-dev',createdAt:at,status:'qa-approved',qa:{userId:'preview-qa',at,note:''},approval:null}],
    audit:[{id:'preview-event-qa',at,actorName:'QA specialist',action:'handoff.qa-approved',projectId:'preview-app',environment:'development'},{id:'preview-event-project',at,actorName:'Team lead',action:'project.created',projectId:'preview-app',environment:null},{id:'preview-event-blueprint',at,actorName:'Team lead',action:'blueprint.updated',projectId:'preview-app',environment:null}]
  };
}
