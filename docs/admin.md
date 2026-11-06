# Snapkit administration

Open https://snapkit.vn/admin/ and sign in with Google. Account owners listed in SNAPKIT_ADMIN_EMAILS always have full access. Their role and access cannot be changed in the console, and users cannot demote or lock their own account.

| Role | Read | Write |
| --- | --- | --- |
| Quản trị viên / admin | Overview, users, content, feedback, permissions, audit | Access, roles, publishing, feedback processing and moderation |
| Biên tập viên / editor | Overview and content | Website copy, announcements, recommended release; cannot change registration access |
| Kiểm duyệt viên / moderator | Overview and feedback | Feedback progress and review approval/withdrawal |
| Người xem / viewer | Overview, users, content, feedback and audit | None |
| Application user / user | Normal Snapkit app | No console access |

To assign access, the person must first sign in to Snapkit so their account exists. A Quản trị viên opens Tài khoản, selects a role and clicks Lưu quyền. Selecting the dropdown alone does not save. Locking access requires the confirmation dialog and revokes existing sessions. Role changes take effect on subsequent API calls without requiring a fresh Google sign-in. Existing Google sessions retain their assigned role across future logins.

RBAC is enforced by the cloud API for every route and rechecked inside serialized write transactions. The source allowlist remains authoritative for account owners. Delegated console roles are stored in adminRole; the old cached role field is deliberately ignored for authorization. No client-supplied role or permission set grants server access. All role/access/content/moderation writes require an authenticated session and same-origin CSRF checks for cookie sessions, and appear in the audit log.

The website uses a navigation sidebar, overview metrics from the API, a searchable user table, a filterable feedback inbox with a separate detail view, bilingual content editing and a role-permission matrix. Read-only fields and controls match the current permission set. Content drafts survive navigation; reloading a dirty form asks before discarding changes. Navigation adapts to a keyboard-accessible drawer on mobile. Custom choices share the Snapkit dropdown component; reviews use star ratings and retain the explicit publication-consent and moderation rules documented in website-feedback-seo.md.
