# DUT Knowledge Hub

Frontend Angular cho nền tảng chia sẻ tài liệu học tập dành cho sinh viên Trường Đại học Bách khoa – Đại học Đà Nẵng.

## Chạy ứng dụng

Yêu cầu Node.js và npm. Cài dependencies và khởi động máy chủ phát triển:

```bash
npm install
npm start
```

Mặc định frontend gọi API tại `http://localhost:8000/api/v1`. Thay URL gốc (không bao gồm `/api/v1`) trong `src/app/environments/environment.ts` để kết nối backend khác. API phải triển khai các endpoint theo API contract của dự án; giao diện không sử dụng dữ liệu nghiệp vụ giả.

## Kiểm tra

```bash
npm run build
npm test -- --watch=false
```

## Phạm vi hiện tại

Đã triển khai đăng nhập MSSV, khôi phục phiên qua refresh cookie, phân quyền và đổi mật khẩu bắt buộc; layout responsive cho sinh viên/quản trị; trang chủ và tìm kiếm có bộ lọc phụ thuộc, URL query state, sắp xếp và phân trang; chi tiết tài liệu, tải file, yêu thích, nhận xét; đăng tải, quản lý tài liệu cá nhân, hồ sơ; dashboard, cấp phát/quản lý tài khoản, kiểm duyệt và CRUD danh mục cơ bản.

Các luồng cần endpoint hoặc hợp đồng dữ liệu bổ sung/chính xác hơn: xem trước PDF/ảnh theo từng tài liệu, báo cáo tài liệu, danh sách môn học phổ biến theo khoa, hoạt động gần đây, liên kết môn học–chuyên ngành dạng nhiều-nhiều, và cấu trúc response chính xác cho mật khẩu khởi tạo. Trang danh mục hiện hỗ trợ CRUD cơ bản; các thao tác liên kết nhiều-nhiều và kiểm tra tham chiếu do backend quyết định.

Không có route đăng ký tài khoản. `ng lint` chưa được cấu hình trong project.
