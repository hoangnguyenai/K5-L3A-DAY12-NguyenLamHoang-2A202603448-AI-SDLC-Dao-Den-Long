# Đảo Đèn Lồng

**Phase 3 · Đèn cạn dầu · Test Contract v1.2**

Đưa Mây qua ba hòn đảo và giữ đủ đèn sáng tới bình minh. Đèn còn ít dầu sẽ nhấp nháy và thu hút Bóng Mực. Dùng Tỏa Sáng để ngắt hút dầu, hoặc châm thêm dầu để khôi phục vùng an toàn.

## Cài và chạy

Cần Node.js 22 trở lên và trình duyệt hỗ trợ WebGL. Từ thư mục repo trên macOS, Linux hoặc Windows, chạy hai lệnh sau, rồi mở [bản chơi tại localhost](http://127.0.0.1:4173/).

```sh
node scripts/build.mjs
node scripts/serve.mjs
```

Build tạo một bản web tĩnh trong `dist/`. Game không cần tải thư viện, font hay tài sản từ mạng.

## Điều khiển

| Phím | Hành động |
|---|---|
| `W A S D` hoặc phím mũi tên | Di chuyển theo góc camera, tự nhặt đom đóm trong tầm |
| `Space` | Nhảy |
| `Shift` | Lướt |
| `Q` / `R` hoặc kéo trên cảnh | Xoay camera |
| `E` | Nạp hoặc châm dầu cho đèn nhận được gần nhất trong 2 m |
| `F` | Tỏa sáng, tốn 3 đom đóm |
| `Esc` / `P` | Tạm dừng hoặc tiếp tục |

Mỗi Đêm bắt đầu với 3 Ngọn Lửa và túi 10 ô. Lần thắp đầu cần 10 đom đóm, thắp lại cần 5. Mỗi lần thắp tăng sức chứa thêm 2, tới 20. Mỗi đom đóm châm được 10 dầu. Từ 30 dầu trở lên, đèn bảo vệ khu vực bán kính 6 m. Khi hết 240/270/300 giây, cần còn sống và giữ sáng ít nhất 3/5, 4/6 hoặc 5/7 đèn tương ứng.

Đảo Cau có cầu tre và hai bục nhảy sang đảo bên kia. Đảo Chuông có hai dốc lên tầng 1 và bục nhảy lên tầng 2. Gió Lạc ở Đêm 2/3 có thể cướp đom đóm. Bùa Gió giúp chạy nhanh và lướt liên tục khi nhấn lại.

Cài đặt lưu âm lượng, độ nhạy chuột và tùy chọn “Bảng màu dễ phân biệt” trên máy.

Mỗi đom đóm nạp được 5 điểm. Thắp lần đầu thưởng 100, thắp lại thưởng 40. Tỏa Sáng trúng Bóng Mực được 15 điểm nếu nó đang hút dầu, các trạng thái khác được 5. Khi thắng, mỗi đèn sáng thưởng 50 cộng phần nguyên lượng dầu, mỗi Ngọn Lửa còn lại thưởng 50. Tổng điểm chỉ tính các Đêm đã thắng.

## Kiểm thử và headless

```sh
node scripts/verify.mjs
node scripts/headless.mjs --seed 42 --night 2 --scenario docs/phase-2/proof/charm.scenario.json --inputs docs/phase-2/proof/charm.inputs.json --ticks 30 --out charm.jsonl
```

`--scenario` nhận trạng thái thử nghiệm JSON. `--inputs` nhận các frame điều khiển JSON. Tệp `--out` chứa snapshot, sự kiện và dòng tổng kết. Mặc định ghi snapshot mỗi 10 tick. Headless chạy cùng mô phỏng với bản chơi và không cần trình duyệt.

- [Test Contract và tuning](game.contract.json)
- [Quyết định thiết kế Phase 3](docs/phase-3/ADR.md) · [Changelog](docs/phase-3/CHANGELOG.md) · [Kiểm thử](docs/phase-3/proof/summary.json) · [Đo FPS](docs/phase-3/proof/browser.json)
- [Đặc tả, giả định và bằng chứng Phase 2](docs/phase-2/spec.md)
- [Nhật ký AI Phase 2](docs/phase-2/ai-log.md)
- [Báo cáo kiểm thử và hiệu năng](docs/phase-2/proof/summary.json) · [Báo cáo trình duyệt](docs/phase-2/proof/browser.json)
- [Tiêu chí nghiệm thu, giả định và bằng chứng Phase 1](docs/phase-1/README.md)
- [Nhật ký AI và đánh giá Phase 1](docs/phase-1/ai-log.md)
- [Hướng dẫn lab gốc](LAB.md) · [Quy định](RULES.md) · [Rubric](RUBRIC.md) · [Checkpoints](CHECKPOINTS.md) · [Nộp bài](SUBMISSION.md)

## Sáng tạo của tôi

Bản đồ nhỏ chỉ vị trí đèn, đom đóm, Mây và Bóng Mực để người chơi tìm đường trong sương. Bản đồ chỉ đọc trạng thái ván chơi. Bằng chứng kiểm tra tính tất định v1.1 nằm trong [báo cáo Phase 2](docs/phase-2/proof/summary.json).
