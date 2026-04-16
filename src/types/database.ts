export type TransactionType = "income" | "expense" | "saving" | "transfer";
export type PaymentMethodType =
  | "cash"
  | "debit_card"
  | "credit_card"
  | "bank_transfer"
  | "other";
export type ExpenseBehavior = "fixed" | "variable";
export type WorkspaceRole = "owner" | "member";
export type SavingsRateMode = "manual" | "percentage";
export type BudgetPeriodStatus = "draft" | "active" | "closed";
export type SubscriptionPlan = "free" | "pro" | "premium";
export type SubscriptionStatus = "active" | "canceled" | "past_due";
export type WorkspaceLinkVisibilityMode = "summary_only";
export type FeedbackType = "bug" | "suggestion" | "question" | "other";
export type FeedbackStatus = "new" | "reviewed" | "closed";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          preferred_language: "es" | "en" | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          preferred_language?: "es" | "en" | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          email?: string;
          full_name?: string | null;
          preferred_language?: "es" | "en" | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      workspaces: {
        Row: {
          id: string;
          name: string;
          slug: string;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          slug?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      subscriptions: {
        Row: {
          id: string;
          workspace_id: string;
          plan: SubscriptionPlan;
          status: SubscriptionStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          plan?: SubscriptionPlan;
          status?: SubscriptionStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          plan?: SubscriptionPlan;
          status?: SubscriptionStatus;
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
          show_cents: boolean;
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
          show_cents?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          start_year?: number;
          savings_rate_mode?: SavingsRateMode;
          deferred_income_enabled?: boolean;
          deferred_income_day?: number | null;
          currency_code?: string;
          show_cents?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      workspace_links: {
        Row: {
          id: string;
          source_workspace_id: string;
          target_workspace_id: string;
          visibility_mode: WorkspaceLinkVisibilityMode;
          is_active: boolean;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          source_workspace_id: string;
          target_workspace_id: string;
          visibility_mode?: WorkspaceLinkVisibilityMode;
          is_active?: boolean;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          source_workspace_id?: string;
          target_workspace_id?: string;
          visibility_mode?: WorkspaceLinkVisibilityMode;
          is_active?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      feedback: {
        Row: {
          id: string;
          user_id: string;
          workspace_id: string | null;
          type: FeedbackType;
          message: string;
          route: string | null;
          status: FeedbackStatus;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          workspace_id?: string | null;
          type: FeedbackType;
          message: string;
          route?: string | null;
          status?: FeedbackStatus;
          created_at?: string;
        };
        Update: {
          workspace_id?: string | null;
          type?: FeedbackType;
          message?: string;
          route?: string | null;
          status?: FeedbackStatus;
        };
        Relationships: [];
      };
      categories: {
        Row: {
          id: string;
          workspace_id: string;
          name: string;
          type: TransactionType;
          expense_behavior: ExpenseBehavior | null;
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
          expense_behavior?: ExpenseBehavior | null;
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
          expense_behavior?: ExpenseBehavior | null;
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
          current_balance: number;
          include_in_balance: boolean;
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
          current_balance?: number;
          include_in_balance?: boolean;
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
          current_balance?: number;
          include_in_balance?: boolean;
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
          transfer_group_id: string | null;
          direction: "in" | "out" | null;
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
          transfer_group_id?: string | null;
          direction?: "in" | "out" | null;
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
          transfer_group_id?: string | null;
          direction?: "in" | "out" | null;
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
      create_workspace_with_defaults: {
        Args: {
          p_workspace_name: string;
        };
        Returns: {
          workspace_id: string;
          workspace_name: string;
          workspace_slug: string;
          workspace_role: WorkspaceRole;
          subscription_plan: SubscriptionPlan;
          subscription_status: SubscriptionStatus;
        }[];
      };
      create_workspace_link: {
        Args: {
          p_source_workspace_id: string;
          p_target_workspace_id: string;
          p_visibility_mode?: WorkspaceLinkVisibilityMode;
        };
        Returns: {
          link_id: string;
          source_workspace_id: string;
          target_workspace_id: string;
          target_workspace_name: string | null;
          target_workspace_slug: string | null;
          target_currency_code: string | null;
          visibility_mode: WorkspaceLinkVisibilityMode;
          is_active: boolean;
          has_target_access: boolean;
          created_by: string;
          created_at: string;
          updated_at: string;
        }[];
      };
      deactivate_workspace_link: {
        Args: {
          p_source_workspace_id: string;
          p_link_id: string;
        };
        Returns: {
          link_id: string;
          source_workspace_id: string;
          target_workspace_id: string;
          target_workspace_name: string | null;
          target_workspace_slug: string | null;
          target_currency_code: string | null;
          visibility_mode: WorkspaceLinkVisibilityMode;
          is_active: boolean;
          has_target_access: boolean;
          created_by: string;
          created_at: string;
          updated_at: string;
        }[];
      };
      delete_workspace: {
        Args: {
          p_workspace_id: string;
        };
        Returns: {
          deleted_workspace_id: string;
          deleted_workspace_slug: string;
        }[];
      };
      leave_workspace: {
        Args: {
          p_workspace_id: string;
        };
        Returns: {
          left_workspace_id: string;
          left_workspace_slug: string;
        }[];
      };
      invite_workspace_member_by_email: {
        Args: {
          p_workspace_id: string;
          p_email: string;
        };
        Returns: {
          member_id: string;
          user_id: string;
          email: string;
          full_name: string | null;
          role: WorkspaceRole;
          joined_at: string;
          was_created: boolean;
        }[];
      };
      list_linked_workspace_summaries: {
        Args: {
          p_source_workspace_id: string;
          p_year: number;
          p_month: number;
        };
        Returns: {
          link_id: string;
          source_workspace_id: string;
          target_workspace_id: string;
          target_workspace_name: string;
          target_workspace_slug: string;
          target_currency_code: string;
          visibility_mode: WorkspaceLinkVisibilityMode;
          period_year: number;
          period_month: number;
          income_total: number;
          expense_total: number;
          saving_total: number;
          balance_total: number;
        }[];
      };
      list_linked_workspace_payment_method_balances: {
        Args: {
          p_source_workspace_id: string;
        };
        Returns: {
          link_id: string;
          target_workspace_id: string;
          target_workspace_name: string;
          target_currency_code: string | null;
          visibility_mode: string;
          payment_method_id: string;
          payment_method_name: string;
          payment_method_type: PaymentMethodType;
          payment_method_balance: number;
          workspace_total_balance: number;
        }[];
      };
      list_workspace_links: {
        Args: {
          p_source_workspace_id: string;
        };
        Returns: {
          link_id: string;
          source_workspace_id: string;
          target_workspace_id: string;
          target_workspace_name: string | null;
          target_workspace_slug: string | null;
          target_currency_code: string | null;
          visibility_mode: WorkspaceLinkVisibilityMode;
          is_active: boolean;
          has_target_access: boolean;
          created_by: string;
          created_at: string;
          updated_at: string;
        }[];
      };
      list_workspace_members: {
        Args: {
          p_workspace_id: string;
        };
        Returns: {
          member_id: string;
          user_id: string;
          email: string;
          full_name: string | null;
          role: WorkspaceRole;
          joined_at: string;
        }[];
      };
      remove_workspace_member: {
        Args: {
          p_workspace_id: string;
          p_member_user_id: string;
        };
        Returns: {
          member_id: string;
          user_id: string;
          email: string;
          full_name: string | null;
          role: WorkspaceRole;
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
