# Đảo Đèn Lồng

**Phase 2 · Ba hòn đảo · Test Contract v1.1**

Điều khiển Mây qua Đảo Bến, Đảo Cau và Đảo Chuông, gom đom đóm để thắp lại những Đèn Lồng Lớn trước bình minh. Khi Bóng Mực đến gần, dùng đom đóm để tỏa sáng hoặc tìm chỗ trú quanh đèn đã thắp.

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
| `E` | Nạp đom đóm vào đèn chưa sáng gần nhất, tối đa phần còn thiếu |
| `F` | Tỏa sáng, tốn 3 đom đóm |
| `Esc` / `P` | Tạm dừng hoặc tiếp tục |

Mây bắt đầu với 3 sinh lực và mang tối đa 10 đom đóm. Mỗi đèn cần 10 đom đóm. Đứng gần đèn đã sáng để tránh Bóng Mực. Thắp đủ đèn để thắng từng Đêm và đi tiếp. Cạn sinh lực hoặc hết giờ sẽ thua, có thể chơi lại Đêm hiện tại. Đêm 1/2/3 có 5/6/7 đèn và 300/330/360 giây.

Đảo Cau có cầu tre và hai bục nhảy sang đảo bên kia. Đảo Chuông có hai dốc lên tầng 1 và bục nhảy lên tầng 2. Gió Lạc ở Đêm 2/3 có thể cướp đom đóm. Bùa Gió giúp chạy nhanh và lướt liên tục khi nhấn lại.

Mục Cài đặt ở menu và menu pause điều chỉnh âm lượng, độ nhạy chuột và lưu trên máy.

Nạp một đom đóm được 10 điểm, thắp một đèn được 100 điểm, mỗi Bóng Mực trúng Tỏa Sáng được 5 điểm. Khi thắng, cộng 2 điểm cho mỗi giây nguyên còn lại và 50 điểm cho mỗi Ngọn Lửa. Tổng điểm chỉ cộng những Đêm đã thắng.

## Kiểm thử và headless

```sh
node scripts/verify.mjs
node scripts/headless.mjs --seed 42 --night 2 --scenario docs/phase-2/proof/charm.scenario.json --inputs docs/phase-2/proof/charm.inputs.json --ticks 30 --out charm.jsonl
```

`--scenario` nhận trạng thái thử nghiệm JSON. `--inputs` nhận các frame điều khiển JSON. Tệp `--out` chứa snapshot, sự kiện và dòng tổng kết. Mặc định ghi snapshot mỗi 10 tick. Headless chạy cùng mô phỏng với bản chơi và không cần trình duyệt.

- [Test Contract và tuning](game.contract.json)
- [Đặc tả, giả định và bằng chứng Phase 2](docs/phase-2/spec.md)
- [Nhật ký AI Phase 2](docs/phase-2/ai-log.md)
- [Báo cáo kiểm thử và hiệu năng](docs/phase-2/proof/summary.json) · [Báo cáo trình duyệt](docs/phase-2/proof/browser.json)
- [Tiêu chí nghiệm thu, giả định và bằng chứng Phase 1](docs/phase-1/README.md)
- [Nhật ký AI và đánh giá Phase 1](docs/phase-1/ai-log.md)
- [Hướng dẫn lab gốc](LAB.md) · [Quy định](RULES.md) · [Rubric](RUBRIC.md) · [Checkpoints](CHECKPOINTS.md) · [Nộp bài](SUBMISSION.md)

## Sáng tạo của tôi

Bản đồ nhỏ chỉ vị trí đèn, đom đóm, Mây và Bóng Mực để người chơi tìm đường trong sương. Bản đồ chỉ đọc trạng thái ván chơi. Bằng chứng kiểm tra tính tất định v1.1 nằm trong [báo cáo Phase 2](docs/phase-2/proof/summary.json).
