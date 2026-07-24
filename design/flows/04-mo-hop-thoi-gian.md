# Activity Diagram - #4 Mở hộp thời gian

```mermaid
flowchart TD
    Start([Tap hộp "Sẵn sàng mở"\ntừ Danh sách hộp]) --> CheckNet{Có mạng?}
    CheckNet -- Không --> ErrOffline[Báo "Cần kết nối mạng\nđể mở hộp"]
    ErrOffline --> End1([Kết thúc])

    CheckNet -- Có --> CallOpenRPC[Gọi Edge Function/RPC\n"open_box" - dùng now() SERVER,\nkhông dùng giờ máy client]
    CallOpenRPC --> ServerCheck{Server so sánh\nnow() >= open_at?}

    ServerCheck -- Chưa đến hạn --> Blocked[Trả về: còn bao lâu nữa\nmới mở được]
    Blocked --> ShowCountdown[Hiển thị "Còn X giờ/ngày nữa"\nkhông cho xem nội dung]
    ShowCountdown --> End2([Kết thúc])

    ServerCheck -- Đủ điều kiện --> AlreadyOpened{opened_at\nđã có sẵn?}
    AlreadyOpened -- Có (đã mở trước đó) --> ShowContentReadonly[Hiển thị lại nội dung gốc\n+ câu trả lời follow-up cũ,\nkhông cho trả lời lại]
    ShowContentReadonly --> End3([Kết thúc])

    AlreadyOpened -- Chưa --> RevealContent[Hiển thị content_text\n+ ảnh đính kèm nếu có,\nhiệu ứng mở khóa]
    RevealContent --> HasFollowUp{Có follow_up_question?}

    HasFollowUp -- Không --> MarkOpened[Server set opened_at = now()]
    MarkOpened --> Celebrate1[Đánh dấu "Đã mở",\nkhông có bước trả lời]
    Celebrate1 --> End4([Kết thúc])

    HasFollowUp -- Có --> ShowQuestion[Hiển thị câu hỏi,\nyêu cầu chọn Yes/No]
    ShowQuestion --> ForceAnswer{User bắt buộc\nchọn Yes hoặc No}
    ForceAnswer -- Chọn Yes --> SaveYes[Gọi RPC lưu\nfollow_up_answer=true,\nfollow_up_answered_at=now(),\nopened_at=now()]
    SaveYes --> SaveResultY{Lưu thành công?}
    SaveResultY -- Không --> ErrSave1[Báo lỗi, cho thử lại]
    ErrSave1 --> ForceAnswer
    SaveResultY -- Có --> Confetti[Hiệu ứng chúc mừng/confetti]
    Confetti --> End5([Kết thúc])

    ForceAnswer -- Chọn No --> SaveNo[Gọi RPC lưu\nfollow_up_answer=false,\nfollow_up_answered_at=now(),\nopened_at=now()]
    SaveNo --> SaveResultN{Lưu thành công?}
    SaveResultN -- Không --> ErrSave2[Báo lỗi, cho thử lại]
    ErrSave2 --> ForceAnswer
    SaveResultN -- Có --> NoEffect[Đánh dấu "Đã mở",\nkhông có hiệu ứng chúc mừng]
    NoEffect --> End6([Kết thúc])
```

## Ghi chú - chống gian lận giờ máy
- Điều kiện `now() >= open_at` chỉ được đánh giá trong Edge Function/RPC phía Supabase (server time), client tuyệt đối không tự tính toán để quyết định cho phép mở.
- `opened_at`, `follow_up_answer`, `follow_up_answered_at` chỉ được ghi qua RPC này (RLS chặn client UPDATE trực tiếp các cột đó) — user không thể tự sửa giờ điện thoại để giả lập đã đến hạn, và không thể sửa lại câu trả lời follow-up sau khi đã trả lời (theo AC #4: "mỗi hộp chỉ ghi nhận câu trả lời 1 lần").
- Mất mạng giữa lúc gọi RPC → không set được `opened_at`, hộp vẫn giữ nguyên trạng thái, user thử lại sau.
