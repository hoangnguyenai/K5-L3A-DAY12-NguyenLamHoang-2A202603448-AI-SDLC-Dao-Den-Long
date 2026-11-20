# Retro · Đảo Đèn Lồng

## Evaluation qua bốn phase

| Phase | Mốc kiểm tra | Điều học được |
|---|---|---|
| 1 | So sánh replay và sự kiện headless với đường chạy thắp đèn. | Route đầu tiên của AI mất hết sinh lực sau đèn thứ ba. Đọc `player_hit` cho biết đoạn nào phải đổi đường. Test vùng an toàn từng giả định sai hướng đẩy khi hai vùng giao nhau. |
| 2 | Dùng chung bản đồ và mô phỏng cho ba Đêm. Kiểm tra riêng nhặt đom đóm, bấm E, tạm dừng và khôi phục cài đặt trên trình duyệt. | Người chơi thấy nhặt hoặc nạp mà tưởng game không nhận. Số đom đóm đã nạp, sức chứa, hiệu ứng nhặt và thông báo túi trống giúp giải thích trạng thái ngay lúc thao tác. Yêu cầu “Đêm kế tiếp” cần đọc cùng luồng chiến dịch, còn cờ CLI cho phép test một đảo riêng. |
| 3 | Test một tick vừa cạn dầu vừa thắp lại, mốc 30 dầu, hút cộng dồn và cách xét bình minh sau tương tác cuối. | Đếm bằng phần nguyên 1/60 tránh sai số đúng ngưỡng. Test điểm cũ ban đầu không còn mô tả đúng sản phẩm. ADR nêu rõ luật bị thay thế để sửa kỳ vọng có lý do. |
| 4 | Chạy cùng cảnh benchmark, ghi renderer, FPS và thời gian tải; chạy 10 Đêm trong một tiến trình, đọc lại bảng điểm qua CLI và kiểm tra đổi phím sau reload. | Mức FPS của cảnh thường không dự báo được cảnh 200 Bóng. Lần đo đầu chỉ khoảng 17,5 FPS trên Microsoft Basic Render Driver. Gộp lệnh vẽ theo mesh/vật liệu và giảm lưới khi xa camera đưa kết quả lên 31,4 FPS; còn thiếu so với mốc 60. Soak lần đầu vượt giới hạn RSS. Chạy Node ở chế độ thông dịch và thu gom sau reset giúp tách bộ nhớ mã JIT khỏi phép đo vòng đời Đêm. |

## Cách làm với AI

AGENTS.md có tác dụng lớn nhất khi buộc bản web và CLI dùng chung mô phỏng. Các fixture nhỏ cho phản hồi nhanh hơn việc liên tục yêu cầu AI đọc lại toàn bộ JSONL. Việc tách renderer khỏi Night cũng cho phép tối ưu hình ảnh mà vẫn kiểm tra được quy tắc tick bằng replay. Ở chiều ngược lại, chỉ đọc test xanh dễ bỏ sót trải nghiệm: người chơi chỉ ra tín hiệu nhặt mờ nhạt và phải hỏi lại về menu chọn đảo. Kiểm tra trực tiếp thao tác và trạng thái trên màn hình đã bổ sung phần này.

Ước lượng thủ công cho cả bốn phase: khoảng 20–30 nghìn token ở Phase 1, 25–40 nghìn ở Phase 2 (theo hai nhật ký), 12–25 nghìn ở Phase 3 và 20–40 nghìn ở Phase 4. Tổng khoảng **77–135 nghìn token**, gồm đọc ngữ cảnh, mã và kiểm chứng. Không có hóa đơn, thống kê cache hay phân bổ input/output để xác định số tiền đã tính. Nếu tự lập ngân sách với đơn giá gộp giả định 10 USD/triệu token, khoảng này tương ứng **0,77–1,35 USD**. Đây là ước tính theo giả định, không phải giá dịch vụ hay số tiền đã thanh toán. Tiết kiệm bằng cách đọc đoạn thay đổi, dùng lại CLI và chỉ xem dòng sự kiện liên quan.

Nếu làm lại, nên thêm cảnh tải cao từ Phase 1 và đo trên phần cứng gần máy chấm ngay khi đổi shader. Nên cho người chơi thử vòng “nhặt → nạp một phần → quay lại” cùng HUD trước khi mở rộng bản đồ. Bước nghiệm thu cuối cần đối chiếu tệp thật trong bản ZIP với lệnh README, sau đó thử lại trên máy của giảng viên. Kết quả local chưa thay cho test ẩn và số đo máy chấm.
