export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      categories: {
        Row: {
          created_at: string
          id: number
          name: string
        }
        Insert: {
          created_at?: string
          id?: number
          name: string
        }
        Update: {
          created_at?: string
          id?: number
          name?: string
        }
        Relationships: []
      }
      collections: {
        Row: {
          created_at: string
          description: string | null
          id: number
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: number
          name: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: number
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      normalized_ingredients_jobs: {
        Row: {
          attempts: number
          created_at: string
          id: number
          last_error: string | null
          next_run_at: string
          recipe_id: number
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          id?: number
          last_error?: string | null
          next_run_at?: string
          recipe_id: number
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          attempts?: number
          created_at?: string
          id?: number
          last_error?: string | null
          next_run_at?: string
          recipe_id?: number
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "normalized_ingredients_jobs_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipe_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "normalized_ingredients_jobs_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_recipes: {
        Row: {
          added_at: string
          recipe_id: number
          user_id: string
        }
        Insert: {
          added_at?: string
          recipe_id: number
          user_id?: string
        }
        Update: {
          added_at?: string
          recipe_id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_plan_recipes_recipe"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipe_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_plan_recipes_recipe"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          updated_at: string
          username: string | null
        }
        Insert: {
          created_at?: string
          id: string
          updated_at?: string
          username?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      recipe_collections: {
        Row: {
          collection_id: number
          recipe_id: number
        }
        Insert: {
          collection_id: number
          recipe_id: number
        }
        Update: {
          collection_id?: number
          recipe_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "recipe_collections_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_collections_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipe_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_collections_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_normalized_ingredients: {
        Row: {
          items: Json
          recipe_id: number
          updated_at: string
        }
        Insert: {
          items: Json
          recipe_id: number
          updated_at?: string
        }
        Update: {
          items?: Json
          recipe_id?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipe_normalized_ingredients_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: true
            referencedRelation: "recipe_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_normalized_ingredients_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: true
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_tags: {
        Row: {
          recipe_id: number
          tag_id: number
        }
        Insert: {
          recipe_id: number
          tag_id: number
        }
        Update: {
          recipe_id?: number
          tag_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "recipe_tags_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipe_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_tags_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      recipes: {
        Row: {
          category_id: number | null
          created_at: string
          cuisine: Database["public"]["Enums"]["recipe_cuisine"] | null
          deleted_at: string | null
          description: string | null
          diet_type: Database["public"]["Enums"]["recipe_diet_type"] | null
          difficulty: Database["public"]["Enums"]["recipe_difficulty"] | null
          id: number
          image_path: string | null
          ingredients: Json
          is_grill: boolean
          is_termorobot: boolean
          name: string
          normalized_ingredients_status: string
          normalized_ingredients_updated_at: string | null
          prep_time_minutes: number | null
          search_vector: unknown
          servings: number | null
          steps: Json
          tips: Json
          total_time_minutes: number | null
          updated_at: string
          user_id: string
          visibility: Database["public"]["Enums"]["recipe_visibility"]
        }
        Insert: {
          category_id?: number | null
          created_at?: string
          cuisine?: Database["public"]["Enums"]["recipe_cuisine"] | null
          deleted_at?: string | null
          description?: string | null
          diet_type?: Database["public"]["Enums"]["recipe_diet_type"] | null
          difficulty?: Database["public"]["Enums"]["recipe_difficulty"] | null
          id?: number
          image_path?: string | null
          ingredients: Json
          is_grill?: boolean
          is_termorobot?: boolean
          name: string
          normalized_ingredients_status?: string
          normalized_ingredients_updated_at?: string | null
          prep_time_minutes?: number | null
          search_vector?: unknown
          servings?: number | null
          steps: Json
          tips?: Json
          total_time_minutes?: number | null
          updated_at?: string
          user_id?: string
          visibility?: Database["public"]["Enums"]["recipe_visibility"]
        }
        Update: {
          category_id?: number | null
          created_at?: string
          cuisine?: Database["public"]["Enums"]["recipe_cuisine"] | null
          deleted_at?: string | null
          description?: string | null
          diet_type?: Database["public"]["Enums"]["recipe_diet_type"] | null
          difficulty?: Database["public"]["Enums"]["recipe_difficulty"] | null
          id?: number
          image_path?: string | null
          ingredients?: Json
          is_grill?: boolean
          is_termorobot?: boolean
          name?: string
          normalized_ingredients_status?: string
          normalized_ingredients_updated_at?: string | null
          prep_time_minutes?: number | null
          search_vector?: unknown
          servings?: number | null
          steps?: Json
          tips?: Json
          total_time_minutes?: number | null
          updated_at?: string
          user_id?: string
          visibility?: Database["public"]["Enums"]["recipe_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "recipes_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      shopping_list_items: {
        Row: {
          amount: number | null
          created_at: string
          id: number
          is_owned: boolean
          kind: string
          name: string | null
          text: string | null
          unit: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number | null
          created_at?: string
          id?: number
          is_owned?: boolean
          kind: string
          name?: string | null
          text?: string | null
          unit?: string | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          amount?: number | null
          created_at?: string
          id?: number
          is_owned?: boolean
          kind?: string
          name?: string | null
          text?: string | null
          unit?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      shopping_list_recipe_contributions: {
        Row: {
          amount: number | null
          created_at: string
          id: number
          name: string
          recipe_id: number
          unit: string | null
          user_id: string
        }
        Insert: {
          amount?: number | null
          created_at?: string
          id?: number
          name: string
          recipe_id: number
          unit?: string | null
          user_id?: string
        }
        Update: {
          amount?: number | null
          created_at?: string
          id?: number
          name?: string
          recipe_id?: number
          unit?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_shopping_list_contributions_recipe"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipe_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_shopping_list_contributions_recipe"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          created_at: string
          id: number
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: number
          name: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: number
          name?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      recipe_details: {
        Row: {
          category_id: number | null
          category_name: string | null
          collection_ids: number[] | null
          collections: Json | null
          created_at: string | null
          cuisine: Database["public"]["Enums"]["recipe_cuisine"] | null
          deleted_at: string | null
          description: string | null
          diet_type: Database["public"]["Enums"]["recipe_diet_type"] | null
          difficulty: Database["public"]["Enums"]["recipe_difficulty"] | null
          id: number | null
          image_path: string | null
          ingredients: Json | null
          is_grill: boolean | null
          is_termorobot: boolean | null
          name: string | null
          normalized_ingredients_status: string | null
          normalized_ingredients_updated_at: string | null
          prep_time_minutes: number | null
          search_vector: unknown
          servings: number | null
          steps: Json | null
          tag_ids: number[] | null
          tags: Json | null
          tips: Json | null
          total_time_minutes: number | null
          updated_at: string | null
          user_id: string | null
          visibility: Database["public"]["Enums"]["recipe_visibility"] | null
        }
        Relationships: [
          {
            foreignKeyName: "recipes_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      add_recipe_to_plan_and_update_shopping_list: {
        Args: { p_recipe_id: number }
        Returns: Json
      }
      ai_rate_limit_hit: {
        Args: {
          p_key: string
          p_limit: number
          p_now?: string
          p_window_seconds: number
        }
        Returns: {
          allowed: boolean
          current_count: number
          retry_after_seconds: number
          window_start: string
        }[]
      }
      clear_plan_and_update_shopping_list: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      claim_normalized_ingredients_jobs: {
        Args: { p_limit?: number }
        Returns: Json
      }
      create_recipe_with_tags:
        | {
            Args: {
              p_category_id: number
              p_description: string
              p_ingredients_raw: string
              p_is_termorobot?: boolean
              p_name: string
              p_prep_time_minutes?: number
              p_servings?: number
              p_steps_raw: string
              p_tag_names: string[]
              p_total_time_minutes?: number
              p_user_id: string
              p_visibility?: Database["public"]["Enums"]["recipe_visibility"]
            }
            Returns: number
          }
        | {
            Args: {
              p_category_id: number
              p_cuisine?: Database["public"]["Enums"]["recipe_cuisine"]
              p_description: string
              p_diet_type?: Database["public"]["Enums"]["recipe_diet_type"]
              p_difficulty?: Database["public"]["Enums"]["recipe_difficulty"]
              p_ingredients_raw: string
              p_is_termorobot?: boolean
              p_name: string
              p_prep_time_minutes?: number
              p_servings?: number
              p_steps_raw: string
              p_tag_names: string[]
              p_total_time_minutes?: number
              p_user_id: string
              p_visibility?: Database["public"]["Enums"]["recipe_visibility"]
            }
            Returns: number
          }
        | {
            Args: {
              p_category_id: number
              p_cuisine?: Database["public"]["Enums"]["recipe_cuisine"]
              p_description: string
              p_diet_type?: Database["public"]["Enums"]["recipe_diet_type"]
              p_difficulty?: Database["public"]["Enums"]["recipe_difficulty"]
              p_ingredients_raw: string
              p_is_grill?: boolean
              p_is_termorobot?: boolean
              p_name: string
              p_prep_time_minutes?: number
              p_servings?: number
              p_steps_raw: string
              p_tag_names: string[]
              p_total_time_minutes?: number
              p_user_id: string
              p_visibility?: Database["public"]["Enums"]["recipe_visibility"]
            }
            Returns: number
          }
        | {
            Args: {
              p_category_id: number
              p_description: string
              p_ingredients_raw: string
              p_is_termorobot?: boolean
              p_name: string
              p_servings?: number
              p_steps_raw: string
              p_tag_names: string[]
              p_user_id: string
              p_visibility?: Database["public"]["Enums"]["recipe_visibility"]
            }
            Returns: number
          }
        | {
            Args: {
              p_category_id: number
              p_description: string
              p_ingredients_raw: string
              p_name: string
              p_steps_raw: string
              p_tag_names: string[]
              p_user_id: string
              p_visibility?: Database["public"]["Enums"]["recipe_visibility"]
            }
            Returns: number
          }
        | {
            Args: {
              p_category_id: number
              p_description: string
              p_ingredients_raw: string
              p_name: string
              p_steps_raw: string
              p_tag_names: string[]
              p_user_id: string
            }
            Returns: number
          }
        | {
            Args: {
              p_category_id: number
              p_cuisine?: Database["public"]["Enums"]["recipe_cuisine"]
              p_description: string
              p_diet_type?: Database["public"]["Enums"]["recipe_diet_type"]
              p_difficulty?: Database["public"]["Enums"]["recipe_difficulty"]
              p_ingredients_raw: string
              p_is_grill?: boolean
              p_is_termorobot?: boolean
              p_name: string
              p_prep_time_minutes?: number
              p_servings?: number
              p_steps_raw: string
              p_tag_names: string[]
              p_tips_raw?: string
              p_total_time_minutes?: number
              p_user_id: string
              p_visibility?: Database["public"]["Enums"]["recipe_visibility"]
            }
            Returns: number
          }
      enqueue_normalized_ingredients_refresh: {
        Args: { p_recipe_id: number }
        Returns: Json
      }
      get_recipes_list: {
        Args: {
          p_category_id?: number
          p_cuisine?: Database["public"]["Enums"]["recipe_cuisine"]
          p_diet_type?: Database["public"]["Enums"]["recipe_diet_type"]
          p_difficulty?: Database["public"]["Enums"]["recipe_difficulty"]
          p_grill?: boolean
          p_limit?: number
          p_page?: number
          p_search?: string
          p_sort_direction?: string
          p_sort_field?: string
          p_tag_ids?: number[]
          p_termorobot?: boolean
          p_user_id: string
          p_view?: string
        }
        Returns: {
          author_id: string
          author_username: string
          category_id: number
          category_name: string
          created_at: string
          cuisine: Database["public"]["Enums"]["recipe_cuisine"]
          diet_type: Database["public"]["Enums"]["recipe_diet_type"]
          difficulty: Database["public"]["Enums"]["recipe_difficulty"]
          id: number
          image_path: string
          in_my_collections: boolean
          in_my_plan: boolean
          is_grill: boolean
          is_owner: boolean
          is_termorobot: boolean
          name: string
          prep_time_minutes: number
          servings: number
          total_count: number
          total_time_minutes: number
          visibility: Database["public"]["Enums"]["recipe_visibility"]
        }[]
      }
      jsonb_to_text: { Args: { input_jsonb: Json }; Returns: string }
      parse_text_to_jsonb: { Args: { input_text: string }; Returns: Json }
      remove_recipe_from_plan_and_update_shopping_list: {
        Args: { p_recipe_id: number }
        Returns: Json
      }
      update_recipe_with_tags:
        | {
            Args: {
              p_category_id?: number
              p_description?: string
              p_image_path?: string
              p_ingredients_raw?: string
              p_name?: string
              p_recipe_id: number
              p_steps_raw?: string
              p_tag_names?: string[]
              p_update_category?: boolean
              p_update_tags?: boolean
              p_user_id: string
              p_visibility?: Database["public"]["Enums"]["recipe_visibility"]
            }
            Returns: number
          }
        | {
            Args: {
              p_category_id?: number
              p_description?: string
              p_image_path?: string
              p_ingredients_raw?: string
              p_is_termorobot?: boolean
              p_name?: string
              p_recipe_id: number
              p_servings?: number
              p_steps_raw?: string
              p_tag_names?: string[]
              p_update_category?: boolean
              p_update_is_termorobot?: boolean
              p_update_servings?: boolean
              p_update_tags?: boolean
              p_user_id: string
              p_visibility?: Database["public"]["Enums"]["recipe_visibility"]
            }
            Returns: number
          }
        | {
            Args: {
              p_category_id?: number
              p_description?: string
              p_ingredients_raw?: string
              p_name?: string
              p_recipe_id: number
              p_steps_raw?: string
              p_tag_names?: string[]
              p_update_tags?: boolean
              p_user_id: string
            }
            Returns: number
          }
        | {
            Args: {
              p_category_id?: number
              p_description?: string
              p_image_path?: string
              p_ingredients_raw?: string
              p_name?: string
              p_recipe_id: number
              p_steps_raw?: string
              p_tag_names?: string[]
              p_update_tags?: boolean
              p_user_id: string
              p_visibility?: Database["public"]["Enums"]["recipe_visibility"]
            }
            Returns: number
          }
        | {
            Args: {
              p_category_id?: number
              p_cuisine?: Database["public"]["Enums"]["recipe_cuisine"]
              p_description?: string
              p_diet_type?: Database["public"]["Enums"]["recipe_diet_type"]
              p_difficulty?: Database["public"]["Enums"]["recipe_difficulty"]
              p_image_path?: string
              p_ingredients_raw?: string
              p_is_grill?: boolean
              p_is_termorobot?: boolean
              p_name?: string
              p_prep_time_minutes?: number
              p_recipe_id: number
              p_servings?: number
              p_steps_raw?: string
              p_tag_names?: string[]
              p_tips_raw?: string
              p_total_time_minutes?: number
              p_update_category?: boolean
              p_update_cuisine?: boolean
              p_update_diet_type?: boolean
              p_update_difficulty?: boolean
              p_update_is_grill?: boolean
              p_update_is_termorobot?: boolean
              p_update_prep_time?: boolean
              p_update_servings?: boolean
              p_update_tags?: boolean
              p_update_tips?: boolean
              p_update_total_time?: boolean
              p_user_id: string
              p_visibility?: Database["public"]["Enums"]["recipe_visibility"]
            }
            Returns: number
          }
        | {
            Args: {
              p_category_id?: number
              p_description?: string
              p_image_path?: string
              p_ingredients_raw?: string
              p_is_termorobot?: boolean
              p_name?: string
              p_prep_time_minutes?: number
              p_recipe_id: number
              p_servings?: number
              p_steps_raw?: string
              p_tag_names?: string[]
              p_total_time_minutes?: number
              p_update_category?: boolean
              p_update_is_termorobot?: boolean
              p_update_prep_time?: boolean
              p_update_servings?: boolean
              p_update_tags?: boolean
              p_update_total_time?: boolean
              p_user_id: string
              p_visibility?: Database["public"]["Enums"]["recipe_visibility"]
            }
            Returns: number
          }
        | {
            Args: {
              p_category_id?: number
              p_cuisine?: Database["public"]["Enums"]["recipe_cuisine"]
              p_description?: string
              p_diet_type?: Database["public"]["Enums"]["recipe_diet_type"]
              p_difficulty?: Database["public"]["Enums"]["recipe_difficulty"]
              p_image_path?: string
              p_ingredients_raw?: string
              p_is_termorobot?: boolean
              p_name?: string
              p_prep_time_minutes?: number
              p_recipe_id: number
              p_servings?: number
              p_steps_raw?: string
              p_tag_names?: string[]
              p_total_time_minutes?: number
              p_update_category?: boolean
              p_update_cuisine?: boolean
              p_update_diet_type?: boolean
              p_update_difficulty?: boolean
              p_update_is_termorobot?: boolean
              p_update_prep_time?: boolean
              p_update_servings?: boolean
              p_update_tags?: boolean
              p_update_total_time?: boolean
              p_user_id: string
              p_visibility?: Database["public"]["Enums"]["recipe_visibility"]
            }
            Returns: number
          }
        | {
            Args: {
              p_category_id?: number
              p_cuisine?: Database["public"]["Enums"]["recipe_cuisine"]
              p_description?: string
              p_diet_type?: Database["public"]["Enums"]["recipe_diet_type"]
              p_difficulty?: Database["public"]["Enums"]["recipe_difficulty"]
              p_image_path?: string
              p_ingredients_raw?: string
              p_is_grill?: boolean
              p_is_termorobot?: boolean
              p_name?: string
              p_prep_time_minutes?: number
              p_recipe_id: number
              p_servings?: number
              p_steps_raw?: string
              p_tag_names?: string[]
              p_total_time_minutes?: number
              p_update_category?: boolean
              p_update_cuisine?: boolean
              p_update_diet_type?: boolean
              p_update_difficulty?: boolean
              p_update_is_grill?: boolean
              p_update_is_termorobot?: boolean
              p_update_prep_time?: boolean
              p_update_servings?: boolean
              p_update_tags?: boolean
              p_update_total_time?: boolean
              p_user_id: string
              p_visibility?: Database["public"]["Enums"]["recipe_visibility"]
            }
            Returns: number
          }
    }
    Enums: {
      recipe_cuisine:
        | "POLISH"
        | "ASIAN"
        | "MEXICAN"
        | "MIDDLE_EASTERN"
        | "AFRICAN"
        | "AMERICAN"
        | "BALKAN"
        | "BRAZILIAN"
        | "BRITISH"
        | "CARIBBEAN"
        | "CHINESE"
        | "FRENCH"
        | "GERMAN"
        | "GREEK"
        | "INDIAN"
        | "ITALIAN"
        | "JAPANESE"
        | "KOREAN"
        | "MEDITERRANEAN"
        | "RUSSIAN"
        | "SCANDINAVIAN"
        | "SPANISH"
        | "THAI"
        | "TURKISH"
        | "VIETNAMESE"
      recipe_diet_type: "MEAT" | "VEGETARIAN" | "VEGAN"
      recipe_difficulty: "EASY" | "MEDIUM" | "HARD"
      recipe_visibility: "PRIVATE" | "SHARED" | "PUBLIC"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      recipe_cuisine: [
        "POLISH",
        "ASIAN",
        "MEXICAN",
        "MIDDLE_EASTERN",
        "AFRICAN",
        "AMERICAN",
        "BALKAN",
        "BRAZILIAN",
        "BRITISH",
        "CARIBBEAN",
        "CHINESE",
        "FRENCH",
        "GERMAN",
        "GREEK",
        "INDIAN",
        "ITALIAN",
        "JAPANESE",
        "KOREAN",
        "MEDITERRANEAN",
        "RUSSIAN",
        "SCANDINAVIAN",
        "SPANISH",
        "THAI",
        "TURKISH",
        "VIETNAMESE",
      ],
      recipe_diet_type: ["MEAT", "VEGETARIAN", "VEGAN"],
      recipe_difficulty: ["EASY", "MEDIUM", "HARD"],
      recipe_visibility: ["PRIVATE", "SHARED", "PUBLIC"],
    },
  },
} as const

