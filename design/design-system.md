# Design System — FutureBoxes (hướng Airmail)

Tài liệu bàn giao để implement UI. Đọc hết trước khi code.

- **Hướng đã chốt**: "Thư gửi đường hàng không" — hộp thời gian là một **lá thư niêm phong**.
- **Preview token**: Claude Design project `e7cc2fe8-f766-4c04-8957-80eefc470e20`, file `tokens.html`.
- **Đã loại bỏ**: hướng kính mờ iOS, hướng két thời gian, hướng giấy cắt dán (sách tranh).

---

## 1. Ràng buộc bắt buộc

| Điều | Chi tiết |
|---|---|
| **Không đổi nghiệp vụ** | Không sửa `src/hooks/*`, `src/services/*`, `supabase/*`. Chỉ đổi lớp hiển thị. |
| **Test phải xanh** | 58 test hiện có phải pass nguyên. `npx tsc --noEmit` sạch. |
| **Chỉ một theme sáng** | Giấy màu tối trông sai. Bỏ nhánh dark trong `Colors`, ép light. |
| **Server vẫn quyết định** | Countdown hiển thị chỉ để trang trí. Điều kiện mở hộp vẫn do RPC `open_box` quyết. |

---

## 2. Token

Viết lại `src/constants/theme.ts` theo đúng bảng này.

### Màu

| Token | Giá trị | Dùng cho |
|---|---|---|
| `ground` | `#E9E4D6` | Nền màn hình |
| `paper` | `#F6F2E7` | Giấy nổi: card, tờ thư, ô nhập |
| `paperDim` | `#EFEADB` | Giấy hộp còn khóa |
| `ink` | `#232019` | Chữ chính |
| `ink2` | `#5C5445` | Chữ phụ |
| `ink3` | `#8A7C63` | Nhãn mono, ngày tháng, meta |
| `rule` | `#D6CDB6` | Viền giấy |
| `ruleSoft` | `#DDD4BE` | Bóng giấy nằm sát |
| `blue` | `#1F4E79` | Hành động chính: nút Lưu, FAB, link |
| `red` | `#B33A2B` | Dấu mộc, niêm phong, sọc airmail, lỗi |

Xóa toàn bộ mã màu rải rác hiện tại: `#208AEF`, `#F0F0F3`, `#d92d20`, `#e6f4ea`, `#137333`.

### Chữ

Cài `@expo-google-fonts/lora`, nạp qua `expo-font` trong `src/app/_layout.tsx`, chặn render tới khi font sẵn sàng.

| Vai trò | Font | Cỡ | Đậm |
|---|---|---|---|
| Tiêu đề màn | Lora | 26 | 600 |
| Tiêu đề hộp | Lora | 16 | 600 |
| Nội dung thư | Lora | 16.5 | 400 |
| Chữ phụ | Lora | 13 | 400 |
| Nhãn mono | hệ thống mono | 10 | 400, letterSpacing 1.2, viết hoa |

Mono dùng `Platform.select({ ios: 'Menlo', android: 'monospace' })`.

### Khoảng cách, hình khối

```
s1 4 · s2 8 · s3 12 · s4 16 · s5 24 · s6 32
radius: 2            (giấy không bo tròn — mọi nơi)
shadowFlat: { shadowColor:'#DDD4BE', shadowOffset:{width:1,height:1}, shadowOpacity:1, shadowRadius:0, elevation:1 }
shadowLift: { shadowColor:'rgba(35,32,25,0.18)', shadowOffset:{width:5,height:6}, shadowOpacity:1, shadowRadius:0, elevation:3 }
tilt: từ -1.5deg đến 1.5deg
```

`shadowRadius` luôn bằng 0 — bóng cứng, không đổ mờ.

---

## 3. Chuyển động

Mọi animation dùng `Easing.steps()` của Reanimated để giật nhẹ có chủ đích, như quay từng khung hình. Không dùng easing mượt.

| Tên | Thời lượng | Bước | Mô tả |
|---|---|---|---|
| `stampDown` | 480ms | 4 | Dấu mộc rơi xuống: `scale 1.9→1`, `rotate -24deg→-11deg`, `opacity 0→0.85` |
| `unfold` | 700ms | 5 | Thư gập mở: `scaleY 0.04→1`, gốc biến đổi ở mép trên |
| `nudge` | 260ms | 2 | Rung từ chối khi chạm hộp còn khóa: `translateX 0→-4→4→0` |

Tôn trọng `AccessibilityInfo.isReduceMotionEnabled()` — bật thì bỏ animation, hiện trạng thái cuối luôn.

---

## 4. Component mới

Đặt tại `src/components/paper/`.

| File | Nội dung |
|---|---|
| `paper-grain.tsx` | Lớp phủ hạt giấy. Dùng ảnh PNG noise lặp trong `assets/images/grain.png`, `opacity 0.5`, `pointerEvents="none"`. Không dùng SVG filter — RN không hỗ trợ tốt. |
| `airmail-stripe.tsx` | Sọc viền đỏ-xanh chéo, cao 7px. Vẽ bằng `react-native-svg`: các `Rect` xoay -45°, lặp `#B33A2B` → nền → `#1F4E79` → nền, mỗi khoảng 9px. |
| `postmark-stamp.tsx` | Vòng tròn 46px, viền 1.5px `#B33A2B`, xoay -11deg, `opacity 0.82`. Bên trong: ngày, tháng dạng `TH07`, năm — mono 8.5px, canh giữa. Prop `animateIn` bật `stampDown`. |
| `paper-card.tsx` | Thẻ giấy. Props: `status: 'locked' \| 'ready' \| 'opened'`, `title`, `preview`, `openAt`, `hasQuestion`, `hasPhoto`. Xem mục 5. |
| `countdown-label.tsx` | Nhãn mono hiển thị thời gian còn lại. Tự cập nhật mỗi phút bằng `setInterval`, dọn khi unmount. |
| `section-label.tsx` | Nhãn nhóm: mono 10px, viết hoa, letterSpacing 1.4, màu `ink3`, kèm số lượng bên phải. |
| `letter-sheet.tsx` | Tờ thư nền `paper`, viền `rule`, `shadowLift`, animation `unfold` khi mở. |
| `stamp-button.tsx` | Nút dạng tem: viền đứt 1.5px, mono viết hoa, letterSpacing 1. Biến thể `primary` viền `blue`, `muted` viền `ink3`. Khi bấm đóng `postmark-stamp` đè lên. |

---

## 5. Ba trạng thái hộp — phải đọc được bằng hình

Đây là thiếu sót lớn nhất của bản đang chạy: ba trạng thái hiện trông y hệt nhau, chỉ khác một dòng chữ nhỏ.

| Trạng thái | Nền | Dấu hiệu thị giác | Tương tác |
|---|---|---|---|
| **Đang khóa** | `paperDim` | Dấu mộc đỏ góc phải trên · nhãn đếm ngược `còn N ngày` | Chạm → chạy `nudge`, hiện thời gian còn lại. Không điều hướng. |
| **Sẵn sàng mở** | `paper` | Dấu mộc đỏ · chấm tròn đặc `red` 9px bên trái dòng meta · dòng `Đã tới ngày` | Chạm → sang `/(app)/box/[id]` |
| **Đã mở** | `paper` | Mép trên giấy rách răng cưa (SVG `Path` zigzag, cao 9px, màu `ground`) · dòng meta ghi câu trả lời | Chạm → sang chi tiết, chỉ đọc |

---

## 6. Màn hình cần sửa

| File | Việc |
|---|---|
| `src/constants/theme.ts` | Viết lại toàn bộ theo mục 2. Bỏ nhánh dark. |
| `src/app/_layout.tsx` | Nạp font Lora, chặn render tới khi xong. Bọc `PaperGrain` toàn app. |
| `src/app/(app)/index.tsx` | Thay `card`/`cardLocked` bằng `PaperCard`. Thêm `AirmailStripe` trên cùng. Nhãn nhóm dùng `SectionLabel`. FAB đổi sang `blue`, vuông 2px thay vì tròn. |
| `src/app/(app)/box/[id].tsx` | Bọc nội dung trong `LetterSheet` có `unfold`. Nút Có/Chưa đổi sang `StampButton`. Bỏ hiệu ứng phóng to emoji hiện tại, thay bằng `stampDown` đóng dấu "ĐÃ TRẢ LỜI". |
| `src/app/(app)/create-box.tsx` | Ô nhập kiểu giấy: nền `paper`, viền `rule`, radius 2. |
| `src/app/(app)/box/[id]/edit.tsx` | Theo create-box. |
| `src/app/(auth)/login.tsx`, `register.tsx` | Nền `ground`, `AirmailStripe` trên cùng, nút chính `blue`. |
| `src/components/form-field.tsx` | Đổi màu theo token mới. Giữ nguyên props và hành vi — có test phụ thuộc. |

---

## 7. Phụ thuộc cần cài

```bash
npx expo install react-native-svg
npm install @expo-google-fonts/lora
```

`react-native-reanimated` và `expo-font` đã có sẵn.

Cần thêm `assets/images/grain.png` — ảnh noise xám 200×200 lặp được, độ mờ thấp.

---

## 8. Hoàn thành khi

- [ ] `npx tsc --noEmit` không lỗi
- [ ] `npm test` — 58 test cũ vẫn xanh, thêm test cho `PaperCard` phủ đủ ba trạng thái
- [ ] Ba trạng thái hộp phân biệt được khi nhìn ảnh chụp màn hình đen trắng, không đọc chữ
- [ ] Chạm hộp còn khóa có rung, không điều hướng
- [ ] Mở hộp có thư gập ra, trả lời có đóng dấu mộc
- [ ] Không còn mã màu nào nằm ngoài `theme.ts` trong `src/`
- [ ] Chạy thật trên iPhone qua Expo, không cảnh báo font hay animation
