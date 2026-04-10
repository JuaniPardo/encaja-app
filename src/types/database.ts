export type TransactionType = "income" | "expense" | "saving";
export type PaymentMethodType =
  | "cash"
  | "debit_card"
  | "credit_card"
  | "bank_transfer"
  | "other";
export type WorkspaceRole = "owner" | "admin" | "member";
export type SavingsRateMode = "manual" | "percentage";

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
      };
    };
  };
}
