# Đảo Đèn Lồng

**Phase 1 · Đêm 1 – Đảo Bến**

Điều khiển Mây đi quanh đảo, nhặt đom đóm và thắp lại năm Đèn Lồng Lớn trước bình minh. Khi Bóng Mực đến gần, dùng đom đóm để tỏa sáng hoặc tìm chỗ trú quanh đèn đã thắp.

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
| `Q` / `R` hoặc kéo trên cảnh | Xoay camera |
| `E` | Nạp đom đóm vào đèn chưa sáng gần nhất, tối đa phần còn thiếu |
| `F` | Tỏa sáng, tốn 2 đom đóm |
| `Esc` | Tạm dừng hoặc tiếp tục |

Mây bắt đầu với 3 sinh lực và mang tối đa 10 đom đóm. Mỗi đèn cần 6 đom đóm. Đứng gần đèn đã sáng để tránh Bóng Mực. Thắp cả năm đèn để thắng. Cạn sinh lực hoặc hết 5 phút khiến ván chơi kết thúc. Nút **Chơi lại** bắt đầu lại Đêm 1.

Nhặt một đom đóm được 10 điểm, thắp một đèn được 100 điểm, làm choáng một Bóng Mực được 20 điểm. Khi thắng, cộng 1 điểm cho mỗi giây nguyên còn lại và 50 điểm cho mỗi sinh lực còn lại.

## Kiểm thử và headless

```sh
node tests/phase-1.mjs
node scripts/headless.mjs --seed 42 --night 1 --inputs tests/fixtures/night1-route.json --ticks 2500 --snapshot-every 900 --out night1-win.jsonl
```

`--scenario` nhận trạng thái thử nghiệm JSON. `--inputs` nhận các frame điều khiển JSON. Tệp `--out` chứa snapshot, sự kiện và dòng tổng kết. Mặc định ghi snapshot mỗi 10 tick. Headless chạy cùng mô phỏng với bản chơi và không cần trình duyệt.

- [Test Contract và tuning](game.contract.json)
- [Tiêu chí nghiệm thu, giả định và bằng chứng Phase 1](docs/phase-1/README.md)
- [Nhật ký AI và đánh giá Phase 1](docs/phase-1/ai-log.md)
- [Hướng dẫn lab gốc](LAB.md) · [Quy định](RULES.md) · [Rubric](RUBRIC.md) · [Checkpoints](CHECKPOINTS.md) · [Nộp bài](SUBMISSION.md)

## Sáng tạo của tôi

Bản đồ nhỏ chỉ vị trí đèn, đom đóm, Mây và Bóng Mực để người chơi tìm đường trong sương. Bản đồ chỉ đọc trạng thái ván chơi. Bằng chứng chạy toàn bộ màn và kiểm tra tính tất định nằm trong [bản ghi headless](docs/phase-1/night1-win.jsonl) và [báo cáo kiểm thử](docs/phase-1/tests.tap).
