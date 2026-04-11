export type TransactionType = "income" | "expense" | "saving";
export type PaymentMethodType =
  | "cash"
  | "debit_card"
  | "credit_card"
  | "bank_transfer"
  | "other";
export type WorkspaceRole = "owner" | "admin" | "member";
export type SavingsRateMode = "manual" | "percentage";
export type BudgetPeriodStatus = "draft" | "active" | "closed";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          email?: string;
          full_name?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      workspaces: {
        Row: {
          id: string;
          name: string;
          slug: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug?: string | null;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          slug?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      workspace_members: {
        Row: {
          id: string;
          workspace_id: string;
          user_id: string;
          role: WorkspaceRole;
          created_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          user_id: string;
          role: WorkspaceRole;
          created_at?: string;
        };
        Update: {
          role?: WorkspaceRole;
        };
        Relationships: [];
      };
      workspace_settings: {
        Row: {
          id: string;
          workspace_id: string;
          start_year: number;
          savings_rate_mode: SavingsRateMode;
          deferred_income_enabled: boolean;
          deferred_income_day: number | null;
          currency_code: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          start_year: number;
          savings_rate_mode: SavingsRateMode;
          deferred_income_enabled?: boolean;
          deferred_income_day?: number | null;
          currency_code?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          start_year?: number;
          savings_rate_mode?: SavingsRateMode;
          deferred_income_enabled?: boolean;
          deferred_income_day?: number | null;
          currency_code?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      categories: {
        Row: {
          id: string;
          workspace_id: string;
          name: string;
          type: TransactionType;
          is_active: boolean;
          sort_order: number | null;
          color: string | null;
          icon: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          name: string;
          type: TransactionType;
          is_active?: boolean;
          sort_order?: number | null;
          color?: string | null;
          icon?: string | null;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          type?: TransactionType;
          is_active?: boolean;
          sort_order?: number | null;
          color?: string | null;
          icon?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      payment_methods: {
        Row: {
          id: string;
          workspace_id: string;
          name: string;
          type: PaymentMethodType;
          is_active: boolean;
          closing_day: number | null;
          due_day: number | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          name: string;
          type: PaymentMethodType;
          is_active?: boolean;
          closing_day?: number | null;
          due_day?: number | null;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          type?: PaymentMethodType;
          is_active?: boolean;
          closing_day?: number | null;
          due_day?: number | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      budget_periods: {
        Row: {
          id: string;
          workspace_id: string;
          year: number;
          month: number;
          status: BudgetPeriodStatus;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          year: number;
          month: number;
          status?: BudgetPeriodStatus;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          year?: number;
          month?: number;
          status?: BudgetPeriodStatus;
          updated_at?: string;
        };
        Relationships: [];
      };
      budget_items: {
        Row: {
          id: string;
          budget_period_id: string;
          category_id: string;
          amount: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          budget_period_id: string;
          category_id: string;
          amount: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          amount?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      transactions: {
        Row: {
          id: string;
          workspace_id: string;
          transaction_date: string;
          effective_date: string | null;
          type: TransactionType;
          category_id: string;
          payment_method_id: string | null;
          amount: number;
          description: string | null;
          notes: string | null;
          is_recurring: boolean;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          transaction_date: string;
          effective_date?: string | null;
          type: TransactionType;
          category_id: string;
          payment_method_id?: string | null;
          amount: number;
          description?: string | null;
          notes?: string | null;
          is_recurring?: boolean;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          transaction_date?: string;
          effective_date?: string | null;
          type?: TransactionType;
          category_id?: string;
          payment_method_id?: string | null;
          amount?: number;
          description?: string | null;
          notes?: string | null;
          is_recurring?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
