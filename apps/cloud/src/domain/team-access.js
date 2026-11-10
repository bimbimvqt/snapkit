export const teamRoles = ['owner', 'lead', 'developer', 'qa', 'devops', 'designer', 'viewer'];
export const teamEnvironments = ['development', 'staging', 'production'];
export const teamLayers = ['mobile', 'frontend', 'backend', 'data', 'mock'];
const grants = {
  owner: ['members.manage', 'projects.create', 'blueprint.write', 'devices.manage', 'devices.reserve', 'handoffs.create', 'sessions.prepare'],
  lead: ['projects.create', 'blueprint.write', 'devices.manage', 'devices.reserve', 'handoffs.create', 'release.approve', 'sessions.prepare'],
  developer: ['devices.reserve', 'handoffs.create', 'sessions.prepare'],
  qa: ['devices.reserve', 'handoffs.create', 'qa.confirm', 'sessions.prepare'],
  devops: ['blueprint.write', 'devices.manage', 'devices.reserve', 'handoffs.create', 'release.approve', 'sessions.prepare'],
  designer: [], viewer: [],
};
export const teamPermissions = role => [...(grants[role] || [])];
export function teamCan(member, permission, projectId, environment) {
  if (!member || !grants[member.role]?.includes(permission)) return false;
  if (projectId && member.projectIds !== null && !member.projectIds?.includes(projectId)) return false;
  if (environment && !member.environments?.includes(environment)) return false;
  return true;
}
export function teamProjectVisible(member, projectId) {
  return !!member && (member.projectIds === null || member.projectIds?.includes(projectId));
}
