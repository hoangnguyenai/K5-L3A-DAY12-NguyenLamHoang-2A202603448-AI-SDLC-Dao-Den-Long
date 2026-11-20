# Thay đổi phá vỡ tương thích · v1.2

- Thời lượng ba Đêm chuyển thành 240, 270 và 300 giây. Kết quả thắng dùng `dawn_survived`. Điều kiện thắng sớm `all_lit` bị bỏ.
- Đèn sáng có thể được châm và có thể tắt. Dưới 30 dầu, vùng bảo vệ biến mất và Bóng Mực có thể chuyển sang `drain`. Thắp lại tốn 5.
- Túi tăng từ 10 lên tối đa 20 theo số lần thắp thành công trong Đêm.
- Điểm mỗi đom đóm nạp giảm từ 10 xuống 5. Thêm thưởng thắp lại, ngắt hút và dầu còn lại khi thắng. Bỏ thưởng thời gian.
- Snapshot bổ sung `fuel`, `ever_lit`, `relit_count` và `player.capacity`. Scenario hỗ trợ lượng dầu, lịch sử đèn, số lần thắp và đèn mục tiêu của Bóng. Thêm sự kiện `refuel`, `lantern_out`, `fuel_drain` và trường `lantern_lit.relight`.
- Test Phase 1 thay số điểm thắp và thưởng cuối Đêm vì công thức cũ đã hết hiệu lực. Test pause Phase 2 lấy mốc 240 giây. Scenario thắng ba đảo đặt đồng hồ tới tick bình minh. Test cài đặt kiểm tra cả tùy chọn màu mới. Các báo cáo Phase 1–2 được giữ để đối chiếu.
