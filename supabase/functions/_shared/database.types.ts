/**
 * Database types for Supabase Edge Functions.
 * This is a copy of the shared database types for use in Edge Functions.
 *
 * NOTE: When the main database.types.ts is regenerated,
 * this file should be updated accordingly.
 */

export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[];

export type Database = {
    public: {
        Tables: {
            categories: {
                Row: {
                    created_at: string;
                    id: number;
                    name: string;
                };
                Insert: {
                    created_at?: string;
                    id?: number;
                    name: string;
                };
                Update: {
                    created_at?: string;
                    id?: number;
                    name?: string;
                };
                Relationships: [];
            };
            collections: {
                Row: {
                    created_at: string;
                    description: string | null;
                    id: number;
                    name: string;
                    updated_at: string;
                    user_id: string;
                };
                Insert: {
                    created_at?: string;
                    description?: string | null;
                    id?: number;
                    name: string;
                    updated_at?: string;
                    user_id?: string;
                };
                Update: {
                    created_at?: string;
                    description?: string | null;
                    id?: number;
                    name?: string;
                    updated_at?: string;
                    user_id?: string;
                };
                Relationships: [];
            };
            profiles: {
                Row: {
                    created_at: string;
                    id: string;
                    updated_at: string;
                    username: string | null;
                };
                Insert: {
                    created_at?: string;
                    id: string;
                    updated_at?: string;
                    username?: string | null;
                };
                Update: {
                    created_at?: string;
                    id?: string;
                    updated_at?: string;
                    username?: string | null;
                };
                Relationships: [];
            };
            recipe_collections: {
                Row: {
                    collection_id: number;
                    recipe_id: number;
                };
                Insert: {
                    collection_id: number;
                    recipe_id: number;
                };
                Update: {
                    collection_id?: number;
                    recipe_id?: number;
                };
                Relationships: [];
            };
            recipe_tags: {
                Row: {
                    recipe_id: number;
                    tag_id: number;
                };
                Insert: {
                    recipe_id: number;
                    tag_id: number;
                };
                Update: {
                    recipe_id?: number;
                    tag_id?: number;
                };
                Relationships: [];
            };
            recipes: {
                Row: {
                    category_id: number | null;
                    created_at: string;
                    deleted_at: string | null;
                    description: string | null;
                    id: number;
                    image_path: string | null;
                    ingredients: Json;
                    name: string;
                    search_vector: unknown;
                    steps: Json;
                    updated_at: string;
                    user_id: string;
                    visibility: string;
                };
                Insert: {
                    category_id?: number | null;
                    created_at?: string;
                    deleted_at?: string | null;
                    description?: string | null;
                    id?: number;
                    image_path?: string | null;
                    ingredients: Json;
                    name: string;
                    search_vector?: unknown;
                    steps: Json;
                    updated_at?: string;
                    user_id?: string;
                    visibility?: string;
                };
                Update: {
                    category_id?: number | null;
                    created_at?: string;
                    deleted_at?: string | null;
                    description?: string | null;
                    id?: number;
                    image_path?: string | null;
                    ingredients?: Json;
                    name?: string;
                    search_vector?: unknown;
                    steps?: Json;
                    updated_at?: string;
                    user_id?: string;
                    visibility?: string;
                };
                Relationships: [];
            };
            tags: {
                Row: {
                    created_at: string;
                    id: number;
                    name: string;
                    user_id: string;
                };
                Insert: {
                    created_at?: string;
                    id?: number;
                    name: string;
                    user_id?: string;
                };
                Update: {
                    created_at?: string;
                    id?: number;
                    name?: string;
                    user_id?: string;
                };
                Relationships: [];
            };
        };
        Views: {
            recipe_details: {
                Row: {
                    category_id: number | null;
                    category_name: string | null;
                    collection_ids: number[] | null;
                    collections: Json | null;
                    created_at: string | null;
                    deleted_at: string | null;
                    description: string | null;
                    id: number | null;
                    image_path: string | null;
                    ingredients: Json | null;
                    name: string | null;
                    search_vector: unknown;
                    steps: Json | null;
                    tag_ids: number[] | null;
                    tags: Json | null;
                    updated_at: string | null;
                    user_id: string | null;
                    visibility: string | null;
                };
                Relationships: [];
            };
        };
        Functions: {
            jsonb_to_text: { Args: { input_jsonb: Json }; Returns: string };
            parse_text_to_jsonb: {
                Args: { input_text: string };
                Returns: Json;
            };
        };
        Enums: {
            [_ in never]: never;
        };
        CompositeTypes: {
            [_ in never]: never;
        };
    };
};
