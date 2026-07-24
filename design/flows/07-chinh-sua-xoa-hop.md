# Activity Diagram - #7 Chỉnh sửa / Xóa hộp

```mermaid
flowchart TD
    Start([User mở chi tiết\n1 hộp từ Danh sách]) --> CheckStatus{Trạng thái hộp?}
    CheckStatus -- Sẵn sàng mở / Đã mở --> NoAction[Không hiện action\nSửa/Xóa]
    NoAction --> End1([Kết thúc])

    CheckStatus -- Đang khóa --> ShowActions[Hiện action Sửa và Xóa]
    ShowActions --> Choose{User chọn}

    Choose -- Sửa --> EditForm[Mở form sửa,\nprefill content_text/open_at/\nfollow_up_question hiện tại]
    EditForm --> EditFields[User chỉnh nội dung]
    EditFields --> SubmitEdit[Tap "Lưu thay đổi"]
    SubmitEdit --> ValidateEdit{Validate lại\nnhư lúc tạo hộp}
    ValidateEdit -- Sai --> ErrEdit[Hiện lỗi inline]
    ErrEdit --> EditForm
    ValidateEdit -- Đúng --> CheckNet1{Có mạng?}
    CheckNet1 -- Không --> ErrOffline1[Báo cần mạng để lưu]
    ErrOffline1 --> EditForm
    CheckNet1 -- Có --> CallUpdateRPC[Gọi RPC update_box\n- server kiểm tra lại\nnow() < open_at hiện tại]
    CallUpdateRPC --> ServerCheckEdit{Hộp vẫn còn\n"Đang khóa"\ntheo server time?}
    ServerCheckEdit -- Đã hết hạn sửa\n(giữa lúc user đang gõ) --> ErrExpired[Báo "Hộp đã đến hạn mở,\nkhông thể sửa nữa"]
    ErrExpired --> BackToList1[Quay về Danh sách,\nhộp giờ ở trạng thái Sẵn sàng mở]
    BackToList1 --> End2([Kết thúc])
    ServerCheckEdit -- Còn hạn --> SaveEdit[Cập nhật content_text/\nopen_at/follow_up_question]
    SaveEdit --> SaveEditResult{Lưu thành công?}
    SaveEditResult -- Không --> ErrSaveEdit[Báo lỗi, giữ form]
    ErrSaveEdit --> EditForm
    SaveEditResult -- Có --> BackToList2[Quay về Danh sách,\nhiển thị nội dung mới]
    BackToList2 --> End3([Kết thúc])

    Choose -- Xóa --> ConfirmDialog[Hiện dialog xác nhận\n"Bạn chắc chắn muốn xóa?"]
    ConfirmDialog --> ConfirmChoice{User xác nhận?}
    ConfirmChoice -- Hủy --> End4([Kết thúc, không làm gì])
    ConfirmChoice -- Đồng ý --> CheckNet2{Có mạng?}
    CheckNet2 -- Không --> ErrOffline2[Báo cần mạng để xóa]
    ErrOffline2 --> End5([Kết thúc])
    CheckNet2 -- Có --> CallDelete[Gọi delete boxes\nRLS: chỉ xóa được hộp\ncủa chính user, còn Đang khóa]
    CallDelete --> DeleteResult{Xóa thành công?}
    DeleteResult -- Không (đã hết hạn khóa\ngiữa lúc confirm) --> ErrDeleteExpired[Báo "Hộp đã đến hạn mở,\nkhông thể xóa nữa"]
    ErrDeleteExpired --> BackToList3[Quay về Danh sách,\nrefresh trạng thái]
    BackToList3 --> End6([Kết thúc])
    DeleteResult -- Có --> RemoveFromList[Xóa row boxes\n+ cascade box_attachments]
    RemoveFromList --> End7([Kết thúc])
```

## Ghi chú
- Action Sửa/Xóa chỉ hiện với hộp "Đang khóa" — nhưng vì trạng thái có thể đổi thành "Sẵn sàng mở" ngay giữa lúc user thao tác, mọi update/delete đều được server (RPC hoặc RLS + trigger chặn update ở `schema.md`) kiểm tra lại theo `now()` server time, không chỉ dựa vào trạng thái đã load trên UI — tránh race condition edit sau khi hết hạn.
- Xóa ảnh đính kèm: cascade xóa `box_attachments` kèm file trong Storage (dọn qua Edge Function hoặc Storage trigger).
