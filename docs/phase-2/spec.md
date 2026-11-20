# Phase 2 · Ba hòn đảo

Đặc tả theo Ticket-02 người học cung cấp trong cuộc trao đổi, Contract v1.1. Các thay đổi hiện ở working tree để người học xem và quyết định commit.

## Tiêu chí nghiệm thu

| Mục Phần 3 | Tiêu chí có thể kiểm tra | Bằng chứng |
|---|---|---|
| 1. Gió Lạc | Đêm 2/3 sinh D1, D2 theo chu kỳ 1.200 tick, tối đa 2. Mang ít nhất 5 và cách tối đa 15 m thì đuổi. Va chạm cướp tối đa 3 trước hit của Bóng Mực, bất tử không ngăn cướp. Pulse lúc chase xua đi, pulse lúc flee có đồ làm rơi lại đồ, sau 120 tick biến mất. | Test `headless Gió Lạc`, test lịch sinh; scenario `drifter-steal` và `drifter-drop` trong `proof/`. |
| 2. Bùa Gió | Nhặt C1/C2 theo bán kính và độ cao của đom đóm, hiệu lực 600 tick, chạy 7,2 m/s, cho lướt lại khi nhấn mới và lần lướt trước đã kết thúc. Bùa hồi sau 2.700 tick. | Test `headless Bùa Gió`, scenario `charm`. |
| 3. Chuỗi 3 Đêm | Menu mở giới thiệu tên đảo cùng lời Ông Đăng. Thắng chuyển qua kết quả và nút Đêm kế tiếp. Thua chơi lại Đêm hiện tại. Thắng Đêm 3 hiện Bình Minh, tổng điểm chỉ gồm các Đêm thắng. | Test điều kiện thắng/thua và scenario `night-1-win` đến `night-3-win`. Kiểm tra trình duyệt gồm menu, giới thiệu và chơi lại. Cần người học chơi trọn chuỗi để xác nhận trải nghiệm từ đầu tới cuối. |
| 4. Pause | Esc/P dừng gameplay. Menu tạm dừng có Tiếp tục, Chơi lại Đêm, Cài đặt, Về menu. Headless khi pause vẫn tăng tick nhưng sim_tick, cooldown, TTL và thời gian đứng yên. | Test `headless pause`, `pause.jsonl`, kiểm tra đồng hồ trên trình duyệt. |
| 5. Cài đặt | Âm lượng 0–100% và độ nhạy chuột lưu được sau khi tải lại trang. Khi trình duyệt chặn lưu trữ, thay đổi vẫn dùng được trong phiên và có thông báo. | Test lưu trữ và kiểm tra reload trong `browser.json`. |
| 6. Âm thanh | Web Audio có nhạc nền và hiệu ứng nhặt, thắp đèn, tỏa sáng, hit, nhảy, lướt, thắng/thua, spawn Bóng Mực, đếm ngược 10 giây. Chỉ khởi động audio sau thao tác người chơi. | `src/audio.mjs`, sự kiện từ mô phỏng và trình duyệt không có lỗi runtime. Chất lượng cảm nhận âm thanh cần người học nghe thử. |
| 7. HUD | Ngọn Lửa trái trên, đồng hồ giữa trên đổi đỏ và nhấp nháy khi còn ≤30 giây, đèn và điểm phải trên, 10 ô đom đóm giữa dưới, hồi chiêu phải dưới. Có nhắc nạp và hướng tới đèn chưa sáng gần nhất ngoài khung hình. | Ảnh `night-1.png`, cập nhật HUD từ cùng trạng thái game. |
| 8. Bảng màu | Màu vật liệu dùng các mã hex trong ticket. Ánh sáng môi trường tính `0.15 + 0.55 × tiến độ đèn`. | Palette và shader trong `src/scene.mjs`, màu UI trong `style.css`. Cần đối chiếu mỹ thuật bằng mắt cùng ánh sáng động. |

## Số liệu và bản đồ

`game.contract.json` dùng số chuẩn Ticket-02. `score.per_mote` và `score.per_deposit` cùng là 10, tính cho mỗi đom đóm **nạp**. Việc nhặt chỉ phát sự kiện và tăng túi. Chuyển sang luật chuẩn thay thế cách tính điểm của Phase 1.

`src/maps.mjs` khai báo vị trí đèn, điểm sinh, bục nhảy, cầu, địa hình tầng và dốc. Đảo Bến bán kính 40 m, Đảo Cau hai đĩa 28 m với cầu x=26–44, Đảo Chuông bán kính 45 m có tầng 3/6 m và tháp 8 m. Mọi bản đồ dùng chung va chạm địa hình với headless.

Thứ tự mô phỏng được giữ theo ticket: pause → giảm bộ đếm → di chuyển/rơi → nhặt → nạp → vùng an toàn → pulse → chuyển động kẻ địch → cướp và hit → spawn → kết quả. `sim_tick` chỉ tăng trong bước gameplay. Đồ rơi và thực thể sinh trong tick chỉ tương tác từ bước sau.

## Giả định cho chỗ chưa được quy định chi tiết

- `night_start` được phát ở bước gameplay đầu tiên, sau snapshot tick 0. Scenario không phát sự kiện hoặc cộng điểm khi được dựng.
- Bóng Mực mặc định wander với tốc độ 2 m/s; spawning kéo dài tới bước sau. Tốc độ đuổi dùng đúng 4/4,5 m/s. Bóng trong vùng đèn mới sáng bị đẩy ra với tốc độ tối thiểu 0,2 m/tick, trong tối đa 30 tick khi không chồng vùng sáng.
- Spawn đom đóm thường có trần 30; đồ rơi có TTL được giữ riêng để không làm mất vật phẩm rơi từ hit. Điểm trống xét cả vật phẩm rơi đang ở đúng điểm sinh.
- Snapshot dùng `invuln` kiểu boolean, `ttl_s: null` cho đom đóm thường không hết hạn. Các số thời gian còn lại có thể là phân số tick/60. Tọa độ và vận tốc làm tròn ba số lẻ.
- Đêm 3 có vị trí xuất phát (0,0,0) theo quy ước gốc dù tâm đảo có tầng 2 ở Y=6. Bản này giữ xuất phát tại lớp nền Y=0 dưới tầng 2, cho đi ra ngoài chân tầng; đi vào các mép tầng từ phía ngoài vẫn bị vách chặn. Đây là điểm cần đối chiếu lại nếu giảng viên chỉ định vị trí xuất phát riêng cho Đêm 3.
- Tháp là vật cản hình trụ bán kính 2 m ở Y=6–14. Đường phóng của bục nhảy hướng −Z và vận tốc ngang không bị phím điều khiển ghi đè cho tới lúc đáp.

## Kiểm chứng lại

```sh
node scripts/verify.mjs
node scripts/serve.mjs
node scripts/browser-check.mjs
```

Lệnh cuối cần Chrome cài sẵn. Trên Linux có thể đặt biến `LANTERN_CHROME` tới Chrome/Chromium. Lệnh đo trình duyệt dùng profile thử riêng, WebGL gốc ở 1280×720, lưu báo cáo và ảnh trong `proof/`. FPS được đo trong cửa sổ 5 giây của requestAnimationFrame. Preview Đêm 2/3 có nhiều đèn sáng và dùng đúng Scene của game.

`proof/summary.json` ghi cấu hình máy, kết quả tất định và thời gian headless. Scenario thắng mỗi Đêm dựng sẵn các đèn còn lại đã sáng để kiểm tra điều kiện thắng và tính điểm cuối. Những scenario này không chứng minh khả năng tự chơi trọn ba Đêm từ trạng thái mặc định. Bộ test ẩn và kết quả trực tiếp macOS/Linux chưa có trong môi trường này.

## Thay đổi kiểm thử Phase 1

Các kiểm tra cơ chế di chuyển, nhặt, nạp, thắng/thua và tính tất định vẫn được chạy trong `tests/phase-1.mjs` với số chuẩn. Các kỳ vọng cũ như 6 đom đóm/đèn, pulse hất tức thời, nhặt không xét độ cao, điểm cộng lúc nhặt, giữ ở mép đảo, route thắng dựa theo vị trí cũ được thay thế theo Ticket-02. Bằng chứng Phase 1 gốc giữ trong `docs/phase-1/` và tag `phase-1`.
