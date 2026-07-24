# Screen Descriptions

## Đăng ký

### Mục đích
Cho người dùng mới tạo tài khoản bằng email + mật khẩu qua Supabase Auth để bắt đầu dùng app.

### Các thành phần chính
1. **Header**
   - Mô tả: Logo/tên app "FutureBoxes" + tagline ngắn, không có nút back (đây là entry screen).
   - Tương tác: Không tương tác.
   - Hiệu ứng: Fade in khi screen xuất hiện.

2. **Form Input (Email, Mật khẩu, Xác nhận mật khẩu)**
   - Mô tả: 3 ô input dạng outline, input mật khẩu có icon show/hide.
   - Tương tác: Gõ text; tap icon để hiện/ẩn mật khẩu; validate inline khi rời khỏi field (blur).
   - Hiệu ứng: Border đổi màu đỏ + text lỗi nhỏ dưới field khi validate sai (email không hợp lệ, mật khẩu yếu, xác nhận không khớp).

3. **Nút "Đăng ký"**
   - Mô tả: Button primary, full-width, đáy form.
   - Tương tác: Tap để submit (gọi Supabase Auth signUp); disabled khi form chưa hợp lệ hoặc đang submit.
   - Hiệu ứng: Loading spinner thay label khi đang gọi API; nếu lỗi (email đã tồn tại, mất mạng) hiện banner/toast lỗi phía trên form, button trở lại trạng thái thường.

4. **Link "Đã có tài khoản? Đăng nhập"**
   - Mô tả: Text link dưới cùng.
   - Tương tác: Tap để chuyển sang screen Đăng nhập.
   - Hiệu ứng: Không có, chuyển screen bằng slide/fade transition chuẩn của navigator.

### Navigation
- Đến screen này từ: Mở app lần đầu (chưa có session) → chọn tab/mode "Đăng ký" trên Auth screen; hoặc từ screen Đăng nhập qua link "Chưa có tài khoản? Đăng ký".
- Từ screen này đến: Danh sách hộp (khi đăng ký thành công); Đăng nhập (qua link).

### Ghi chú
- Không có luồng social login trong MVP.
- Lỗi "email đã tồn tại", lỗi mất mạng hiển thị dạng banner đỏ phía trên form, không crash, giữ nguyên dữ liệu đã nhập.

---

## Đăng nhập

### Mục đích
Cho người dùng đã có tài khoản đăng nhập lại để truy cập dữ liệu hộp của mình (đồng bộ đa thiết bị).

### Các thành phần chính
1. **Header**
   - Mô tả: Logo/tên app, giống screen Đăng ký.
   - Tương tác: Không tương tác.
   - Hiệu ứng: Fade in.

2. **Form Input (Email, Mật khẩu)**
   - Mô tả: 2 ô input outline.
   - Tương tác: Gõ text; icon show/hide mật khẩu.
   - Hiệu ứng: Border đỏ + text lỗi khi thiếu thông tin.

3. **Nút "Đăng nhập"**
   - Mô tả: Button primary, full-width.
   - Tương tác: Tap để gọi Supabase Auth signInWithPassword; disabled khi thiếu email/mật khẩu hoặc đang submit.
   - Hiệu ứng: Loading spinner khi đang gọi API; banner lỗi đỏ khi "Email hoặc mật khẩu không đúng" hoặc mất mạng.

4. **Link "Chưa có tài khoản? Đăng ký"**
   - Mô tả: Text link dưới form.
   - Tương tác: Tap chuyển sang Đăng ký.
   - Hiệu ứng: Transition chuẩn.

### Navigation
- Đến screen này từ: Mở app (chưa có session đã lưu); từ Đăng ký qua link; sau khi Đăng xuất từ Cài đặt/Profile.
- Từ screen này đến: Danh sách hộp (đăng nhập thành công, lưu session vào AsyncStorage + SecureStore); Đăng ký (qua link).

### Ghi chú
- Sai email/mật khẩu → thông báo rõ ràng "Email hoặc mật khẩu không đúng", không crash.
- Nếu app đã có session cached hợp lệ, app bỏ qua screen này và vào thẳng Danh sách hộp.

---

## Danh sách hộp

### Mục đích
Màn hình chính (home) sau khi đăng nhập — hiển thị toàn bộ hộp của user, nhóm theo 3 trạng thái: Đang khóa, Sẵn sàng mở, Đã mở.

### Các thành phần chính
1. **Header**
   - Mô tả: Tiêu đề "Hộp của tôi" + icon Cài đặt/Profile ở góc phải.
   - Tương tác: Tap icon Cài đặt → sang screen Cài đặt/Profile.
   - Hiệu ứng: Không animation đặc biệt.

2. **Banner offline**
   - Mô tả: Banner nhỏ màu vàng/xám phía dưới header, chỉ hiện khi mất mạng, nội dung "Đang offline - dữ liệu có thể chưa mới nhất".
   - Tương tác: Không tương tác (chỉ đọc).
   - Hiệu ứng: Slide-down khi xuất hiện, slide-up khi có mạng lại.

3. **Section theo trạng thái (Đang khóa / Sẵn sàng mở / Đã mở)**
   - Mô tả: Danh sách chia section (SectionList) hoặc 3 nhóm card, mỗi section có label trạng thái + số lượng.
   - Tương tác: Scroll dọc để xem hết.
   - Hiệu ứng: Không.

4. **Box Card**
   - Mô tả: Card hiển thị preview ngắn (ngày mở, icon trạng thái — ổ khóa/chuông/hộp mở, thumbnail ảnh nếu có). Card "Đang khóa" hiển thị mờ hơn/màu trung tính; "Sẵn sàng mở" có badge nổi bật (màu nhấn) + có thể có icon rung nhẹ; "Đã mở" hiển thị dạng nhạt, đã xem.
   - Tương tác: Tap vào card → điều hướng theo trạng thái (Đang khóa → Chi tiết hộp đang khóa; Sẵn sàng mở → Mở hộp thời gian; Đã mở → Chi tiết hộp đã mở).
   - Hiệu ứng: Ripple/scale-down nhẹ khi nhấn (pressed state); card "Sẵn sàng mở" có thể có hiệu ứng nhấp nháy/pulse nhẹ ở badge để thu hút chú ý.

5. **Empty state**
   - Mô tả: Khi chưa có hộp nào — hình minh họa + text hướng dẫn + CTA "Tạo hộp mới".
   - Tương tác: Tap CTA → sang Tạo hộp thời gian.
   - Hiệu ứng: Fade in.

6. **Floating Action Button "Tạo hộp mới"**
   - Mô tả: FAB tròn góc dưới phải, icon "+".
   - Tương tác: Tap → sang Tạo hộp thời gian.
   - Hiệu ứng: Scale-press khi tap.

7. **Pull-to-refresh**
   - Mô tả: Kéo danh sách xuống để refetch.
   - Tương tác: Kéo (swipe down) từ đầu danh sách.
   - Hiệu ứng: Spinner chuẩn pull-to-refresh của platform.

### Navigation
- Đến screen này từ: Đăng ký/Đăng nhập thành công; quay lại từ Tạo hộp thời gian sau khi lưu; quay lại từ Chi tiết hộp đang khóa sau khi sửa/xóa; quay lại từ Mở hộp thời gian sau khi mở xong; tap push notification.
- Từ screen này đến: Tạo hộp thời gian (FAB/CTA); Chi tiết hộp đang khóa (tap card Đang khóa); Mở hộp thời gian (tap card Sẵn sàng mở); Chi tiết hộp đã mở (tap card Đã mở); Cài đặt/Profile (icon header).

### Ghi chú
- Trạng thái lấy từ view `boxes_with_status` (derive, không lưu cột status riêng).
- Offline: chỉ xem cache, không cho tạo/sửa/mở hộp — mọi action tạo/sửa/mở đều cần kiểm tra mạng trước khi điều hướng hoặc phải disable khi offline.
- Card "Đang khóa" tap vào không cho xem nội dung, chỉ chuyển sang screen hiển thị thời gian còn lại.

---

## Tạo hộp thời gian

### Mục đích
Cho user soạn nội dung gửi cho tương lai: text bắt buộc, ảnh tùy chọn, ngày mở bắt buộc, câu hỏi follow-up tùy chọn. Tối đa 3 bước theo NFR Usability.

### Các thành phần chính
1. **Header**
   - Mô tả: Tiêu đề "Tạo hộp mới" (hoặc "Sửa hộp" khi ở edit mode) + nút back/close bên trái.
   - Tương tác: Tap back → xác nhận thoát nếu đã nhập dữ liệu (tránh mất nội dung), hoặc thoát thẳng nếu form trống.
   - Hiệu ứng: Không.

2. **Input nội dung (content_text)**
   - Mô tả: TextArea nhiều dòng, giới hạn 2000 ký tự, counter ký tự hiển thị góc dưới.
   - Tương tác: Gõ text; counter đổi màu đỏ khi gần/vượt giới hạn.
   - Hiệu ứng: TextArea tự giãn chiều cao theo nội dung (auto-grow).

3. **Date Picker "Ngày mở"**
   - Mô tả: Field hiển thị ngày đã chọn, tap mở native date picker (calendar).
   - Tương tác: Tap để mở picker; chỉ cho chọn ngày trong tương lai (hôm nay/quá khứ bị disable trên picker).
   - Hiệu ứng: Modal/sheet date picker trượt lên từ dưới (native platform behavior).

4. **Photo Picker (tùy chọn)**
   - Mô tả: Ô vuông placeholder "+ Thêm ảnh" hoặc preview ảnh đã chọn kèm nút xóa (X) góc ảnh.
   - Tương tác: Tap để mở thư viện ảnh (expo-image-picker); tap X để bỏ ảnh đã chọn.
   - Hiệu ứng: Thumbnail fade-in khi chọn xong; progress bar/spinner overlay lên ảnh trong lúc upload lên Supabase Storage.

5. **Input câu hỏi follow-up (tùy chọn)**
   - Mô tả: Text input 1 dòng, giới hạn 200 ký tự, có toggle/switch "Thêm câu hỏi follow-up" để ẩn/hiện field này.
   - Tương tác: Bật switch để hiện input, gõ câu hỏi (vd "Đã giảm cân chưa?").
   - Hiệu ứng: Field slide-down/expand khi bật switch, collapse khi tắt.

6. **Nút "Lưu"**
   - Mô tả: Button primary cuối form (hoặc sticky ở đáy màn hình).
   - Tương tác: Tap để validate rồi submit (upload ảnh trước nếu có, sau đó insert/update box); disabled khi thiếu content_text hoặc open_at hợp lệ, hoặc đang submit.
   - Hiệu ứng: Loading spinner trong lúc upload ảnh + insert; nếu lỗi hiện toast/banner lỗi theo từng bước (lỗi upload ảnh, lỗi mất mạng, lỗi lưu) và giữ nguyên form để user thử lại.

### Navigation
- Đến screen này từ: Danh sách hộp (FAB/CTA "Tạo hộp mới"); Chi tiết hộp đang khóa (nút "Sửa", prefill dữ liệu hộp hiện tại).
- Từ screen này đến: Danh sách hộp (sau khi lưu/tạo thành công, hoặc sau khi sửa xong); Chi tiết hộp đang khóa (nếu sửa xong quay lại xem chi tiết, tùy điều hướng).

### Ghi chú
- Ở edit mode: field bị prefill từ `content_text`/`open_at`/`follow_up_question` hiện tại; nếu server báo hộp đã hết hạn sửa (đã qua open_at giữa lúc user đang gõ) → hiện lỗi "Hộp đã đến hạn mở, không thể sửa nữa" và điều hướng về Danh sách hộp.
- Validate client-side (độ dài, định dạng ảnh, kích thước ≤5MB) trước khi gọi API, nhưng điều kiện "còn đang khóa" luôn được server xác nhận lại.
- Không tạo hộp được khi offline — hiện thông báo "Cần kết nối mạng để tạo hộp" và chặn nút Lưu.

---

## Chi tiết hộp đang khóa

### Mục đích
Hiển thị thông tin tổng quan của 1 hộp còn "Đang khóa": không cho xem nội dung, chỉ hiện thời gian còn lại và cho phép Sửa/Xóa.

### Các thành phần chính
1. **Header**
   - Mô tả: Nút back bên trái, không có tiêu đề nội dung (giữ bí mật).
   - Tương tác: Tap back → về Danh sách hộp.
   - Hiệu ứng: Không.

2. **Icon ổ khóa lớn + Countdown**
   - Mô tả: Icon khóa ở giữa màn hình, dưới là text đếm ngược "Còn X ngày/giờ nữa" tính đến `open_at`.
   - Tương tác: Không tương tác (chỉ đọc).
   - Hiệu ứng: Icon có thể có animation lắc nhẹ/pulse tĩnh để nhấn mạnh trạng thái "đang khóa".

3. **Thông tin phụ (ngày mở, có ảnh/có câu hỏi hay không)**
   - Mô tả: Text nhỏ hiển thị ngày giờ mở cụ thể; icon nhỏ báo có ảnh đính kèm / có câu hỏi follow-up (không lộ nội dung).
   - Tương tác: Không tương tác.
   - Hiệu ứng: Không.

4. **Nút "Sửa"**
   - Mô tả: Button secondary.
   - Tương tác: Tap → sang Tạo hộp thời gian (edit mode, prefill dữ liệu).
   - Hiệu ứng: Không.

5. **Nút "Xóa"**
   - Mô tả: Button màu cảnh báo (đỏ/outline đỏ).
   - Tương tác: Tap → mở Modal xác nhận xóa.
   - Hiệu ứng: Không.

6. **Modal xác nhận xóa**
   - Mô tả: Dialog "Bạn chắc chắn muốn xóa hộp này?" với 2 nút "Hủy" / "Xóa".
   - Tương tác: Tap "Hủy" đóng modal, không làm gì; tap "Xóa" gọi API xóa (kèm cascade box_attachments).
   - Hiệu ứng: Modal fade + scale-in khi mở; loading spinner trên nút "Xóa" trong lúc gọi API; toast lỗi nếu server báo hộp đã hết hạn xóa giữa lúc confirm.

### Navigation
- Đến screen này từ: Danh sách hộp (tap card "Đang khóa").
- Từ screen này đến: Danh sách hộp (back, hoặc sau khi xóa thành công/thất bại); Tạo hộp thời gian (nút Sửa, edit mode).

### Ghi chú
- Action Sửa/Xóa chỉ hiện khi hộp còn "Đang khóa"; server luôn kiểm tra lại `now() < open_at` tại thời điểm submit để tránh race condition (hộp vừa hết hạn khóa đúng lúc user thao tác).
- Không hiển thị `content_text` hay ảnh ở màn này dưới bất kỳ hình thức nào — đảm bảo tính "bí mật cho đến ngày mở".

---

## Mở hộp thời gian

### Mục đích
Trải nghiệm mở hộp khi đã đến/qua ngày mở: xác thực qua server time, hiển thị nội dung gốc, bắt buộc trả lời follow-up (nếu có), hiệu ứng chúc mừng khi chọn Yes.

### Các thành phần chính
1. **Loading/Check state**
   - Mô tả: Full-screen loading khi đang gọi RPC `open_box` để server kiểm tra `now() >= open_at`.
   - Tương tác: Không tương tác.
   - Hiệu ứng: Spinner hoặc skeleton "Đang kiểm tra..." khi vừa vào screen.

2. **Countdown blocked state**
   - Mô tả: Nếu server trả về chưa đến hạn — hiển thị icon khóa + text "Còn X giờ/ngày nữa mới mở được" (trường hợp hiếm, do lệch giờ hoặc cache cũ).
   - Tương tác: Nút "Quay lại" → về Danh sách hộp.
   - Hiệu ứng: Fade in.

3. **Hiệu ứng mở khóa (unlock animation)**
   - Mô tả: Animation ổ khóa mở ra / nắp hộp bật lên trước khi hiện nội dung.
   - Tương tác: Không tương tác, chạy tự động.
   - Hiệu ứng: Animation ngắn (~1-1.5s) dạng scale + rotate icon khóa, sau đó transition sang nội dung.

4. **Nội dung hộp (content_text + ảnh)**
   - Mô tả: Text nội dung gốc hiển thị dạng card lớn, ảnh đính kèm (nếu có) hiển thị full-width phía trên/dưới text.
   - Tương tác: Tap vào ảnh để zoom full-screen (nếu cần).
   - Hiệu ứng: Nội dung fade-in/slide-up sau animation mở khóa.

5. **Follow-up question + nút Yes/No**
   - Mô tả: Nếu hộp có `follow_up_question` — hiển thị câu hỏi + 2 button lớn "Yes" / "No" ngang hàng.
   - Tương tác: Bắt buộc tap 1 trong 2 nút để tiếp tục (không có cách nào bỏ qua); sau khi chọn, gọi RPC lưu câu trả lời + set `opened_at`.
   - Hiệu ứng: Loading spinner trên nút vừa chọn trong lúc gọi RPC; disable cả 2 nút trong lúc chờ kết quả; nếu lỗi cho phép thử lại.

6. **Hiệu ứng chúc mừng (confetti)**
   - Mô tả: Full-screen confetti/celebration animation (Lottie hoặc particle) kèm text chúc mừng ngắn.
   - Tương tác: Tap bất kỳ đâu hoặc nút "Xong" để đóng và về Danh sách hộp.
   - Hiệu ứng: Confetti rơi/nổ trong vài giây, có thể kèm rung nhẹ (haptics).

7. **Nút "Xong" (trường hợp không có follow-up hoặc chọn No)**
   - Mô tả: Button đơn giản để xác nhận đã xem xong, không có hiệu ứng chúc mừng.
   - Tương tác: Tap → về Danh sách hộp.
   - Hiệu ứng: Không animation đặc biệt.

### Navigation
- Đến screen này từ: Danh sách hộp (tap card "Sẵn sàng mở"); tap push notification khi hộp đến hạn.
- Từ screen này đến: Danh sách hộp (sau khi xem xong/trả lời xong, hoặc bấm "Quay lại" ở trạng thái blocked).

### Ghi chú
- Điều kiện mở hoàn toàn dựa vào kết quả RPC server (`now() >= open_at`), client không tự tính toán để quyết định hiển thị nội dung — chống gian lận đổi giờ máy.
- Nếu hộp đã có `opened_at` từ trước (user quay lại mở lần 2 do chưa kịp thoát) → hiển thị lại nội dung + câu trả lời cũ dạng read-only, không cho trả lời lại, không có hiệu ứng mở khóa/confetti lặp lại.
- Mất mạng giữa lúc gọi RPC → báo lỗi, không set được `opened_at`, cho thử lại; giữ nguyên trạng thái hộp.
- Mỗi hộp chỉ ghi nhận câu trả lời follow-up 1 lần duy nhất.

---

## Chi tiết hộp đã mở

### Mục đích
Cho user xem lại nội dung và câu trả lời follow-up của một hộp đã mở trước đó, ở chế độ chỉ đọc.

### Các thành phần chính
1. **Header**
   - Mô tả: Nút back bên trái, tiêu đề ngày đã mở.
   - Tương tác: Tap back → về Danh sách hộp.
   - Hiệu ứng: Không.

2. **Nội dung hộp (content_text + ảnh)**
   - Mô tả: Hiển thị lại text gốc + ảnh đính kèm (nếu có), giống layout lúc mở hộp nhưng không có animation mở khóa.
   - Tương tác: Tap ảnh để zoom full-screen.
   - Hiệu ứng: Không animation đặc biệt (chỉ fade in khi load screen).

3. **Câu hỏi & câu trả lời follow-up (read-only)**
   - Mô tả: Nếu hộp có `follow_up_question` — hiển thị câu hỏi kèm badge kết quả đã chọn (Yes/No), không cho sửa.
   - Tương tác: Không tương tác (chỉ đọc).
   - Hiệu ứng: Không.

4. **Thông tin ngày tạo/ngày mở**
   - Mô tả: Text nhỏ hiển thị `created_at` và `opened_at`.
   - Tương tác: Không tương tác.
   - Hiệu ứng: Không.

### Navigation
- Đến screen này từ: Danh sách hộp (tap card "Đã mở").
- Từ screen này đến: Danh sách hộp (back).

### Ghi chú
- Không có action Sửa/Xóa ở screen này (chỉ áp dụng cho hộp "Đang khóa").
- Không có hiệu ứng confetti lặp lại khi xem lại.

---

## Cài đặt / Profile

### Mục đích
Cho user xem thông tin tài khoản cơ bản, bật/tắt push notification, và đăng xuất.

### Các thành phần chính
1. **Header**
   - Mô tả: Tiêu đề "Cài đặt" + nút back.
   - Tương tác: Tap back → về Danh sách hộp.
   - Hiệu ứng: Không.

2. **Thông tin tài khoản**
   - Mô tả: Hiển thị email của user đang đăng nhập (read-only).
   - Tương tác: Không tương tác.
   - Hiệu ứng: Không.

3. **Switch "Thông báo đẩy" (Push notification)**
   - Mô tả: Row với label + Switch toggle bật/tắt.
   - Tương tác: Tap switch để bật → yêu cầu quyền notification (nếu chưa cấp) qua `expo-notifications`, lấy Expo push token và lưu vào `push_tokens`; tắt → không xóa token khỏi hệ thống ở mức UI nhưng ngừng coi user "đã bật" (theo hành vi permission của hệ điều hành, có thể chỉ điều hướng user ra Settings hệ thống nếu đã từ chối quyền trước đó).
   - Hiệu ứng: Loading nhỏ trên switch trong lúc xin quyền/lưu token; nếu user từ chối quyền → switch tự trở về off, không báo lỗi/crash.

4. **Nút "Đăng xuất"**
   - Mô tả: Button hàng cuối, có thể tô màu cảnh báo nhẹ.
   - Tương tác: Tap → xóa SecureStore token + AsyncStorage cache, điều hướng về Đăng nhập.
   - Hiệu ứng: Có thể kèm modal xác nhận nhỏ trước khi đăng xuất (tùy chọn UX, không bắt buộc theo PRD).

### Navigation
- Đến screen này từ: Danh sách hộp (icon Cài đặt ở header).
- Từ screen này đến: Danh sách hộp (back); Đăng nhập (sau khi đăng xuất).

### Ghi chú
- Đây là màn tối giản theo scope MVP: chỉ gồm thông tin tài khoản, toggle notification, và đăng xuất — không có các mục cài đặt khác (đổi mật khẩu, ngôn ngữ...) vì ngoài phạm vi PRD.
- Việc gửi push thực tế phụ thuộc cron job phía server (Supabase Edge Function) quét `boxes` đến hạn, độc lập với việc app có đang mở hay không.
