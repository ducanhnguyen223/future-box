import { supabase } from '@/lib/supabase';
import type { Box, BoxAttachment, BoxWithStatus } from '@/types/database';

const PHOTOS_BUCKET = 'box-photos';

/**
 * Sinh path duy nhất trong bucket, không cần trùng box.id vì DB tự sinh id khi insert
 * (upload ảnh phải xong trước insert boxes theo activity diagram 02).
 */
function buildPhotoPath(userId: string, mimeType: string): string {
  const extension = mimeType === 'image/png' ? 'png' : 'jpg';
  const token = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `${userId}/${token}.${extension}`;
}

export type UploadBoxPhotoParams = {
  userId: string;
  uri: string;
  mimeType: string;
};

export async function uploadBoxPhoto({ userId, uri, mimeType }: UploadBoxPhotoParams): Promise<string> {
  const path = buildPhotoPath(userId, mimeType);
  const arrayBuffer = await fetch(uri).then((res) => res.arrayBuffer());

  const { error } = await supabase.storage.from(PHOTOS_BUCKET).upload(path, arrayBuffer, {
    contentType: mimeType,
    upsert: false,
  });

  if (error) throw error;
  return path;
}

/** Dọn ảnh orphan khi bước sau (insert boxes/box_attachments) thất bại. Không throw nếu xóa cũng lỗi. */
export async function deleteBoxPhoto(storagePath: string): Promise<void> {
  await supabase.storage.from(PHOTOS_BUCKET).remove([storagePath]);
}

export type InsertBoxParams = {
  userId: string;
  contentText: string;
  openAt: string;
  followUpQuestion: string | null;
};

export async function insertBox(params: InsertBoxParams): Promise<Box> {
  const { data, error } = await supabase
    .from('boxes')
    .insert({
      user_id: params.userId,
      content_text: params.contentText,
      open_at: params.openAt,
      follow_up_question: params.followUpQuestion,
    })
    .select()
    .single();

  if (error) throw error;
  return data as Box;
}

/** Rollback khi insert box_attachments thất bại sau khi box đã tạo — tránh hộp thiếu ảnh mập mờ. */
export async function deleteBox(boxId: string): Promise<void> {
  await supabase.from('boxes').delete().eq('id', boxId);
}

export type InsertBoxAttachmentParams = {
  boxId: string;
  userId: string;
  storagePath: string;
  mimeType: 'image/jpeg' | 'image/png';
  sizeBytes: number;
};

/**
 * Danh sách hộp (Feature #3): đọc từ view boxes_with_status (status derive server-side),
 * sắp theo open_at tăng dần. RLS đã lọc theo auth.uid() nhưng vẫn truyền userId tường minh cho rõ ràng.
 */
export async function fetchBoxesWithStatus(userId: string): Promise<BoxWithStatus[]> {
  const { data, error } = await supabase
    .from('boxes_with_status')
    .select('*')
    .eq('user_id', userId)
    .order('open_at', { ascending: true });

  if (error) throw error;
  return (data ?? []) as BoxWithStatus[];
}

export async function insertBoxAttachment(params: InsertBoxAttachmentParams): Promise<BoxAttachment> {
  const { data, error } = await supabase
    .from('box_attachments')
    .insert({
      box_id: params.boxId,
      user_id: params.userId,
      storage_path: params.storagePath,
      mime_type: params.mimeType,
      size_bytes: params.sizeBytes,
    })
    .select()
    .single();

  if (error) throw error;
  return data as BoxAttachment;
}

// --- Mở hộp thời gian (Feature #4) ---

const SIGNED_URL_EXPIRES_IN_SECONDS = 60 * 60; // 1 giờ, đủ cho một phiên xem hộp

/** Đọc row hiện tại để biết trước open_at/opened_at/follow_up_question mà KHÔNG gọi RPC (RPC chỉ dùng để set opened_at). */
export async function fetchBoxById(boxId: string): Promise<Box> {
  const { data, error } = await supabase.from('boxes').select('*').eq('id', boxId).single();

  if (error) throw error;
  return data as Box;
}

/**
 * Gọi RPC open_box: server tự kiểm tra now() >= open_at và ghi opened_at/follow_up_answer
 * (chống gian lận giờ máy — client không tự quyết định). Idempotent nếu box đã mở.
 */
export async function openBox(boxId: string, followUpAnswer?: boolean): Promise<Box> {
  const { data, error } = await supabase.rpc('open_box', {
    p_box_id: boxId,
    p_follow_up_answer: followUpAnswer ?? null,
  });

  if (error) throw error;
  return data as Box;
}

// --- Sửa / Xóa hộp (Feature #7) ---

export type UpdateBoxParams = {
  contentText: string;
  openAt: string;
  followUpQuestion: string | null;
};

/**
 * UPDATE thường qua RLS boxes_owner_update — không cần RPC riêng vì trigger DB
 * guard_box_edit (migration 0001) đã tự raise exception nếu hộp đã opened/hết hạn
 * lúc submit, chặn race condition (server time, không tin client).
 */
export async function updateBox(boxId: string, params: UpdateBoxParams): Promise<Box> {
  const { data, error } = await supabase
    .from('boxes')
    .update({
      content_text: params.contentText,
      open_at: params.openAt,
      follow_up_question: params.followUpQuestion,
    })
    .eq('id', boxId)
    .select()
    .single();

  if (error) throw error;
  return data as Box;
}

/**
 * Xóa hộp do user chủ động thao tác (khác `deleteBox` — dùng nội bộ để rollback lúc tạo hộp).
 * Đọc storage_path của ảnh đính kèm (nếu có) TRƯỚC khi xóa row: nếu trigger guard_box_delete
 * (migration 0002) reject vì hộp đã hết hạn/đã mở, ta throw ngay và không đụng tới Storage.
 * Chỉ dọn file Storage sau khi xóa row thành công — cascade đã tự xóa box_attachments.
 */
export async function deleteBoxAndAttachment(boxId: string): Promise<void> {
  const { data: attachment, error: fetchError } = await supabase
    .from('box_attachments')
    .select('storage_path')
    .eq('box_id', boxId)
    .maybeSingle();

  if (fetchError) throw fetchError;

  const { error: deleteError } = await supabase.from('boxes').delete().eq('id', boxId);
  if (deleteError) throw deleteError;

  if (attachment) {
    await supabase.storage.from(PHOTOS_BUCKET).remove([attachment.storage_path]);
  }
}

/** Ảnh đính kèm (nếu có) qua signed URL vì bucket box-photos là private theo RLS. */
export async function fetchBoxAttachmentUrl(boxId: string): Promise<string | null> {
  const { data: attachment, error } = await supabase
    .from('box_attachments')
    .select('storage_path')
    .eq('box_id', boxId)
    .maybeSingle();

  if (error) throw error;
  if (!attachment) return null;

  const { data, error: signError } = await supabase.storage
    .from(PHOTOS_BUCKET)
    .createSignedUrl(attachment.storage_path, SIGNED_URL_EXPIRES_IN_SECONDS);

  if (signError) throw signError;
  return data.signedUrl;
}
