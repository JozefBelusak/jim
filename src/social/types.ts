export type PublicProfile = { id: string; username: string; display_name: string; bio: string; created_at: string };
export type ProfileInput = Pick<PublicProfile, 'username' | 'display_name' | 'bio'>;
export type ChatMessage = { id: string; chat_id: string; sender_id: string; body: string; client_id: string; created_at: string; photo_path?: string | null; photo_width?: number | null; photo_height?: number | null };
export type PhotoMetadata = { width: number; height: number; byteSize: number };
export type PendingPhoto = PhotoMetadata & { objectPath?: string };
export type PreparedPhoto = PhotoMetadata & { blob: Blob };
export type PhotoReservation = { object_path: string; chat_id: string; user_id: string; client_id: string; byte_size: number; width: number; height: number; created_at: string };
export type ChatSummary = { id: string; peer_id: string; username: string; display_name: string; bio: string; last_body: string | null; last_message_at: string | null; unread_count: number };
export type ChatPeer = Pick<PublicProfile, 'id' | 'username' | 'display_name' | 'bio'>;
export type OpenChat = { id: string; peer: ChatPeer };
export type PendingMessage = { clientId: string; body: string; createdAt: string; photo?: PendingPhoto };
type Table<Row, Insert = Partial<Row>, Update = Partial<Insert>> = { Row: Row; Insert: Insert; Update: Update; Relationships: [] };
export type Database = {
  public: {
    Tables: {
      social_profiles: Table<PublicProfile, ProfileInput & { id: string }>;
      direct_chats: Table<{ id: string; member_a: string; member_b: string; created_at: string; last_message_at: string | null; read_a_at: string | null; read_b_at: string | null }>;
      chat_messages: Table<ChatMessage>;
      social_blocks: Table<{ blocker_id: string; blocked_id: string }, { blocker_id: string; blocked_id: string }>;
      chat_photos: Table<PhotoReservation>;
    };
    Views: Record<string, never>;
    Functions: {
      start_direct_chat: { Args: { other_user_id: string }; Returns: string };
      send_direct_message: { Args: { chat_id: string; message_body: string; client_id: string }; Returns: ChatMessage[] };
      reserve_chat_photo: { Args: { chat_id: string; client_id: string; byte_size: number; width: number; height: number }; Returns: PhotoReservation[] };
      send_direct_photo: { Args: { chat_id: string; message_body: string; client_id: string; photo_path: string }; Returns: ChatMessage[] };
      get_direct_messages: { Args: { chat_id: string; before_time?: string; before_id?: string }; Returns: ChatMessage[] };
      list_direct_chats: { Args: Record<string, never>; Returns: ChatSummary[] };
      mark_direct_chat_read: { Args: { chat_id: string; message_id: string }; Returns: undefined };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
