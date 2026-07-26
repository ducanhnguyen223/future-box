import { supabase } from '@/lib/supabase';
import type { Box, BoxAttachment } from '@/types/database';

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
