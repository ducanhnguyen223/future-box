# Loại hộp + Nghi thức mở hộp — Design Spec

Ngày: 2026-08-02
Trạng thái: đã duyệt, chờ chuyển sang implementation plan

---

## 1. Vấn đề

App chạy được nhưng danh sách hộp trông đơn điệu. Nguyên nhân không phải styling —
`design/design-system.md` (hướng Airmail) đã implement xong và nhất quán. Nguyên nhân là
**data model chỉ có một hình dạng**: mọi hộp đều là `content_text` + ảnh tùy chọn + câu hỏi
Yes/No tùy chọn. Nên mười hộp cho ra mười thẻ giấy giống hệt nhau. Thêm texture, màu hay
animation nữa cũng không sửa được — thứ giống nhau là nội dung, không phải vỏ.

Vấn đề thứ hai: mở hộp là cao trào cảm xúc của một app hộp thời gian, nhưng hiện chỉ là một
lần điều hướng màn hình phẳng.

## 2. Phạm vi

Trong phạm vi:

- Thêm bốn loại hộp, mỗi loại có cấu trúc nội dung và hình dạng thẻ riêng.
- Thay việc mở hộp bằng một nghi thức tương tác do người dùng tự tay thực hiện.

Ngoài phạm vi: nêu rõ ở mục 11.

## 3. Nguyên tắc thống nhất

Bốn loại hộp là **bốn thứ văn phòng phẩm trong cùng một thế giới bưu chính**. Chúng dùng
chung bảng màu, font Lora, bóng cứng `shadowRadius: 0`, radius 2 và ngôn ngữ chuyển động
`Easing.steps()` đã chốt trong `design/design-system.md`. Thứ khác nhau giữa chúng là **hình
dạng và cấu trúc**, không phải màu sắc hay kiểu chữ.

Ràng buộc này là bắt buộc: nó giữ hệ thống thị giác không vỡ khi số loại tăng lên.

## 4. Bốn loại hộp

| Loại | Giá trị `kind` | Vật thể | Nội dung riêng |
|---|---|---|---|
| Thư | `letter` | Phong bì airmail | Chỉ `content_text` (mặc định, data cũ migrate về đây) |
| Mục tiêu | `goal` | Tờ biểu mẫu kẻ dòng | `checklist` 1–7 mục |
| Dự đoán | `prediction` | Điện tín niêm phong | Bắt buộc `follow_up_question` |
| Bưu thiếp | `postcard` | Bưu thiếp ảnh | Bắt buộc có 1 ảnh trong `box_attachments` |

### 4.1 Thẻ trong danh sách

| Loại | Còn khóa | Đã mở |
|---|---|---|
| Thư | Sọc chéo đỏ/xanh viền thẻ, nắp phong bì hình tam giác gập xuống, dấu mộc góc phải | Mép trên rách răng cưa (giữ nguyên `TornEdge` hiện có) |
| Mục tiêu | Kẻ dòng ngang mờ màu `ruleSoft`, kẹp giấy góc trái trên, nhãn mono `5 MỤC` | Kẻ dòng + dấu mộc đỏ ghi `3/5` |
| Dự đoán | Thẻ hẹp hơn thẻ thường, băng niêm đỏ chéo góc phải trên, toàn bộ chữ dùng font mono | Băng niêm bị bóc rách + nhãn `ĐÚNG` hoặc `SAI` |
| Bưu thiếp | Mặt sau bưu thiếp: đường kẻ dọc chia đôi, ô tem trống viền đứt. **Không hiện ảnh.** | Mặt trước: ảnh chiếm toàn bộ thẻ, chữ nhỏ nằm dưới |

Bưu thiếp còn khóa không hiện ảnh vì hai lý do cùng chiều: đúng tinh thần niêm phong, và
tránh phải tải N ảnh từ Supabase Storage khi cuộn danh sách.

Ba trạng thái (`locked` / `ready` / `opened`) vẫn phải phân biệt được bằng hình khi nhìn ảnh
chụp màn hình đen trắng — yêu cầu này kế thừa từ `design/design-system.md` mục 5 và áp dụng
cho cả bốn loại.

## 5. Schema

```sql
create type box_kind as enum ('letter', 'goal', 'prediction', 'postcard');

alter table boxes add column kind box_kind not null default 'letter';
alter table boxes add column checklist jsonb;
```

Hình dạng `checklist`:

```json
[{ "text": "Chạy 10km", "done": false }]
```

Trường `done` do người dùng đặt lúc mở hộp; lúc tạo hộp luôn là `false`.

### 5.1 Ràng buộc DB

Các ràng buộc dưới đây đặt ở DB chứ không chỉ ở app, vì chúng là ràng buộc toàn vẹn dữ liệu —
một hộp `goal` không có checklist là dữ liệu hỏng, không phải lỗi nhập liệu.

- `CHECK ((kind = 'goal') = (checklist IS NOT NULL))`
- `CHECK (kind <> 'goal' OR jsonb_array_length(checklist) BETWEEN 1 AND 7)`
- `CHECK (kind <> 'prediction' OR follow_up_question IS NOT NULL)`

Không thêm CHECK cấm các loại khác có `follow_up_question`: hộp cũ tạo trước thay đổi này có
thể đã có câu hỏi, thêm CHECK sẽ làm migration fail. Thay vào đó, form tạo hộp chỉ hiện ô nhập
câu hỏi cho `prediction`; hộp cũ có câu hỏi vẫn hiển thị và trả lời được như trước.

Ràng buộc "bưu thiếp phải có ảnh" **không** đặt ở DB: ảnh nằm bảng khác và được insert sau
hộp, nên CHECK cross-table sẽ cần trigger deferrable phức tạp không tương xứng. Enforce ở
tầng ứng dụng (nút Lưu bị vô hiệu khi chưa chọn ảnh) và ghi rõ giới hạn này.

### 5.2 Bất biến sau khi tạo

`kind` không sửa được sau khi tạo hộp. Bổ sung vào trigger `guard_box_edit` đang có — cùng
chỗ đã chặn sửa `content_text`, `open_at`, `follow_up_question`.

### 5.3 Migration dữ liệu cũ

`default 'letter'` xử lý toàn bộ hộp đang tồn tại. Không mất dữ liệu, không cần backfill thủ công.

### 5.4 View

`boxes_with_status` là `select b.*` nên tự động có `kind` và `checklist`. Vẫn phải chạy lại
`create or replace view ... with (security_invoker = true)` để view lấy cột mới.

## 6. Server vẫn là bên quyết định

Việc tick checklist phải đi qua RPC giống `follow_up_answer`, không cho client `UPDATE` thẳng —
nếu không, client tự sửa `done` bất cứ lúc nào, kể cả khi hộp còn khóa.

Mở rộng RPC hiện có:

```sql
open_box(p_box_id uuid, p_follow_up_answer boolean, p_checklist jsonb default null)
```

Server phải kiểm tra `p_checklist` có **cùng số phần tử và cùng đúng chuỗi `text` theo đúng thứ tự**
với bản đang lưu, và chỉ nhận cờ `done`. Không kiểm thì người dùng sửa lại mục tiêu ngay lúc mở
cho dễ đạt. Lệch thì RPC raise exception, không ghi gì.

Hàm giữ nguyên `SECURITY DEFINER`, `set search_path = public`, và vẫn `revoke ... from anon`
như bản hardening đã áp dụng.

## 7. Nghi thức mở hộp

Một khung chung, bốn lớp vỏ. Người dùng phải tự tay mở — đây là điểm khác biệt so với animation
tự chạy.

### 7.1 Khung

`src/components/paper/opening-ritual.tsx`

Ba nhịp: `sealed` → `opening` → `revealed`.

- Người dùng kéo ngang bằng `PanGestureHandler` (`react-native-gesture-handler`, đã có sẵn).
- Cử chỉ dẫn động một `SharedValue<number>` tên `progress`, giá trị 0 → 1.
- Vượt ngưỡng 0.6 thì tự chạy nốt tới 1 và gọi `onOpened`.
- Chưa tới ngưỡng khi thả tay thì bật ngược về 0.
- `onOpened` mới là lúc gọi RPC `open_box`. RPC lỗi thì quay về `sealed` và hiện lỗi.

Props: `kind`, `onOpened`, `children` (nội dung được hé lộ).

### 7.2 Bốn lớp vỏ

Đặt tại `src/components/paper/seals/`. Cùng interface `{ progress: SharedValue<number> }`.

| Loại | Lớp vỏ làm gì khi `progress` đi từ 0 tới 1 |
|---|---|
| `letter` | Đường xé răng cưa SVG chạy ngang mép trên; nắp phong bì bật lên bằng `rotateX`; xong thì tờ thư chạy `unfold` |
| `goal` | Kẹp giấy trượt ra khỏi mép; tờ biểu mẫu duỗi từ trạng thái gập đôi; từng dòng hiện lệch nhau 60ms |
| `prediction` | Băng niêm đỏ bóc chéo, hé dần chữ bên dưới |
| `postcard` | `rotateY` 0 → 180°; mặt sau mờ đi; ảnh hiện ra |

Mọi chuyển động dùng `Easing.steps()` — giật từng khung có chủ đích, không mượt. Kế thừa
`design/design-system.md` mục 3.

### 7.3 Giảm chuyển động

`useReducedMotion()` bật thì bỏ hoàn toàn cử chỉ, thay bằng một `StampButton` ghi `MỞ HỘP`,
bấm là nhảy thẳng sang `revealed`. Không có trạng thái trung gian.

### 7.4 Sau khi hé lộ

| Loại | Nội dung sau khi mở |
|---|---|
| `letter` | Chỉ đọc |
| `goal` | Checklist tick được; tick xong bấm xác nhận, gọi RPC, rồi đóng dấu `3/5` bằng `stampDown` |
| `prediction` | Hai `StampButton` `ĐÚNG` / `SAI`; chọn xong gọi RPC rồi đóng dấu |
| `postcard` | Ảnh + lời nhắn, chỉ đọc |

## 8. Tạo hộp

Thêm một bước chọn loại lên đầu `create-box.tsx`: bốn ô tem nhỏ, mỗi ô vẽ đúng hình dạng
vật thể của loại đó (phong bì, biểu mẫu, điện tín, bưu thiếp). Không dùng emoji làm icon.

Form bên dưới đổi theo loại đã chọn:

| Loại | Trường thêm / bắt buộc |
|---|---|
| `letter` | Không đổi |
| `goal` | Ô nhập checklist, thêm/xóa dòng, tối đa 7, không cho dòng rỗng |
| `prediction` | Câu dự đoán bắt buộc (ghi vào `follow_up_question`) |
| `postcard` | Bắt buộc chọn ảnh; nút Lưu vô hiệu tới khi upload xong |

Ô chạm tối thiểu 44×44, cách nhau ≥8px. Mọi thao tác chờ phải có phản hồi tải.

## 9. File

Tạo mới:

- `src/components/paper/opening-ritual.tsx`
- `src/components/paper/seals/letter.tsx`
- `src/components/paper/seals/goal.tsx`
- `src/components/paper/seals/prediction.tsx`
- `src/components/paper/seals/postcard.tsx`
- `src/components/paper/checklist-field.tsx`
- `src/components/paper/kind-picker.tsx`
- `supabase/migrations/0003_security_hardening.sql` — backfill, xem 9.1
- `supabase/migrations/0004_storage_bucket.sql` — backfill, xem 9.1
- `supabase/migrations/0005_box_kinds.sql`

Sửa:

- `src/components/paper/paper-card.tsx` — thêm prop `kind`, rẽ bốn nhánh render
- `src/app/(app)/create-box.tsx`
- `src/app/(app)/box/[id].tsx`
- `src/app/(app)/index.tsx`
- `src/services/boxes.ts`
- `src/types/database.ts`

Không thêm dependency nào: `react-native-gesture-handler`, `react-native-reanimated`,
`react-native-svg` đều đã có trong `package.json`.

### 9.1 Migration bị lệch — phải vá trước

Supabase remote đang có bốn migration futurebox: `futurebox_init`,
`futurebox_guard_box_delete`, `futurebox_security_hardening`, `futurebox_storage_bucket`.
Thư mục `supabase/migrations/` chỉ có hai file đầu. Hai migration cuối đã áp thẳng qua MCP
mà không ghi file, nên **repo hiện tại không dựng lại được database thật**.

Vá trước khi thêm migration mới, nếu không thứ tự đánh số sẽ tiếp tục sai:

1. Dump nội dung `futurebox_security_hardening` ra `0003_security_hardening.sql`.
2. Dump nội dung `futurebox_storage_bucket` ra `0004_storage_bucket.sql`.
3. Migration mới của việc này là `0005_box_kinds.sql`.

Đây là việc dọn nợ có thật và nằm đúng đường đi của thay đổi này, không phải refactor lan man.

## 10. Kiểm thử

| Đối tượng | Kiểm gì |
|---|---|
| `PaperCard` | Bốn loại × ba trạng thái; mỗi tổ hợp có marker thị giác phân biệt được |
| `OpeningRitual` | Vượt ngưỡng thì gọi `onOpened`; kéo thiếu rồi thả thì bật ngược, không gọi; nhánh reduced-motion bỏ cử chỉ và có nút |
| `checklist-field` | Chặn dòng rỗng; chặn quá 7 dòng; xóa dòng đúng chỉ số |
| `boxes.ts` | Gửi đúng `kind` và `checklist` lên RPC |
| SQL | Ba CHECK constraint từ chối dữ liệu sai; **RPC từ chối checklist bị sửa `text`** |

Test cũ phải xanh nguyên. `npx tsc --noEmit` sạch.

## 11. Cố ý bỏ qua

- **Thẻ còn khóa vẫn hiện dòng đầu của nội dung làm tiêu đề.** Rò rỉ nhẹ so với ý niệm niêm
  phong. Sửa đúng cần thêm cột `title` riêng và một ô nhập nữa — để lần sau.
- Nhiều ảnh mỗi hộp; bưu thiếp nhiều mặt.
- Sửa `kind` sau khi tạo.
- Tick checklist trong lúc hộp còn khóa — đã cân nhắc và loại: biến app thành todo list và
  làm mất bất ngờ lúc mở hộp.

## 12. Hoàn thành khi

- [ ] `npx tsc --noEmit` không lỗi
- [ ] `npm test` xanh, gồm cả test mới ở mục 10
- [ ] Bốn loại phân biệt được trong danh sách khi nhìn ảnh chụp màn hình đen trắng
- [ ] Kéo thiếu rồi thả thì hộp không mở
- [ ] Bật giảm chuyển động thì mở được bằng nút, không cần cử chỉ
- [ ] RPC từ chối checklist đã bị sửa nội dung
- [ ] Bưu thiếp còn khóa không phát request ảnh nào
- [ ] Chạy thật trên iPhone qua Expo
