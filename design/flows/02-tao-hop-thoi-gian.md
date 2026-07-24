# Activity Diagram - #2 Tạo hộp thời gian (kèm #5 Đính kèm ảnh)

```mermaid
flowchart TD
    Start([Tap Tạo hộp mới\ntừ Danh sách hộp]) --> Form[Màn tạo hộp]
    Form --> InputText[Nhập content_text]
    InputText --> PickDate[Chọn open_at]
    PickDate --> OptPhoto{Đính kèm ảnh?}
    OptPhoto -- Có --> PickImage[Chọn ảnh từ thư viện\nexpo-image-picker]
    PickImage --> OptFollow
    OptPhoto -- Không --> OptFollow{Thêm câu hỏi\nfollow-up?}
    OptFollow -- Có --> InputQuestion[Nhập follow_up_question]
    InputQuestion --> Submit[Tap Lưu]
    OptFollow -- Không --> Submit

    Submit --> Validate{Validate:\n- text 1-2000 ký tự\n- open_at là ngày tương lai\n- ảnh ≤5MB, JPEG/PNG (nếu có)\n- câu hỏi ≤200 ký tự (nếu có)}
    Validate -- Sai --> ShowErr[Hiện lỗi inline theo field,\nkhông submit]
    ShowErr --> Form

    Validate -- Đúng --> CheckNet{Có mạng?}
    CheckNet -- Không --> ErrOffline[Báo cần kết nối mạng để tạo hộp]
    ErrOffline --> Form

    CheckNet -- Có --> HasImage{Có ảnh?}
    HasImage -- Có --> UploadImg[Upload ảnh lên\nSupabase Storage bucket box-photos]
    UploadImg --> UploadResult{Upload thành công?}
    UploadResult -- Không --> ErrUpload[Báo lỗi upload ảnh,\ncho thử lại, chưa tạo hộp]
    ErrUpload --> Form
    UploadResult -- Có --> InsertBox[Insert row boxes\n+ insert row box_attachments]
    HasImage -- Không --> InsertBox2[Insert row boxes]

    InsertBox --> InsertResult{Insert thành công?}
    InsertBox2 --> InsertResult
    InsertResult -- Không --> ErrInsert[Báo lỗi lưu hộp, giữ nguyên form]
    ErrInsert --> Form
    InsertResult -- Có --> Success[Hộp ở trạng thái Đang khóa]
    Success --> BackToList[Quay về Danh sách hộp,\nhiển thị hộp mới]
    BackToList --> End([Kết thúc])
```

## Ghi chú
- Ảnh phải upload xong (có `storage_path`) trước khi insert `boxes`/`box_attachments` — đúng AC #5.
- Luồng tối đa 3 bước theo NFR Usability: (1) nhập nội dung + ngày, (2) tùy chọn ảnh/câu hỏi, (3) xác nhận lưu.
- Sau khi tạo, không có đường quay lại sửa `content_text`/`open_at`/`follow_up_question` trừ qua tính năng #7 (khi còn "Đang khóa").
