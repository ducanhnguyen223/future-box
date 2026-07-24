# PRD - FutureBoxes

## Executive Summary

**Tầm nhìn**: Ứng dụng mobile đa nền tảng cho phép người dùng gửi tin nhắn, kỷ niệm, mục tiêu cho chính mình trong tương lai, đóng gói trong "hộp thời gian" bị khóa đến đúng ngày đã chọn mới mở ra được.

**Mục tiêu**:
- Giúp người dùng ghi lại cảm xúc/suy nghĩ hiện tại và đối chiếu với tương lai (self-reflection).
- Tạo động lực theo dõi mục tiêu cá nhân (giảm cân, quyết định quan trọng...) qua cơ chế "đặt câu hỏi - chờ - trả lời".
- Tạo trải nghiệm bất ngờ, cảm xúc khi mở lại hộp đã khóa.

**Success metrics**:
- % hộp được tạo có tỷ lệ mở đúng hạn (không bỏ quên).
- Số hộp trung bình/user/tháng.
- Retention 30 ngày (user quay lại mở hộp).

**Công nghệ đề xuất** (đã tra cứu version mới nhất qua context7 ngày 2026-07-24):

| Thành phần | Lựa chọn | Version tra được | Ghi chú |
|---|---|---|---|
| Client framework | **Expo** (managed workflow, trên nền React Native) | Expo SDK 57.0.0 → React Native 0.86 | Chọn Expo thay vì React Native CLI thuần vì: (1) build đa nền tảng iOS/Android từ 1 codebase qua EAS Build, không cần cấu hình native project thủ công; (2) push notification có sẵn qua `expo-notifications` + Expo Push Service, không cần tự dựng APNs/FCM server riêng; (3) `expo-secure-store`, `expo-image-picker` dùng ngay cho lưu session và chọn ảnh; (4) không cần chuyên sâu native iOS/Android để bắt đầu. Đánh đổi: native module rất đặc thù có thể cần "prebuild", nhưng không phát sinh trong scope MVP này. |
| Backend client SDK | `@supabase/supabase-js` | 2.108.2 | Dùng chung cho Auth, Database (Postgres qua REST/RPC), Storage |
| Session storage (mobile) | `@react-native-async-storage/async-storage` + `expo-secure-store` | theo Expo SDK 57 | AsyncStorage cache session, SecureStore lưu token nhạy cảm — đúng pattern chính thức Supabase khuyến nghị cho React Native/Expo |
| Push notification | `expo-notifications` | theo Expo SDK 57 | Lấy Expo push token (`getExpoPushTokenAsync`), gửi nhắc qua Expo Push API khi hộp đến ngày mở |
| Backend | Supabase (Auth + Postgres Database + Storage) | — | Người dùng đã có sẵn project Supabase |

---

## Feature Table

| # | Tính năng | Mô tả ngắn | Độ ưu tiên (MoSCoW) | Phụ thuộc |
|---|-----------|-----------|----------------------|-----------|
| 1 | Đăng ký / Đăng nhập | Tài khoản qua Supabase Auth (email hoặc social login) | Must | - |
| 2 | Tạo hộp thời gian | Nhập nội dung (text bắt buộc, ảnh tùy chọn), chọn ngày mở, thêm câu hỏi follow-up tùy chọn (vd "Kết quả tốt chứ?", "Đã giảm cân chưa?", "Quyết định đúng hay sai?") | Must | 1 |
| 3 | Danh sách hộp | Hiển thị hộp theo trạng thái: Đang khóa / Sẵn sàng mở / Đã mở | Must | 2 |
| 4 | Mở hộp thời gian | Chỉ mở được khi đến/qua ngày đã chọn (kiểm tra theo server time); hiển thị nội dung gốc; nếu có câu hỏi follow-up, cho trả lời Yes/No; hiệu ứng chúc mừng khi chọn Yes | Must | 2, 3 |
| 5 | Đính kèm ảnh trong hộp | Upload tối đa 1 ảnh lên Supabase Storage, hiển thị lại khi mở hộp | Should | 2 |
| 6 | Push notification | Nhắc người dùng khi hộp đến ngày mở, qua Expo Push Service | Should | 4 |
| 7 | Chỉnh sửa / Xóa hộp | Chỉ áp dụng khi hộp còn đang khóa và chưa đến ngày mở | Could | 2 |
| 8 | Đồng bộ đa thiết bị | Dữ liệu hộp lưu trên Supabase, truy cập được từ nhiều thiết bị cùng tài khoản | Must | 1 |

---

## Acceptance Criteria

**1. Đăng ký / Đăng nhập**
- Tạo tài khoản mới bằng email + mật khẩu qua Supabase Auth.
- Đăng nhập lại được trên thiết bị khác với cùng tài khoản, thấy đúng dữ liệu hộp của mình.
- Sai email/mật khẩu → báo lỗi rõ ràng, không crash.

**2. Tạo hộp thời gian**
- Bắt buộc: nội dung text (giới hạn 2000 ký tự), ngày mở (phải là ngày trong tương lai, không cho chọn hôm nay hoặc quá khứ).
- Tùy chọn: 1 ảnh đính kèm (giới hạn 5MB, định dạng JPEG/PNG), 1 câu hỏi follow-up dạng Yes/No do người dùng tự nhập (giới hạn 200 ký tự).
- Sau khi tạo, hộp ở trạng thái "Đang khóa", không sửa được nội dung/ngày mở (trừ tính năng #7).

**3. Danh sách hộp**
- Hộp được nhóm/lọc theo trạng thái: Đang khóa (còn hạn), Sẵn sàng mở (đã tới ngày, chưa mở), Đã mở.
- Hộp "Đang khóa" không cho tap vào xem nội dung.

**4. Mở hộp thời gian**
- Ngày/giờ mở được xác định bằng **server time của Supabase** (`now()` phía Postgres hoặc Edge Function), không dùng đồng hồ thiết bị client để quyết định điều kiện mở — chống gian lận đổi giờ máy.
- Nếu server time < ngày mở → chặn mở, báo còn bao lâu.
- Nếu đủ điều kiện → hiển thị đầy đủ nội dung gốc đã khóa.
- Nếu hộp có câu hỏi follow-up: bắt buộc chọn Yes/No trước khi đánh dấu hộp "Đã mở".
- Chọn Yes → hiệu ứng chúc mừng (animation/confetti). Chọn No → không có hiệu ứng chúc mừng.
- Mỗi hộp chỉ ghi nhận câu trả lời follow-up 1 lần, không sửa lại được sau đó.

**5. Đính kèm ảnh**
- Ảnh upload thành công lên Supabase Storage trước khi hộp được tạo xong.
- Khi mở hộp, ảnh hiển thị đúng ảnh đã đính kèm lúc tạo.

**6. Push notification**
- Đúng ngày mở, người dùng nhận notification kể cả khi không mở app.
- Không có notification nếu người dùng đã tắt quyền thông báo (không crash, không lỗi).

**7. Chỉnh sửa / Xóa hộp**
- Chỉ hiển thị action Sửa/Xóa khi hộp còn "Đang khóa".
- Xóa hộp yêu cầu xác nhận (dialog), không xóa nhầm.

**8. Đồng bộ đa thiết bị**
- Tạo hộp trên thiết bị A, đăng nhập cùng tài khoản trên thiết bị B → thấy hộp đó.

---

## Non-functional Requirements

- **Performance**: Danh sách hộp load < 2s với tối đa vài trăm hộp/user.
- **Security**: Row Level Security (RLS) trên Supabase — user chỉ đọc/ghi được hộp của chính mình. Ngày mở hộp phải được kiểm tra dựa trên server time (Postgres `now()` / Edge Function), không tin client time.
- **Scalability**: Schema hỗ trợ thêm loại nội dung mới (vd audio, video) sau này mà không cần đổi cấu trúc bảng chính.
- **Usability**: Luồng tạo hộp tối đa 3 bước; hiệu ứng khóa/mở hộp phải tạo cảm giác "chờ đợi - bất ngờ" rõ ràng qua UI.
- **Offline**: App cho xem danh sách hộp đã cache khi mất mạng; tạo hộp mới yêu cầu có mạng (do cần ghi server time + upload Supabase).

---

## Assumptions & Constraints

- Nền tảng client: **Expo** (managed workflow, React Native 0.86 qua Expo SDK 57), build cho iOS + Android qua EAS Build.
- Backend: Supabase (Auth, Postgres Database, Storage) do người dùng đã có sẵn; dùng `@supabase/supabase-js` 2.108.2.
- Ngôn ngữ hiển thị: Tiếng Việt (mặc định), chưa yêu cầu đa ngôn ngữ.
- Không có yêu cầu thanh toán/subscription ở giai đoạn này.
- Giới hạn ảnh: giả định **1 ảnh/hộp, tối đa 5MB, định dạng JPEG/PNG** cho MVP, mở rộng sau nếu cần (nhiều ảnh, video...).
- Chống gian lận đổi giờ máy: mọi kiểm tra điều kiện mở hộp (ngày hiện tại so với ngày mở) thực hiện ở phía Supabase (server time), client không tự quyết định được là hộp đã đủ điều kiện mở hay chưa — client chỉ hiển thị theo kết quả server trả về.
- Câu hỏi follow-up: giả định luôn dạng Yes/No, tối đa 1 câu hỏi/hộp, do chính người dùng tự nhập nội dung câu hỏi lúc tạo hộp (đúng theo ví dụ ideas.txt), chưa hỗ trợ dạng câu hỏi mở/trắc nghiệm nhiều lựa chọn.
- Push notification: dùng Expo Push Service (`expo-notifications`), yêu cầu người dùng cấp quyền thông báo; việc gửi đúng giờ tại thời điểm hộp mở cần một cơ chế lập lịch phía server (vd Supabase cron/Edge Function) quét các hộp đến hạn và gọi Expo Push API — không dựa vào việc app đang mở.
- Chưa có yêu cầu chia sẻ hộp cho người khác (share) — tính năng chỉ dành cho chính chủ tài khoản.
