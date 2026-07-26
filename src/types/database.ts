export type BoxStatus = 'locked' | 'ready' | 'opened';

export interface Box {
  id: string;
  user_id: string;
  content_text: string;
  open_at: string;
  opened_at: string | null;
  follow_up_question: string | null;
  follow_up_answer: boolean | null;
  follow_up_answered_at: string | null;
  notified_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface BoxWithStatus extends Box {
  status: BoxStatus;
}

export interface BoxAttachment {
  id: string;
  box_id: string;
  user_id: string;
  storage_path: string;
  mime_type: 'image/jpeg' | 'image/png';
  size_bytes: number;
  created_at: string;
}

export interface PushToken {
  id: string;
  user_id: string;
  expo_push_token: string;
  device_id: string;
  created_at: string;
  updated_at: string;
}
