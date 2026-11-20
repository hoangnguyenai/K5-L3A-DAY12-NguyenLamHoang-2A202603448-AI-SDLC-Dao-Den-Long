# ADR 003 · Vòng đời đèn và bình minh

Chấp nhận cho Contract v1.2. Playtest cho thấy thắp đủ đèn quá sớm làm mất mục tiêu trong phần cuối Đêm. Mây phải quyết định khi nào thắp đèn mới và khi nào quay lại bảo vệ dầu.

Mỗi đèn giữ tiến độ nạp, trạng thái sáng, lượng dầu, cờ từng sáng và số lần thắp lại. Mô phỏng lưu một đơn vị dầu bằng 60 phần nguyên. Mỗi tick đang chạy trừ một phần hao tự nhiên cộng năm phần cho mỗi Bóng đang hút. Dùng số nguyên để nhiều Bóng hút đồng thời vẫn tắt đèn đúng tick. Snapshot làm tròn đến một chữ số thập phân. Tính điểm và kiểm tra ngưỡng bằng giá trị nội bộ.

Đèn cạn dầu tắt ngay ở bước giảm bộ đếm. Bước tương tác sau đó cho phép Mây thắp lại ngay cùng tick. Châm tới đúng 30 phục hồi vùng an toàn ngay ở bước cập nhật vùng. Mỗi Bóng ghi sự kiện sau từng 60 tick hút liên tiếp. Mỗi lần thắp thành công tăng sức chứa trong Đêm, kể cả thắp lại. Dựng scenario và châm dầu giữ nguyên bộ đếm này.

Xét kết quả sau bước chạm và sinh thực thể. Hết Ngọn Lửa ưu tiên trước. Nếu còn sống, chỉ xét ngưỡng 60% khi đồng hồ hết giờ. Điều này cho phép hành động cuối cùng của người chơi quyết định kết quả và tiền thưởng dầu. Chọn tiếp tục lưu tổng điểm ở màn hình kết quả của các Đêm thắng để chơi lại giữ nguyên điểm các Đêm trước.
