// Hand-typed DB schema. Replace with `supabase gen types typescript` output when CLI is wired up.

export type ContentType = "article" | "youtube" | "pdf" | "image" | "generic";
export type ItemStatus = "pending" | "extracting" | "ready" | "failed" | "archived";
export type Context =
  | "personal"
  | "family"
  | "wealth"
  | "health"
  | "twistag.ops"
  | "twistag.sales"
  | "twistag.devex"
  | "twistag.innovation"
  | "twistag.marketing";

export type Confidence = "low" | "medium" | "high";
export type Feedback = "up" | "down" | null;
export type TagSource = "ai" | "user";

type NoRel = [];

type ItemRow = {
  id: string;
  user_id: string;
  original_url: string;
  canonical_url: string;
  type: ContentType;
  title: string | null;
  author: string | null;
  published_at: string | null;
  hero_image_url: string | null;
  hero_image_alt: string | null;
  read_time_minutes: number | null;
  status: ItemStatus;
  error_message: string | null;
  is_paywalled: boolean;
  source_domain: string | null;
  user_notes: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  deleted_at: string | null;
  read_at: string | null;
  starred_at: string | null;
};
type ItemInsert = Partial<Omit<ItemRow, "id" | "created_at" | "updated_at">> & {
  user_id: string;
  original_url: string;
  canonical_url: string;
};

type ItemContentRow = {
  item_id: string;
  raw_text: string | null;
  html_snapshot_key: string | null;
  transcript_json: unknown | null;
  pdf_storage_key: string | null;
  image_storage_key: string | null;
  updated_at: string;
};

export type SourceQuality = "full" | "thin" | "title_only";

type ItemAiRow = {
  id: string;
  item_id: string;
  version: number;
  at_a_glance_md: string | null;
  summary_md: string | null;
  takeaways_md: string | null;
  primary_context: Context | null;
  source_quality: SourceQuality | null;
  model: string | null;
  created_at: string;
};

type InsightCardRow = {
  id: string;
  item_id: string;
  version: number;
  context: Context;
  headline: string;
  body_md: string;
  suggested_actions_md: string | null;
  confidence: Confidence;
  user_feedback: Feedback;
  created_at: string;
};

type TagRow = { id: string; user_id: string; name: string; created_at: string };
type ItemTagRow = { item_id: string; tag_id: string; source: TagSource; created_at: string };

type EmbeddingRow = {
  id: string;
  item_id: string;
  user_id: string;
  chunk_index: number;
  chunk_text: string;
  tokens: number | null;
  embedding: number[];
  created_at: string;
};

type ChatMessageRow = {
  id: string;
  user_id: string;
  conversation_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  sources: string[] | null;
  created_at: string;
};

type UserProfileRow = {
  user_id: string;
  version: number;
  profile_md: string;
  created_at: string;
};

type EventRow = {
  id: string;
  user_id: string | null;
  event_name: string;
  payload: Record<string, unknown> | null;
  created_at: string;
};

type ErrorRow = {
  id: string;
  user_id: string | null;
  source: string;
  message: string;
  stack: string | null;
  context: Record<string, unknown> | null;
  created_at: string;
};

type AiCallLogRow = {
  id: string;
  user_id: string | null;
  call: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cache_creation_tokens: number;
  cache_read_tokens: number;
  item_id: string | null;
  created_at: string;
};

export interface Database {
  __InternalSupabase: {
    PostgrestVersion: "12";
  };
  public: {
    Tables: {
      items: {
        Row: ItemRow;
        Insert: ItemInsert;
        Update: Partial<ItemInsert>;
        Relationships: NoRel;
      };
      item_content: {
        Row: ItemContentRow;
        Insert: Partial<ItemContentRow> & { item_id: string };
        Update: Partial<ItemContentRow>;
        Relationships: NoRel;
      };
      item_ai: {
        Row: ItemAiRow;
        Insert: Partial<Omit<ItemAiRow, "id" | "created_at">> & { item_id: string };
        Update: Partial<ItemAiRow>;
        Relationships: NoRel;
      };
      insight_cards: {
        Row: InsightCardRow;
        Insert: Partial<Omit<InsightCardRow, "id" | "created_at">> & {
          item_id: string;
          context: Context;
          headline: string;
          body_md: string;
        };
        Update: Partial<InsightCardRow>;
        Relationships: NoRel;
      };
      tags: {
        Row: TagRow;
        Insert: Partial<Omit<TagRow, "id" | "created_at">> & { user_id: string; name: string };
        Update: Partial<TagRow>;
        Relationships: NoRel;
      };
      item_tags: {
        Row: ItemTagRow;
        Insert: Partial<Omit<ItemTagRow, "created_at">> & { item_id: string; tag_id: string };
        Update: Partial<ItemTagRow>;
        Relationships: NoRel;
      };
      embeddings: {
        Row: EmbeddingRow;
        Insert: Partial<Omit<EmbeddingRow, "id" | "created_at">> & {
          item_id: string;
          user_id: string;
          chunk_index: number;
          chunk_text: string;
          embedding: number[];
        };
        Update: Partial<EmbeddingRow>;
        Relationships: NoRel;
      };
      chat_messages: {
        Row: ChatMessageRow;
        Insert: Partial<Omit<ChatMessageRow, "id" | "created_at">> & {
          user_id: string;
          conversation_id: string;
          role: ChatMessageRow["role"];
          content: string;
        };
        Update: Partial<ChatMessageRow>;
        Relationships: NoRel;
      };
      user_profile: {
        Row: UserProfileRow;
        Insert: Partial<UserProfileRow> & { user_id: string; profile_md: string };
        Update: Partial<UserProfileRow>;
        Relationships: NoRel;
      };
      events: {
        Row: EventRow;
        Insert: Partial<Omit<EventRow, "id" | "created_at">> & { event_name: string };
        Update: Partial<EventRow>;
        Relationships: NoRel;
      };
      errors: {
        Row: ErrorRow;
        Insert: Partial<Omit<ErrorRow, "id" | "created_at">> & { source: string; message: string };
        Update: Partial<ErrorRow>;
        Relationships: NoRel;
      };
      ai_call_log: {
        Row: AiCallLogRow;
        Insert: Partial<Omit<AiCallLogRow, "id" | "created_at">> & { call: string; model: string };
        Update: Partial<AiCallLogRow>;
        Relationships: NoRel;
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      match_embeddings: {
        Args: { query_embedding: number[]; match_count: number; user_id_filter: string };
        Returns: {
          id: string;
          item_id: string;
          chunk_index: number;
          chunk_text: string;
          similarity: number;
        }[];
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
