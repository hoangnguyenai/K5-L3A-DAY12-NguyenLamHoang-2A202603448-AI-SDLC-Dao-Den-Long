# Nhật ký AI · Phase 1

| Việc | Codex đã làm | Kiểm chứng |
|---|---|---|
| Đọc yêu cầu | Đối chiếu sáu tệp Markdown của lab với PRD-0 và Test Contract người học cung cấp. Ghi các giả định về điểm, đèn, vùng an toàn, thứ tự xử lý tick. | Đối chiếu từng mục contract khi xây CLI, fixture và tiêu chí nghiệm thu. |
| Xây dựng | Viết mô phỏng 60 tick/giây, trình chạy headless, cảnh WebGL, camera 3D, HUD và bản đồ. | Build và chạy thử bản web. Chạy các fixture độc lập qua CLI. |
| Kiểm thử | Kịch bản ban đầu chạy qua các đèn theo thứ tự số nhưng mất hết sinh lực sau đèn thứ ba. Test vùng an toàn cũng giả định hướng đẩy sang `+X` dù hai vùng sáng chồng nhau. | Đọc sự kiện `player_hit`, đổi tuyến để tránh Bóng Mực. Test vùng an toàn kiểm tra khoảng cách tới cả hai đèn. Chạy lại và lưu đầu ra thật. |
| Môi trường | Node trong sandbox Windows báo `EPERM` khi tự chuẩn hóa đường dẫn tới thư mục người dùng. | Chạy lại với `NODE_OPTIONS=--preserve-symlinks --preserve-symlinks-main` trong sandbox. Các lệnh chạy chuẩn trong contract không gắn cờ riêng của môi trường này. |

**Token ước tính.** Khoảng 20.000–30.000 token cho đọc yêu cầu, thiết kế, triển khai và kiểm chứng trong cuộc trao đổi Phase 1. Đây là ước tính từ lượng văn bản và mã, chưa có số liệu tính phí. Tiết kiệm ngữ cảnh bằng cách dùng một mô phỏng chung, không dùng thư viện ngoài và chỉ đọc các dòng sự kiện cần phân tích thay vì xem toàn bộ JSONL mỗi lượt.

**Đánh giá.** 7/7 bài tự kiểm đạt. Tuyến mặc định kiểm chứng được việc thắng cả màn và tính tất định. Harness gồm `AGENTS.md` và workflow tự chạy build/test. Việc chấm ẩn và xác nhận macOS/Linux vẫn cần kết quả từ môi trường chấm hoặc CI. Chưa có bản đánh giá độc lập của người khác.
