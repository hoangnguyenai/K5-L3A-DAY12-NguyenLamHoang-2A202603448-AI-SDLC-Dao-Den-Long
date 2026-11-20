# Hướng dẫn làm việc với Đảo Đèn Lồng

- Đọc yêu cầu của phase hiện tại. Ghi các giả định và tiêu chí nghiệm thu trước khi đổi luật chơi.
- Đặt logic cố định 60 tick/giây trong `src/simulation.mjs`. Bản web và headless dùng chung mô phỏng và `game.contract.json`.
- Chạy `node scripts/build.mjs` và `node tests/phase-1.mjs` sau khi đổi game. Sửa lỗi và chạy lại nếu test đỏ. GitHub Actions chạy cùng các lệnh trên Ubuntu và macOS.
- Dùng `node scripts/serve.mjs` để xem bản web. Kiểm tra camera, HUD, điều khiển và vòng chơi lại khi đổi phần hiển thị.
- Lưu đầu ra nguyên gốc và chỉ rõ yêu cầu được kiểm chứng. Khi ticket thay đổi hành vi cũ, ghi lý do và chạy các test còn hiệu lực.
- Giữ lịch sử tag và file harness. Không đưa bí mật vào repo.
