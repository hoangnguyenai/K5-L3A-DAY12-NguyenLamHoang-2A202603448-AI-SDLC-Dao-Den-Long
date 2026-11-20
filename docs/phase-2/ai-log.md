# Nhật ký AI · Phase 2

Codex đọc Ticket-02, phát hiện bản dán đầu thiếu bảng số liệu và bảng màu, rồi dùng bản đầy đủ người học gửi bổ sung. Người học yêu cầu không tự commit và dùng Conventional Commits khi được yêu cầu commit về sau.

Đã cập nhật mô phỏng theo thứ tự tick v1.1, thêm module địa hình, lướt, rơi/hồi sinh, bùa, Gió Lạc, gió định kỳ, chuỗi Đêm, pause, cài đặt, HUD và âm thanh tổng hợp Web Audio. Tệp hướng dẫn agent và CI được cập nhật cùng script kiểm chứng có thể chạy lại.

Lỗi phát hiện trong quá trình kiểm tra gồm đọc cài đặt trước khi module web sẵn sàng, shader tham chiếu tên biến cũ sau tối ưu và FPS thấp khi tính chiếu sáng từng pixel với nhiều đèn. Nút Bắt đầu hiện chờ tải xong, lỗi shader được kiểm tra bằng Chrome thật và chiếu sáng được chuyển sang đỉnh lưới phù hợp phong cách low-poly. Hình học tĩnh được gộp theo vật liệu để giảm lệnh vẽ.

Token/chi phí chưa có số đếm tính phí trực tiếp. Ước tính cho lượt triển khai Phase 2 khoảng 25.000–40.000 token, gồm mã, công cụ và kiểm chứng. Dùng chung mô phỏng, fixture nhỏ và script kiểm chứng giúp tái sử dụng ngữ cảnh. Kết quả kiểm thử và số đo thực tế nằm trong `proof/`; báo cáo này không dùng số liệu ước tính để thay bằng chứng thực thi.

Các điểm cần người học kiểm tra thêm là chất lượng âm thanh cảm nhận, chơi trọn chuỗi từ trạng thái mặc định, vị trí bắt đầu Đêm 3 và kết quả trên máy chấm. Chưa có đánh giá độc lập bởi người khác.
