# Hướng dẫn làm việc với Đảo Đèn Lồng

- Đọc yêu cầu của phase hiện tại. Ghi các giả định và tiêu chí nghiệm thu trước khi đổi luật chơi.
- Đặt logic cố định 60 tick/giây trong `src/simulation.mjs`. Bản web và headless dùng chung mô phỏng và `game.contract.json`.
- Phase 3 dùng Contract v1.2. Ticket-03 thay luật dầu, vùng an toàn, sức chứa, điểm và bình minh. Ticket-02 tiếp tục quy định các cơ chế còn lại. `src/maps.mjs` giữ hình học ba đảo. Thứ tự tick trong `src/simulation.mjs` phải theo ticket, kể cả khi pause, rơi và spawn.
- Chạy `node scripts/verify.mjs` để build, kiểm thử hồi quy, scenario từng tính năng, kiểm tra tính tất định và đo 18.000 tick. Sửa lỗi và chạy lại nếu test đỏ. GitHub Actions chạy cùng lệnh trên Ubuntu và macOS.
- Dùng `node scripts/serve.mjs` để xem bản web. Kiểm tra camera, HUD, điều khiển và vòng chơi lại khi đổi phần hiển thị.
- Lưu đầu ra nguyên gốc và chỉ rõ yêu cầu được kiểm chứng. Khi ticket thay đổi hành vi cũ, ghi lý do và chạy các test còn hiệu lực.
- Giữ lịch sử tag và file harness. Không đưa bí mật vào repo.
- Người dùng yêu cầu để các thay đổi chưa commit. Chỉ commit khi được yêu cầu và dùng tiền tố Conventional Commits như `feat:`, `docs:`, `refactor:`.
