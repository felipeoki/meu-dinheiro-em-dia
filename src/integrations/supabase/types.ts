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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      accounts: {
        Row: {
          ativo: boolean
          cor: string
          dia_fechamento: number | null
          dia_vencimento: number | null
          id: string
          limite: number | null
          nome: string
          ordem: number
          tipo: string
          user_id: string
        }
        Insert: {
          ativo?: boolean
          cor?: string
          dia_fechamento?: number | null
          dia_vencimento?: number | null
          id?: string
          limite?: number | null
          nome: string
          ordem?: number
          tipo?: string
          user_id?: string
        }
        Update: {
          ativo?: boolean
          cor?: string
          dia_fechamento?: number | null
          dia_vencimento?: number | null
          id?: string
          limite?: number | null
          nome?: string
          ordem?: number
          tipo?: string
          user_id?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          cor: string
          created_at: string
          icone: string
          id: string
          nome: string
          orcamento_mensal: number | null
          user_id: string
        }
        Insert: {
          cor?: string
          created_at?: string
          icone?: string
          id?: string
          nome: string
          orcamento_mensal?: number | null
          user_id?: string
        }
        Update: {
          cor?: string
          created_at?: string
          icone?: string
          id?: string
          nome?: string
          orcamento_mensal?: number | null
          user_id?: string
        }
        Relationships: []
      }
      cdi_rates: {
        Row: {
          atualizado_em: string
          fonte: string
          id: string
          referencia: string
          taxa_anual: number
        }
        Insert: {
          atualizado_em?: string
          fonte: string
          id?: string
          referencia: string
          taxa_anual: number
        }
        Update: {
          atualizado_em?: string
          fonte?: string
          id?: string
          referencia?: string
          taxa_anual?: number
        }
        Relationships: []
      }
      investment_contributions: {
        Row: {
          created_at: string
          data: string
          id: string
          investment_id: string
          observacao: string | null
          user_id: string
          valor: number
        }
        Insert: {
          created_at?: string
          data: string
          id?: string
          investment_id: string
          observacao?: string | null
          user_id?: string
          valor: number
        }
        Update: {
          created_at?: string
          data?: string
          id?: string
          investment_id?: string
          observacao?: string | null
          user_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "investment_contributions_investment_id_fkey"
            columns: ["investment_id"]
            isOneToOne: false
            referencedRelation: "investments"
            referencedColumns: ["id"]
          },
        ]
      }
      investments: {
        Row: {
          aporte_mensal: number
          ativo: boolean
          capitalizacao: string
          cor: string
          created_at: string
          data_inicio: string
          horizonte_anos: number
          id: string
          nome: string
          percentual_cdi: number | null
          taxa_anual: number | null
          tipo_taxa: string
          user_id: string
          valor_inicial: number
        }
        Insert: {
          aporte_mensal?: number
          ativo?: boolean
          capitalizacao?: string
          cor?: string
          created_at?: string
          data_inicio: string
          horizonte_anos?: number
          id?: string
          nome: string
          percentual_cdi?: number | null
          taxa_anual?: number | null
          tipo_taxa: string
          user_id?: string
          valor_inicial?: number
        }
        Update: {
          aporte_mensal?: number
          ativo?: boolean
          capitalizacao?: string
          cor?: string
          created_at?: string
          data_inicio?: string
          horizonte_anos?: number
          id?: string
          nome?: string
          percentual_cdi?: number | null
          taxa_anual?: number | null
          tipo_taxa?: string
          user_id?: string
          valor_inicial?: number
        }
        Relationships: []
      }
      notes: {
        Row: {
          created_at: string
          id: string
          mes: string | null
          texto: string
          titulo: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          mes?: string | null
          texto?: string
          titulo?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          mes?: string | null
          texto?: string
          titulo?: string
          user_id?: string
        }
        Relationships: []
      }
      provisions: {
        Row: {
          enviado_em: string
          id: string
          observacao: string | null
          pago_em: string | null
          status: string
          transaction_id: string
          user_id: string
          valor_pago: number | null
          valor_provisionado: number
        }
        Insert: {
          enviado_em?: string
          id?: string
          observacao?: string | null
          pago_em?: string | null
          status?: string
          transaction_id: string
          user_id?: string
          valor_pago?: number | null
          valor_provisionado: number
        }
        Update: {
          enviado_em?: string
          id?: string
          observacao?: string | null
          pago_em?: string | null
          status?: string
          transaction_id?: string
          user_id?: string
          valor_pago?: number | null
          valor_provisionado?: number
        }
        Relationships: [
          {
            foreignKeyName: "provisions_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: true
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          dia_corte_ciclo: number
          dia_fechamento_cartao: number
          lazer_por_ciclo: number
          orcamento_mercado: number
          user_id: string
        }
        Insert: {
          dia_corte_ciclo?: number
          dia_fechamento_cartao?: number
          lazer_por_ciclo?: number
          orcamento_mercado?: number
          user_id?: string
        }
        Update: {
          dia_corte_ciclo?: number
          dia_fechamento_cartao?: number
          lazer_por_ciclo?: number
          orcamento_mercado?: number
          user_id?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          bonificacao: boolean
          categoria_id: string | null
          ciclo: number | null
          conta_id: string | null
          created_at: string
          data_pagamento: string | null
          data_vencimento: string
          descricao: string
          encerrada: boolean
          forma_pagamento: string
          grupo_id: string | null
          id: string
          nao_contabilizar: boolean
          observacoes: string | null
          pago: boolean
          parcela_atual: number | null
          parcelas_total: number | null
          recebido: boolean
          recebido_em: string | null
          recorrencia: string
          reembolso_de: string | null
          tipo: string
          user_id: string
          valor: number
        }
        Insert: {
          bonificacao?: boolean
          categoria_id?: string | null
          ciclo?: number | null
          conta_id?: string | null
          created_at?: string
          data_pagamento?: string | null
          data_vencimento: string
          descricao?: string
          encerrada?: boolean
          forma_pagamento?: string
          grupo_id?: string | null
          id?: string
          nao_contabilizar?: boolean
          observacoes?: string | null
          pago?: boolean
          parcela_atual?: number | null
          parcelas_total?: number | null
          recebido?: boolean
          recebido_em?: string | null
          recorrencia?: string
          reembolso_de?: string | null
          tipo: string
          user_id?: string
          valor?: number
        }
        Update: {
          bonificacao?: boolean
          categoria_id?: string | null
          ciclo?: number | null
          conta_id?: string | null
          created_at?: string
          data_pagamento?: string | null
          data_vencimento?: string
          descricao?: string
          encerrada?: boolean
          forma_pagamento?: string
          grupo_id?: string | null
          id?: string
          nao_contabilizar?: boolean
          observacoes?: string | null
          pago?: boolean
          parcela_atual?: number | null
          parcelas_total?: number | null
          recebido?: boolean
          recebido_em?: string | null
          recorrencia?: string
          reembolso_de?: string | null
          tipo?: string
          user_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "transactions_account_owner"
            columns: ["conta_id", "user_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "transactions_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _seed_series: {
        Args: {
          p_bonus?: boolean
          p_cat: string
          p_ciclo?: number
          p_day: number
          p_desc: string
          p_forma: string
          p_n: number
          p_rec: string
          p_tipo: string
          p_valor: number
          uid: string
        }
        Returns: undefined
      }
      carregar_dados_planilha: { Args: { uid: string }; Returns: undefined }
      ensure_fixed: { Args: { p_until: string }; Returns: undefined }
      month_day: { Args: { d: number; m: string }; Returns: string }
      pay_provisions: {
        Args: { p_date: string; p_items: Json }
        Returns: undefined
      }
      provision_transactions: { Args: { p_items: Json }; Returns: Json }
      seed_user: { Args: { uid: string }; Returns: undefined }
      undo_provision_payment: { Args: { p_id: string }; Returns: undefined }
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
