# Snapkit Personal và Teams

Hai khu vực trong **cùng một ứng dụng desktop**, chuyển bằng nút **Personal / Teams** ở sidebar. Lựa chọn khu vực được nhớ trên máy. Teams cũng truy cập được từ màn hình setup ban đầu mà không cần tạo hồ sơ cá nhân trước.

## Phạm vi đã triển khai

- Tạo nhiều team workspace và project, xem tổng quan và audit.
- Mời tài khoản Google theo email, nhận lời mời trong ứng dụng, chấp nhận hoặc thu hồi. Lời mời hết hạn sau 7 ngày. Chưa có dịch vụ gửi email; tạo lời mời không tự gửi email.
- Vai trò Owner, Tech Lead, Developer, QA, DevOps, Designer và Viewer độc lập với quyền admin của Snapkit cloud. Admin hệ thống không tự được tham gia team.
- Cấp phạm vi theo project, environment và lớp dịch vụ mobile/frontend/backend/data/mock. Thu hồi hoặc đổi quyền được kiểm tra lại tại API khi thao tác.
- Khai báo dịch vụ, repository, yêu cầu runtime và người phụ trách trong blueprint có phiên bản. Lưu lịch sử tối đa 50 phiên bản; cập nhật đồng thời có kiểm tra phiên bản để tránh ghi đè. Cập nhật từ người có scope hạn chế giữ nguyên các lớp bị ẩn với họ.
- Đăng ký tài nguyên thiết bị và đặt chỗ từ 5 đến 120 phút, trả lượt, ngăn hai người đặt cùng lúc. UI mặc định 30 phút. Chủ lượt và người quản lý thiết bị được trả lượt. Thu hồi thành viên/quyền sẽ giải phóng lượt không còn hợp lệ.
- Tạo gói bàn giao cố định gồm commit, URL build HTTPS, SHA-256 do người tạo cung cấp, fixture, các bước test và snapshot blueprint. QA khác người tạo xác nhận hoặc yêu cầu sửa; Lead/DevOps khác người tạo và người QA duyệt. Dữ liệu bàn giao không có API sửa; thay build cần tạo gói mới.
- Chuẩn bị liên kết với thư mục local cho từng người/team/project và ghi nhận phiên bản blueprint. Không đổi workspace, target hay cấu hình IDE cá nhân.
- Giao diện React/TypeScript, EN/VI, light/dark, có trạng thái trống, lỗi mạng và quyền thực tế. Không có bộ chọn giả lập vai trò trong sản phẩm.

## Các ranh giới hiện tại

**Run Together hiện chuẩn bị liên kết và cấu hình; chưa tự cài runtime, lấy secret hoặc chạy chuỗi service.** Người dùng tiếp tục khởi chạy từ IDE/terminal. Runtime trong blueprint là yêu cầu khai báo, chưa phải kết quả xác minh phiên bản SDK.

**Device Lab hiện là lịch đặt chỗ có kiểm soát quyền.** Đăng ký thiết bị không tự kết nối agent hay chia sẻ điều khiển. Chưa có hàng đợi tự chuyển lượt hoặc điều khiển thiết bị từ xa. Thiết bị cá nhân không được nhập vào danh sách team.

**Release approval là bước phối hợp, chưa tích hợp triển khai CI/CD.** Không upload hoặc tải build tự động, không xác minh nội dung artifact qua URL. QA phải kiểm tra SHA-256 của tệp tải về so với mã băm đã bàn giao. URL không được chứa user/password, query hay fragment; dùng liên kết ổn định và quyền truy cập artifact của tổ chức. Không đặt secret trong repository URL, notes hoặc fixture.

Chưa có cấu hình quyền tùy ý cho từng cá nhân ngoài các mẫu vai trò và scopes, chuyển Owner, thanh toán Teams, xóa/đổi tên workspace, thông báo email, hoặc thu hồi bản dữ liệu người dùng đã tải trước đó.

## Phân cấp và quyền

Workspace → Project → Environment → Service/Device/Handoff → Local binding.

Frontend, Backend và Mobile là lớp dịch vụ và phạm vi trách nhiệm, không bắt buộc là ba vai trò khác nhau. Một Developer có thể được cấp riêng project và lớp cần dùng. Owner quản trị thành viên nhưng không mặc nhiên có quyền QA xác nhận hay duyệt release.

Mặc định lời mời có quyền development/staging, không có production. Cấp production là lựa chọn rõ ràng của Owner. Các thay đổi blueprint thuộc development. Quyền đặt thiết bị cũng kiểm tra scope development; gói bàn giao kiểm tra môi trường của gói.

## Dữ liệu và vận hành

- Cloud: `SNAPKIT_CLOUD_DATA/teams.json`, tách với `accounts.json` và `subscriptions.json`. Không sao chép local personal workspaces lên cloud.
- Local: `state/teams-local.json`, khóa theo danh tính được cloud xác minh + workspace ID + project ID. Đường dẫn thư mục local không gửi lên cloud.
- Personal: `spaces.json`, `settings.json`, `workspaces.json`, target và cấu hình thiết bị hiện tại không được migration hay thay đổi khi chuyển khu vực.
- Mỗi thao tác Teams dùng phiên Google hiện tại; token cloud không trả về renderer. Paired website controller không được dùng proxy Teams. Demo hiển thị thông báo cần app local đã đăng nhập, không giả lập dữ liệu cộng tác.
- Trạng thái JSON dùng một writer tuần tự và atomic rename. Chỉ chạy **một process cloud ghi cùng bộ dữ liệu** như kiến trúc accounts hiện tại; chưa hỗ trợ nhiều replica cùng ghi file. Cần database/transaction chung trước khi scale ngang.
- Giới hạn: 20 workspace Owner mỗi người; 200 thành viên và 200 lời mời còn hạn mỗi workspace; 100 project; 30 dịch vụ mỗi blueprint; 200 thiết bị; 1.000 handoff; 500 audit gần nhất. Rate limit cloud hiện tại tiếp tục áp dụng.
- File Teams cloud có giới hạn 16 MiB trong giai đoạn dùng JSON; khi đạt giới hạn, thao tác ghi bị từ chối và dữ liệu đã lưu được giữ nguyên. Cần chuyển sang database để mở rộng dung lượng và số team.
- Dashboard chỉ làm mới Teams mỗi 30 giây khi khu vực đang mở và tab đang hiển thị; thao tác ghi trả snapshot mới ngay. Quyết định quyền không dựa trên cache UI.
- Các account dùng chung workspace phải kết nối **cùng account service đã cập nhật phiên bản Teams**. Cloud cũ trả lỗi rõ ràng; dữ liệu cá nhân vẫn dùng bình thường.

## API

Cloud authenticated endpoints nằm dưới `/v1/teams`; local proxy nằm dưới `/api/teams`.

| Thao tác | Đường dẫn dưới `/v1/teams` |
| --- | --- |
| Danh sách/tạo workspace | `GET /`, `POST /` |
| Đọc workspace theo quyền | `GET /:workspaceId` |
| Chấp nhận lời mời đúng email | `POST /invitations/:invitationId/accept` |
| Tạo/thu hồi lời mời | `POST /:workspaceId/invitations`, `POST /:workspaceId/invitations/:id/revoke` |
| Đổi quyền/xóa thành viên | `POST /:workspaceId/members/:userId`, `POST /:workspaceId/members/:userId/remove` |
| Tạo project | `POST /:workspaceId/projects` |
| Lưu blueprint | `POST /:workspaceId/projects/:projectId/blueprint` |
| Thiết bị và đặt chỗ | `POST /:workspaceId/devices`, `POST /:workspaceId/devices/:id/reserve`, `POST /:workspaceId/devices/:id/release` |
| Bàn giao và review | `POST /:workspaceId/handoffs`, `POST /:workspaceId/handoffs/:id/review` |

Local-only binding: `GET /api/teams/local-session?workspaceId=…&projectId=…`, `POST /api/teams/local-session` với `workspaceId`, `projectId`, `path`.

Cookie-auth mutations yêu cầu origin chính xác và `X-Snapkit-Request: 1`; desktop proxy dùng bearer lấy từ secure account storage. Local mutations tiếp tục cần `X-Snapkit-Token`. Không tin `userId`, role hay permission được client gửi trong body.

## Kiểm tra và cập nhật dịch vụ

```sh
npm run check
node --test tests/unit/teams-api.test.js
npm test
npx playwright test tests/e2e/teams.spec.js tests/e2e/workspaces.spec.js
```

Để dùng với team thật cần cập nhật cloud và app desktop từ source này. Sao lưu `SNAPKIT_CLOUD_DATA` theo quy trình vận hành hiện tại trước khi cập nhật. Không đổi volume đang dùng hoặc thay bằng một thư mục rỗng. Thay đổi source không tự deploy cloud và không tự phát hành bộ cài desktop.
