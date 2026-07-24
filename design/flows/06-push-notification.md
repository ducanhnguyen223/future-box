# Activity Diagram - #6 Push Notification

```mermaid
flowchart TD
    subgraph AppSide [Phía app - đăng ký nhận thông báo]
        Start1([User mở app lần đầu\nhoặc vào Cài đặt]) --> AskPermission{Đã cấp quyền\nnotification?}
        AskPermission -- Chưa hỏi --> RequestPerm[Yêu cầu quyền\nexpo-notifications]
        RequestPerm --> PermResult{User cho phép?}
        PermResult -- Từ chối --> NoToken[Không lấy token,\nkhông có push, không lỗi/crash]
        NoToken --> End1([Kết thúc])
        PermResult -- Đồng ý --> GetToken[getExpoPushTokenAsync]
        GetToken --> SaveToken[Upsert vào push_tokens\ntheo user_id + device_id]
        SaveToken --> End2([Kết thúc])
        AskPermission -- Đã có quyền --> End3([Kết thúc, không hỏi lại])
    end

    subgraph ServerSide [Phía server - cron quét & gửi]
        Start2([Cron job định kỳ\nSupabase Edge Function]) --> ScanDue[Query boxes:\nopen_at <= now()\nAND opened_at IS NULL\nAND notified_at IS NULL]
        ScanDue --> AnyDue{Có hộp nào\nđến hạn?}
        AnyDue -- Không --> Idle[Kết thúc lượt quét]
        AnyDue -- Có --> ForEachBox[Với mỗi hộp đến hạn]
        ForEachBox --> LookupToken[Lấy push_tokens\ntheo user_id của hộp]
        LookupToken --> HasToken{Có token hợp lệ?}
        HasToken -- Không --> SkipUser[Bỏ qua user này,\nkhông lỗi]
        SkipUser --> MarkNotified
        HasToken -- Có --> CallExpoAPI[Gọi Expo Push API]
        CallExpoAPI --> SendResult{Gửi thành công?}
        SendResult -- Không (token invalid/lỗi mạng) --> LogFail[Log lỗi, không set notified_at\nđể lần cron sau thử lại]
        SendResult -- Có --> MarkNotified[Set boxes.notified_at = now()]
        MarkNotified --> Idle
        LogFail --> Idle
    end

    Idle --> End4([Chờ lượt cron kế tiếp])
```

## Ghi chú
- Gửi push không phụ thuộc app có đang mở hay không — cron chạy độc lập phía Supabase, đúng Assumption trong PRD.
- Cột `notified_at` (bảng `boxes`) chống gửi trùng notification cho cùng 1 hộp qua nhiều lượt cron; index partial `idx_boxes_open_at_pending` giúp cron chỉ scan hộp còn "chưa mở & chưa notify".
- User tắt quyền thông báo → không có row trong `push_tokens` → cron tự bỏ qua, không crash, không lỗi (đúng AC #6).
- Tap vào push notification khi hộp đến hạn → điều hướng thẳng vào flow #4 Mở hộp thời gian.
