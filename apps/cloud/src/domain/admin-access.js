export const adminRoles = {
  admin: { label: 'Quản trị viên', description: 'Quản lý tài khoản, phân quyền, nội dung và đánh giá.', permissions: ['overview.read','users.read','users.manage','roles.manage','content.read','content.write','feedback.read','feedback.manage','audit.read','teams.read'] },
  editor: { label: 'Biên tập viên', description: 'Biên tập và xuất bản nội dung website, thông báo ứng dụng.', permissions: ['overview.read','content.read','content.write'] },
  moderator: { label: 'Kiểm duyệt viên', description: 'Xử lý góp ý và duyệt hoặc ẩn đánh giá công khai.', permissions: ['overview.read','feedback.read','feedback.manage'] },
  viewer: { label: 'Người xem', description: 'Xem tổng quan, nội dung, tài khoản và góp ý; không chỉnh sửa.', permissions: ['overview.read','users.read','content.read','feedback.read','audit.read','teams.read'] }
};
export const permissionsFor = role => [...(adminRoles[role]?.permissions || [])];
export const hasPermission = (role, permission) => permissionsFor(role).includes(permission);
export function routePermission(route, method) {
  if (route === '/teams') return method === 'GET' ? 'teams.read' : null;
  if (route === '/overview') return method === 'GET' ? 'overview.read' : null;
  if (route === '/audit') return method === 'GET' ? 'audit.read' : null;
  if (route === '/roles') return method === 'GET' ? 'roles.manage' : null;
  if (route === '/users/role') return method === 'POST' ? 'roles.manage' : null;
  if (route.startsWith('/users')) return method === 'GET' ? 'users.read' : 'users.manage';
  if (route.startsWith('/feedback')) return method === 'GET' ? 'feedback.read' : 'feedback.manage';
  if (route === '/content') return method === 'GET' ? 'content.read' : 'content.write';
  return null;
}
