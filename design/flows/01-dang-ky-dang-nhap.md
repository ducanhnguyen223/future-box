# Activity Diagram - #1 Đăng ký / Đăng nhập

```mermaid
flowchart TD
    Start([Mở app]) --> CheckSession{Có session\nđã lưu?}
    CheckSession -- Có --> Home[Vào màn Danh sách hộp]
    CheckSession -- Không --> AuthScreen[Màn Đăng nhập / Đăng ký]

    AuthScreen --> ChooseMode{Chọn hành động}
    ChooseMode -- Đăng ký --> RegForm[Nhập email + mật khẩu]
    ChooseMode -- Đăng nhập --> LoginForm[Nhập email + mật khẩu]

    RegForm --> ValidateReg{Email hợp lệ &\nmật khẩu đạt yêu cầu?}
    ValidateReg -- Không --> ErrReg[Hiện lỗi validation\ninline, không submit]
    ErrReg --> RegForm
    ValidateReg -- Có --> SubmitReg[Gọi Supabase Auth signUp]
    SubmitReg --> RegResult{Kết quả}
    RegResult -- Email đã tồn tại --> ErrExist[Báo lỗi: email đã dùng]
    ErrExist --> RegForm
    RegResult -- Mất mạng/lỗi server --> ErrNet1[Báo lỗi kết nối, không crash]
    ErrNet1 --> RegForm
    RegResult -- Thành công --> Home

    LoginForm --> ValidateLogin{Đủ email + mật khẩu?}
    ValidateLogin -- Không --> ErrLogin1[Báo thiếu thông tin]
    ErrLogin1 --> LoginForm
    ValidateLogin -- Có --> SubmitLogin[Gọi Supabase Auth signInWithPassword]
    SubmitLogin --> LoginResult{Kết quả}
    LoginResult -- Sai email/mật khẩu --> ErrWrong[Báo lỗi rõ ràng:\n"Email hoặc mật khẩu không đúng"]
    ErrWrong --> LoginForm
    LoginResult -- Mất mạng --> ErrNet2[Báo lỗi kết nối, không crash]
    ErrNet2 --> LoginForm
    LoginResult -- Thành công --> SaveSession[Lưu session:\nAsyncStorage cache + SecureStore token]
    SaveSession --> Home

    Home --> End([Kết thúc])
```

## Ghi chú
- Session được cache để lần mở app sau không cần đăng nhập lại (đúng AC #8 - đồng bộ đa thiết bị: mỗi thiết bị tự lưu session riêng, cùng tài khoản Supabase → cùng dữ liệu).
- Đăng xuất (logout) xóa SecureStore token + AsyncStorage cache, quay về `AuthScreen`.
- Không có luồng social login trong MVP (PRD chỉ chốt email + mật khẩu).
