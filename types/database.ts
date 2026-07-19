/**
 * Tipos do banco de dados Supabase (PostgreSQL).
 *
 * Mantido manualmente por enquanto, no formato compatível com o gerado pelo
 * Supabase CLI. Depois que o projeto Supabase existir e o CLI estiver
 * linkado, este arquivo pode ser regenerado com:
 *   npx supabase gen types typescript --linked > types/database.ts
 *
 * As tabelas `favorites`, `reading_history` e `comments` referenciam os IDs
 * externos (MangaDex) como texto — não existe tabela local de
 * "obras", pois o catálogo é buscado ao vivo em lib/catalogo.ts.
 */

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          nome: string | null;
          avatar_url: string | null;
          criado_em: string;
        };
        Insert: {
          id: string;
          nome?: string | null;
          avatar_url?: string | null;
          criado_em?: string;
        };
        Update: {
          id?: string;
          nome?: string | null;
          avatar_url?: string | null;
          criado_em?: string;
        };
        Relationships: [];
      };
      favorites: {
        Row: {
          id: string;
          user_id: string;
          manga_id: string;
          titulo: string;
          capa: string | null;
          data_adicionado: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          manga_id: string;
          titulo: string;
          capa?: string | null;
          data_adicionado?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          manga_id?: string;
          titulo?: string;
          capa?: string | null;
          data_adicionado?: string;
        };
        Relationships: [];
      };
      reading_history: {
        Row: {
          id: string;
          user_id: string;
          manga_id: string;
          capitulo_id: string;
          pagina_atual: number;
          atualizado_em: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          manga_id: string;
          capitulo_id: string;
          pagina_atual?: number;
          atualizado_em?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          manga_id?: string;
          capitulo_id?: string;
          pagina_atual?: number;
          atualizado_em?: string;
        };
        Relationships: [];
      };
      comments: {
        Row: {
          id: string;
          user_id: string;
          manga_id: string;
          chapter_id: string;
          comentario: string;
          criado_em: string;
          atualizado_em: string;
          denuncias_count: number;
        };
        Insert: {
          id?: string;
          user_id: string;
          manga_id: string;
          chapter_id: string;
          comentario: string;
          criado_em?: string;
          atualizado_em?: string;
          denuncias_count?: number;
        };
        Update: {
          id?: string;
          user_id?: string;
          manga_id?: string;
          chapter_id?: string;
          comentario?: string;
          criado_em?: string;
          atualizado_em?: string;
          denuncias_count?: number;
        };
        Relationships: [];
      };
      comment_reports: {
        Row: {
          id: string;
          comment_id: string;
          reporter_id: string;
          criado_em: string;
        };
        Insert: {
          id?: string;
          comment_id: string;
          reporter_id: string;
          criado_em?: string;
        };
        Update: {
          id?: string;
          comment_id?: string;
          reporter_id?: string;
          criado_em?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Favorite = Database["public"]["Tables"]["favorites"]["Row"];
export type ReadingHistoryEntry =
  Database["public"]["Tables"]["reading_history"]["Row"];
export type Comment = Database["public"]["Tables"]["comments"]["Row"];
