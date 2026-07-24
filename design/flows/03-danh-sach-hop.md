# Activity Diagram - #3 Danh sách hộp

```mermaid
flowchart TD
    Start([Vào màn Danh sách hộp]) --> CheckNet{Có mạng?}
    CheckNet -- Không --> LoadCache[Load dữ liệu hộp đã cache\ntừ lần load gần nhất]
    LoadCache --> ShowOfflineBanner[Hiện banner "Đang offline -\ndữ liệu có thể chưa mới nhất"]
    ShowOfflineBanner --> RenderList

    CheckNet -- Có --> FetchBoxes[Query boxes_with_status\ncủa user hiện tại]
    FetchBoxes --> FetchResult{Query thành công?}
    FetchResult -- Không --> LoadCache
    FetchResult -- Có --> UpdateCache[Cập nhật cache local]
    UpdateCache --> RenderList[Render danh sách,\nnhóm theo status]

    RenderList --> Groups{Nhóm theo status}
    Groups --> Locked[Đang khóa]
    Groups --> Ready[Sẵn sàng mở]
    Groups --> Opened[Đã mở]

    Locked --> TapLocked[User tap vào hộp Đang khóa]
    TapLocked --> BlockOpen[Chặn xem nội dung,\nhiện thời gian còn lại đến open_at]

    Ready --> TapReady[User tap vào hộp Sẵn sàng mở]
    TapReady --> GoOpenFlow[Điều hướng sang\nflow #4 Mở hộp thời gian]

    Opened --> TapOpened[User tap vào hộp Đã mở]
    TapOpened --> ViewReadonly[Xem lại nội dung + câu trả lời\nfollow-up (read-only)]

    RenderList --> Empty{Không có hộp nào?}
    Empty -- Đúng --> EmptyState[Hiện empty state,\nCTA "Tạo hộp mới"]

    RenderList --> Pull[User pull-to-refresh]
    Pull --> FetchBoxes

    BlockOpen --> End([Kết thúc])
    GoOpenFlow --> End
    ViewReadonly --> End
    EmptyState --> End
```

## Ghi chú
- Status lấy từ view `boxes_with_status` (derive từ `opened_at`/`open_at`, không lưu cột status riêng — xem `design/database/schema.md`).
- Offline: chỉ xem được cache, không cho tạo/sửa/mở hộp khi chưa có mạng (đúng NFR Offline).
- Performance target: load < 2s với vài trăm hộp/user (index `idx_boxes_user_id`).
