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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          created_at: string
          id: string
          key: string
          updated_at: string
          value: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          updated_at?: string
          value?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          updated_at?: string
          value?: string | null
        }
        Relationships: []
      }
      appointments: {
        Row: {
          attachments: string | null
          billing_note: string | null
          billing_type: string | null
          checklist: Json | null
          close_note: string | null
          closed_at: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          cust_id: string | null
          customer_address: string | null
          customer_name: string | null
          customer_sn: string | null
          depart_time: string | null
          id: string
          job_detail: string | null
          job_no: string | null
          logistics_note: string | null
          machine_label: string | null
          machine_unit_id: string | null
          parts_categories: string | null
          parts_note: string | null
          parts_replaced: string | null
          po_number: string | null
          priority: string | null
          quotation_items: string | null
          quotation_required: boolean
          result: string | null
          return_time: string | null
          safety_gear: string | null
          sales_rep: string | null
          serial_number: string | null
          service_type: string | null
          staff_name: string | null
          status: string
          updated_at: string
          vehicle_plate: string | null
          visit_date: string
          visit_time: string | null
          work_order_id: string | null
          work_types: string | null
        }
        Insert: {
          attachments?: string | null
          billing_note?: string | null
          billing_type?: string | null
          checklist?: Json | null
          close_note?: string | null
          closed_at?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          cust_id?: string | null
          customer_address?: string | null
          customer_name?: string | null
          customer_sn?: string | null
          depart_time?: string | null
          id?: string
          job_detail?: string | null
          job_no?: string | null
          logistics_note?: string | null
          machine_label?: string | null
          machine_unit_id?: string | null
          parts_categories?: string | null
          parts_note?: string | null
          parts_replaced?: string | null
          po_number?: string | null
          priority?: string | null
          quotation_items?: string | null
          quotation_required?: boolean
          result?: string | null
          return_time?: string | null
          safety_gear?: string | null
          sales_rep?: string | null
          serial_number?: string | null
          service_type?: string | null
          staff_name?: string | null
          status?: string
          updated_at?: string
          vehicle_plate?: string | null
          visit_date: string
          visit_time?: string | null
          work_order_id?: string | null
          work_types?: string | null
        }
        Update: {
          attachments?: string | null
          billing_note?: string | null
          billing_type?: string | null
          checklist?: Json | null
          close_note?: string | null
          closed_at?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          cust_id?: string | null
          customer_address?: string | null
          customer_name?: string | null
          customer_sn?: string | null
          depart_time?: string | null
          id?: string
          job_detail?: string | null
          job_no?: string | null
          logistics_note?: string | null
          machine_label?: string | null
          machine_unit_id?: string | null
          parts_categories?: string | null
          parts_note?: string | null
          parts_replaced?: string | null
          po_number?: string | null
          priority?: string | null
          quotation_items?: string | null
          quotation_required?: boolean
          result?: string | null
          return_time?: string | null
          safety_gear?: string | null
          sales_rep?: string | null
          serial_number?: string | null
          service_type?: string | null
          staff_name?: string | null
          status?: string
          updated_at?: string
          vehicle_plate?: string | null
          visit_date?: string
          visit_time?: string | null
          work_order_id?: string | null
          work_types?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointments_machine_unit_id_fkey"
            columns: ["machine_unit_id"]
            isOneToOne: false
            referencedRelation: "machine_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor: string
          changes: Json | null
          created_at: string
          id: string
          record_id: string | null
          summary: string | null
          table_name: string
        }
        Insert: {
          action: string
          actor?: string
          changes?: Json | null
          created_at?: string
          id?: string
          record_id?: string | null
          summary?: string | null
          table_name: string
        }
        Update: {
          action?: string
          actor?: string
          changes?: Json | null
          created_at?: string
          id?: string
          record_id?: string | null
          summary?: string | null
          table_name?: string
        }
        Relationships: []
      }
      brands: {
        Row: {
          created_at: string | null
          id: string
          logo_url: string | null
          name: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          logo_url?: string | null
          name: string
        }
        Update: {
          created_at?: string | null
          id?: string
          logo_url?: string | null
          name?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
          sort_order: number | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          sort_order?: number | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          sort_order?: number | null
        }
        Relationships: []
      }
      checklist_templates: {
        Row: {
          created_at: string
          id: string
          items: Json
          machine_types: string | null
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          items?: Json
          machine_types?: string | null
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          items?: Json
          machine_types?: string | null
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      compressor_models: {
        Row: {
          brand_id: string | null
          created_at: string | null
          description: string | null
          id: string
          name: string
          pump_type: string | null
        }
        Insert: {
          brand_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          pump_type?: string | null
        }
        Update: {
          brand_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          pump_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "compressor_models_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          created_at: string | null
          cust_id: string | null
          id: string
          line_contact: string | null
          line_id: string | null
          name: string
          note: string | null
          phone: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          cust_id?: string | null
          id?: string
          line_contact?: string | null
          line_id?: string | null
          name: string
          note?: string | null
          phone?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string | null
          cust_id?: string | null
          id?: string
          line_contact?: string | null
          line_id?: string | null
          name?: string
          note?: string | null
          phone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      machine_parts: {
        Row: {
          created_at: string | null
          hours_used: number | null
          id: string
          last_changed_at: string | null
          machine_unit_id: string | null
          note: string | null
          product_id: string | null
          quantity: number
          service_interval_hours: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          hours_used?: number | null
          id?: string
          last_changed_at?: string | null
          machine_unit_id?: string | null
          note?: string | null
          product_id?: string | null
          quantity?: number
          service_interval_hours?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          hours_used?: number | null
          id?: string
          last_changed_at?: string | null
          machine_unit_id?: string | null
          note?: string | null
          product_id?: string | null
          quantity?: number
          service_interval_hours?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "machine_parts_machine_unit_id_fkey"
            columns: ["machine_unit_id"]
            isOneToOne: false
            referencedRelation: "machine_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machine_parts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      machine_units: {
        Row: {
          address_line: string | null
          contract_service: boolean
          created_at: string | null
          customer_id: string | null
          customer_sn: string | null
          daily_hours: number | null
          data_complete: boolean
          district: string | null
          id: string
          install_date: string | null
          model_id: string | null
          note: string | null
          province: string | null
          seller: string | null
          serial_number: string
          site_name: string | null
          status: string | null
          updated_at: string | null
          warranty_end: string | null
        }
        Insert: {
          address_line?: string | null
          contract_service?: boolean
          created_at?: string | null
          customer_id?: string | null
          customer_sn?: string | null
          daily_hours?: number | null
          data_complete?: boolean
          district?: string | null
          id?: string
          install_date?: string | null
          model_id?: string | null
          note?: string | null
          province?: string | null
          seller?: string | null
          serial_number: string
          site_name?: string | null
          status?: string | null
          updated_at?: string | null
          warranty_end?: string | null
        }
        Update: {
          address_line?: string | null
          contract_service?: boolean
          created_at?: string | null
          customer_id?: string | null
          customer_sn?: string | null
          daily_hours?: number | null
          data_complete?: boolean
          district?: string | null
          id?: string
          install_date?: string | null
          model_id?: string | null
          note?: string | null
          province?: string | null
          seller?: string | null
          serial_number?: string
          site_name?: string | null
          status?: string | null
          updated_at?: string | null
          warranty_end?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "machine_units_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machine_units_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "compressor_models"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_logs: {
        Row: {
          appointment_id: string | null
          created_at: string
          done_date: string
          id: string
          job_detail: string | null
          machine_unit_id: string | null
          note: string | null
          result: string | null
          serial_number: string | null
          service_type: string | null
          updated_at: string
        }
        Insert: {
          appointment_id?: string | null
          created_at?: string
          done_date?: string
          id?: string
          job_detail?: string | null
          machine_unit_id?: string | null
          note?: string | null
          result?: string | null
          serial_number?: string | null
          service_type?: string | null
          updated_at?: string
        }
        Update: {
          appointment_id?: string | null
          created_at?: string
          done_date?: string
          id?: string
          job_detail?: string | null
          machine_unit_id?: string | null
          note?: string | null
          result?: string | null
          serial_number?: string | null
          service_type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_logs_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_logs_machine_unit_id_fkey"
            columns: ["machine_unit_id"]
            isOneToOne: false
            referencedRelation: "machine_units"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          dedupe_key: string | null
          id: string
          kind: string
          link: string | null
          read: boolean
          title: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          dedupe_key?: string | null
          id?: string
          kind: string
          link?: string | null
          read?: boolean
          title: string
        }
        Update: {
          body?: string | null
          created_at?: string
          dedupe_key?: string | null
          id?: string
          kind?: string
          link?: string | null
          read?: boolean
          title?: string
        }
        Relationships: []
      }
      part_bundle_items: {
        Row: {
          bundle_id: string | null
          created_at: string
          id: string
          product_id: string | null
          quantity: number
        }
        Insert: {
          bundle_id?: string | null
          created_at?: string
          id?: string
          product_id?: string | null
          quantity?: number
        }
        Update: {
          bundle_id?: string | null
          created_at?: string
          id?: string
          product_id?: string | null
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "part_bundle_items_bundle_id_fkey"
            columns: ["bundle_id"]
            isOneToOne: false
            referencedRelation: "part_bundles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "part_bundle_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      part_bundles: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          brand_id: string | null
          category_id: string | null
          created_at: string | null
          description: string | null
          id: string
          image_url: string | null
          model_id: string | null
          name: string
          part_number: string
          price: number | null
          service_interval_hours: number | null
          stock_quantity: number | null
          storage_location: string | null
          updated_at: string | null
        }
        Insert: {
          brand_id?: string | null
          category_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          model_id?: string | null
          name: string
          part_number: string
          price?: number | null
          service_interval_hours?: number | null
          stock_quantity?: number | null
          storage_location?: string | null
          updated_at?: string | null
        }
        Update: {
          brand_id?: string | null
          category_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          model_id?: string | null
          name?: string
          part_number?: string
          price?: number | null
          service_interval_hours?: number | null
          stock_quantity?: number | null
          storage_location?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "compressor_models"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_contacts: {
        Row: {
          active: boolean
          company: string | null
          created_at: string
          id: string
          kind: string
          line_contact: string | null
          line_id: string | null
          name: string
          note: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          company?: string | null
          created_at?: string
          id?: string
          kind?: string
          line_contact?: string | null
          line_id?: string | null
          name: string
          note?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          company?: string | null
          created_at?: string
          id?: string
          kind?: string
          line_contact?: string | null
          line_id?: string | null
          name?: string
          note?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      security_settings: {
        Row: {
          created_at: string
          id: string
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      service_staff: {
        Row: {
          active: boolean
          created_at: string
          id: string
          line_contact: string | null
          line_id: string | null
          name: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          line_contact?: string | null
          line_id?: string | null
          name: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          line_contact?: string | null
          line_id?: string | null
          name?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      staff_leave: {
        Row: {
          created_at: string
          id: string
          leave_date: string
          period: string
          staff_id: string | null
          staff_name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          leave_date: string
          period: string
          staff_id?: string | null
          staff_name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          leave_date?: string
          period?: string
          staff_id?: string | null
          staff_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_leave_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "service_staff"
            referencedColumns: ["id"]
          },
        ]
      }
      troubleshooting_issues: {
        Row: {
          ai_check_draft: string | null
          ai_fix_draft: string | null
          answered_at: string | null
          asked_by: string | null
          causes: string | null
          check_steps: string | null
          created_at: string
          fix_steps: string | null
          id: string
          keywords: string | null
          sort_order: number | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          ai_check_draft?: string | null
          ai_fix_draft?: string | null
          answered_at?: string | null
          asked_by?: string | null
          causes?: string | null
          check_steps?: string | null
          created_at?: string
          fix_steps?: string | null
          id?: string
          keywords?: string | null
          sort_order?: number | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          ai_check_draft?: string | null
          ai_fix_draft?: string | null
          answered_at?: string | null
          asked_by?: string | null
          causes?: string | null
          check_steps?: string | null
          created_at?: string
          fix_steps?: string | null
          id?: string
          keywords?: string | null
          sort_order?: number | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      vehicles: {
        Row: {
          active: boolean
          created_at: string
          id: string
          note: string | null
          plate: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          note?: string | null
          plate: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          note?: string | null
          plate?: string
          updated_at?: string
        }
        Relationships: []
      }
      work_orders: {
        Row: {
          admin_note: string | null
          approved_hidden: boolean
          attachments: string | null
          billing_note: string | null
          billing_type: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          cust_id: string | null
          customer_address: string | null
          customer_name: string
          customer_sn: string | null
          depart_time: string | null
          id: string
          job_detail: string | null
          job_no: string | null
          logistics_note: string | null
          machine_label: string | null
          po_number: string | null
          priority: string | null
          return_time: string | null
          safety_gear: string | null
          sales_rep: string | null
          serial_number: string | null
          service_type: string | null
          staff_name: string | null
          status: string
          updated_at: string
          vehicle_plate: string | null
          visit_date: string | null
          visit_time: string | null
          work_types: string | null
        }
        Insert: {
          admin_note?: string | null
          approved_hidden?: boolean
          attachments?: string | null
          billing_note?: string | null
          billing_type?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          cust_id?: string | null
          customer_address?: string | null
          customer_name: string
          customer_sn?: string | null
          depart_time?: string | null
          id?: string
          job_detail?: string | null
          job_no?: string | null
          logistics_note?: string | null
          machine_label?: string | null
          po_number?: string | null
          priority?: string | null
          return_time?: string | null
          safety_gear?: string | null
          sales_rep?: string | null
          serial_number?: string | null
          service_type?: string | null
          staff_name?: string | null
          status?: string
          updated_at?: string
          vehicle_plate?: string | null
          visit_date?: string | null
          visit_time?: string | null
          work_types?: string | null
        }
        Update: {
          admin_note?: string | null
          approved_hidden?: boolean
          attachments?: string | null
          billing_note?: string | null
          billing_type?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          cust_id?: string | null
          customer_address?: string | null
          customer_name?: string
          customer_sn?: string | null
          depart_time?: string | null
          id?: string
          job_detail?: string | null
          job_no?: string | null
          logistics_note?: string | null
          machine_label?: string | null
          po_number?: string | null
          priority?: string | null
          return_time?: string | null
          safety_gear?: string | null
          sales_rep?: string | null
          serial_number?: string | null
          service_type?: string | null
          staff_name?: string | null
          status?: string
          updated_at?: string
          vehicle_plate?: string | null
          visit_date?: string | null
          visit_time?: string | null
          work_types?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      replace_name_in_list: {
        Args: { _list: string; _new: string; _old: string }
        Returns: string
      }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
