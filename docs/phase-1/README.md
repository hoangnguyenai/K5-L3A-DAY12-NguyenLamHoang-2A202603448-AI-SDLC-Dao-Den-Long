# Phase 1 · Tiêu chí nghiệm thu và bằng chứng

Phạm vi theo PRD-0 và Test Contract v1.0. Mô phỏng và hiển thị tách riêng. Bản web và CLI đọc cùng [tuning](../../game.contract.json) và chạy cùng các luật chơi.

## Giả định đã dùng

- Đảo tròn bán kính 42 m, năm đèn `L1`–`L5` cách tâm 24 m. Mây dừng ở mép đảo. `fall_enabled` là `false` và bị chạm không làm rơi đom đóm (`hit_drop_ratio` là `0`).
- Mây có 3 sinh lực và 300 giây. Mỗi lần chạm hợp lệ làm mất 1 sinh lực, sau đó bất tử 1,25 giây. Mọi bán kính tính trên XZ, kể cả khi Mây đang nhảy.
- Đom đóm được nhặt tự động đến khi đầy. Một lần nhấn nạp vào đèn chưa sáng gần nhất, giữ phần dư trong túi. Đèn sáng khi nạp đủ 6 đom đóm. Chỉ đèn đã sáng có vùng an toàn. Khi nhiều tương tác cùng tick, nhặt trước, nạp sau, rồi mới tỏa sáng và xử lý Bóng Mực. Thắp đủ đèn kết thúc ván ở tick đó.
- Tỏa sáng tiêu hao 2 đom đóm, hồi chiêu 0,75 giây, đẩy Bóng Mực trong phạm vi 5,5 m lùi 2,5 m và làm choáng 2,5 giây. Nếu không đủ đom đóm hoặc còn hồi chiêu thì không phát sự kiện pulse.
- Mặc định có 55 đom đóm và 3 Bóng Mực ban đầu. Game có thể bổ sung đom đóm mỗi 10 giây khi còn dưới 40 và sinh thêm Bóng Mực mỗi 25 giây đến tối đa 6. Cờ scenario `random_motes` và `random_shades` có thể tắt các lượt sinh tự động.
- Ván chơi trên trình duyệt dùng seed 42 để dễ chơi lại và tái hiện. Tiền thưởng thời gian và sinh lực chỉ cộng khi thắng. Công thức điểm nằm trong [README](../../README.md).

## Kiểm chứng

| Yêu cầu | Cách kiểm chứng | Kết quả quan sát |
|---|---|---|
| Đêm 1 có cảnh 3D, camera, Mây đội nón lá, HUD và bản đồ | Build, phục vụ qua HTTP, mở bản web | Màn mở đầu và ván đang chơi hiển thị. Kiểm tra HUD quan sát được `4/10` đom đóm, `40` điểm và đồng hồ `04:55`. |
| Đi theo camera và nhảy | Test 1 và 3 | Xoay `90°` đưa di chuyển tới `+X`, đường chéo chuẩn hóa, nhảy có độ cao dương rồi về mặt đất. |
| Nhặt đom đóm, giới hạn túi, nạp một phần, thắp đủ | Test 2, 4, 6 và [JSONL lượt thắng](night1-win.jsonl) | Nhặt tại đúng bán kính, không vượt 10 đom đóm, nạp đúng phần đèn còn thiếu. Lượt seed 42 thắp đủ 5 đèn ở tick 2.030, đạt 1.156 điểm. |
| Bóng Mực, tỏa sáng, vùng an toàn, mất sinh lực | Test 2–5 và [JSONL tỏa sáng](pulse.jsonl) | Bóng Mực ở rìa bán kính bị hất lùi và choáng. Giữ nút không lặp. Đèn sáng bảo vệ Mây. Va chạm mất sinh lực theo khoảng bất tử. |
| Điều kiện thắng, thua và chơi lại | Test 5–6, quan sát HUD trên bản web | Headless kết thúc với `all_lit`, `no_flames` hoặc `dawn` theo tình huống. Bản web trở lại HUD ban đầu khi chơi lại. |
| Định dạng, mã thoát và tính tất định | Test 1, 2, 6, 7 | Kiểm tra tick 0, snapshot đúng chu kỳ, tên sự kiện, dòng `end`, mã 2 cho JSON sai cấu trúc. Hai lượt cùng tham số cho JSONL giống từng byte. |
| Khởi chạy trên macOS hoặc Linux | Build và test tự động cấu hình chạy trên Ubuntu và macOS | Đã chạy build và test trong môi trường Windows với Node 22. Kết quả trực tiếp trên macOS/Linux cần chờ CI. |

[Báo cáo TAP của lần chạy](tests.tap) có **7/7 test đạt**. Đây là bộ tự kiểm của dự án. Bộ test ẩn của giảng viên chưa được chạy.

```sh
node tests/phase-1.mjs
node scripts/headless.mjs --seed 42 --night 1 --inputs tests/fixtures/night1-route.json --ticks 2500 --snapshot-every 900 --out night1-win.jsonl
node scripts/headless.mjs --seed 42 --night 1 --scenario tests/fixtures/pulse-scenario.json --inputs tests/fixtures/pulse-inputs.json --ticks 3 --snapshot-every 1 --out pulse.jsonl
```
