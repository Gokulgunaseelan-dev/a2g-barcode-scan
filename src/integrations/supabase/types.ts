export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      products: {
        Row: {
          barcode: string
          brand: string
          category: string
          cost: number
          created_at: string
          hsn: string
          id: string
          image: string | null
          low_stock_at: number
          mrp: number
          name: string
          price: number
          stock: number
          subcategory: string
          tax: number
          unit: string
          updated_at: string
          user_id: string
        }
        Insert: {
          barcode?: string
          brand?: string
          category?: string
          cost?: number
          created_at?: string
          hsn?: string
          id?: string
          image?: string | null
          low_stock_at?: number
          mrp?: number
          name: string
          price?: number
          stock?: number
          subcategory?: string
          tax?: number
          unit?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          barcode?: string
          brand?: string
          category?: string
          cost?: number
          created_at?: string
          hsn?: string
          id?: string
          image?: string | null
          low_stock_at?: number
          mrp?: number
          name?: string
          price?: number
          stock?: number
          subcategory?: string
          tax?: number
          unit?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
        }
        Relationships: []
      }
      sale_items: {
        Row: {
          barcode: string
          brand: string | null
          created_at: string
          id: string
          mrp: number
          name: string
          price: number
          product_id: string | null
          qty: number
          sale_id: string
          tax: number
          unit: string | null
          user_id: string
        }
        Insert: {
          barcode?: string
          brand?: string | null
          created_at?: string
          id?: string
          mrp?: number
          name: string
          price?: number
          product_id?: string | null
          qty?: number
          sale_id: string
          tax?: number
          unit?: string | null
          user_id: string
        }
        Update: {
          barcode?: string
          brand?: string | null
          created_at?: string
          id?: string
          mrp?: number
          name?: string
          price?: number
          product_id?: string | null
          qty?: number
          sale_id?: string
          tax?: number
          unit?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          cgst: number
          completed_at: string | null
          created_at: string
          customer: string | null
          demo: boolean
          discount: number
          duration_sec: number | null
          id: string
          igst: number
          invoice_no: string
          mrp_total: number
          payment_mode: string
          savings: number
          session_id: string | null
          sgst: number
          started_at: string | null
          subtotal: number
          tax: number
          tax_mode: string
          taxable: number
          total: number
          user_id: string
        }
        Insert: {
          cgst?: number
          completed_at?: string | null
          created_at?: string
          customer?: string | null
          demo?: boolean
          discount?: number
          duration_sec?: number | null
          id?: string
          igst?: number
          invoice_no: string
          mrp_total?: number
          payment_mode?: string
          savings?: number
          session_id?: string | null
          sgst?: number
          started_at?: string | null
          subtotal?: number
          tax?: number
          tax_mode?: string
          taxable?: number
          total?: number
          user_id: string
        }
        Update: {
          cgst?: number
          completed_at?: string | null
          created_at?: string
          customer?: string | null
          demo?: boolean
          discount?: number
          duration_sec?: number | null
          id?: string
          igst?: number
          invoice_no?: string
          mrp_total?: number
          payment_mode?: string
          savings?: number
          session_id?: string | null
          sgst?: number
          started_at?: string | null
          subtotal?: number
          tax?: number
          tax_mode?: string
          taxable?: number
          total?: number
          user_id?: string
        }
        Relationships: []
      }
      stock_movements: {
        Row: {
          created_at: string
          delta: number
          id: string
          note: string | null
          product_id: string | null
          reason: string
          sale_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          delta: number
          id?: string
          note?: string | null
          product_id?: string | null
          reason?: string
          sale_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          delta?: number
          id?: string
          note?: string | null
          product_id?: string | null
          reason?: string
          sale_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      store_settings: {
        Row: {
          address: string
          admin_pin_hash: string
          currency: string
          gst_slabs: number[]
          gstin: string
          queue: Json
          rate: number
          rate_source: string
          role: string
          store_name: string
          tax_mode: string
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string
          admin_pin_hash?: string
          currency?: string
          gst_slabs?: number[]
          gstin?: string
          queue?: Json
          rate?: number
          rate_source?: string
          role?: string
          store_name?: string
          tax_mode?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string
          admin_pin_hash?: string
          currency?: string
          gst_slabs?: number[]
          gstin?: string
          queue?: Json
          rate?: number
          rate_source?: string
          role?: string
          store_name?: string
          tax_mode?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      adjust_stock: {
        Args: {
          p_delta: number
          p_note?: string
          p_product_id: string
          p_reason?: string
        }
        Returns: number
      }
      checkout_sale: {
        Args: { p_items: Json; p_sale: Json }
        Returns: {
          cgst: number
          completed_at: string | null
          created_at: string
          customer: string | null
          demo: boolean
          discount: number
          duration_sec: number | null
          id: string
          igst: number
          invoice_no: string
          mrp_total: number
          payment_mode: string
          savings: number
          session_id: string | null
          sgst: number
          started_at: string | null
          subtotal: number
          tax: number
          tax_mode: string
          taxable: number
          total: number
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "sales"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "cashier"
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
  public: {
    Enums: {
      app_role: ["admin", "cashier"],
    },
  },
} as const
