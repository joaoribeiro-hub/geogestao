export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRole = "admin" | "gerente" | "tecnico" | "financeiro" | "leitura";
export type OrganizationRole = "owner" | "admin" | "gerente" | "tecnico" | "financeiro" | "leitura";
export type OrganizationStatus = "active" | "trialing" | "suspended" | "canceled";
export type OrganizationMemberStatus = "active" | "invited" | "suspended";
export type ProfileOnboardingStatus = "pending_organization" | "complete";
export type OrganizationJoinCodeStatus = "active" | "revoked";
export type SubscriptionStatus = "active" | "trialing" | "past_due" | "canceled" | "expired";
export type BillingInterval = "monthly" | "quarterly" | "yearly";
export type BillingOrderStatus = "draft" | "pending" | "paid" | "canceled" | "expired";
export type WorkScheduleType = "5x2" | "6x1" | "custom";
export type WorkTimeDayStatus = "active" | "paused_interval" | "field_mode" | "safety_frozen" | "closed";
export type WorkTimeSessionMode = "work" | "interval" | "field" | "frozen";
export type WorkTimeSessionEndReason =
  | "user_interval"
  | "user_returned"
  | "page_closed"
  | "safety_timeout"
  | "midnight"
  | "manual"
  | "field_started"
  | "field_ended";
export type CompanyHolidayType = "national" | "optional_point" | "company" | "state" | "municipal";
export type UserIntegrationProvider = "google_drive" | "google_calendar";
export type UserIntegrationStatus = "active" | "disconnected" | "needs_reauthorization" | "error";
export type CalendarSyncStatus = "pending" | "synced" | "error" | "skipped" | "deleted";
export type AiAgentRunStatus = "pending" | "running" | "completed" | "error";
export type ReminderNotificationPreference = "due" | "10m" | "1h" | "none";
export type ClientKind = "pf" | "pj";
export type InteractionType = "ligacao" | "email" | "reuniao" | "whatsapp" | "nota";
export type ProposalStage =
  | "todo"
  | "sent"
  | "negotiation"
  | "execution"
  | "finished"
  | "lost";
export type ProposalServiceType =
  | "georreferenciamento"
  | "car"
  | "itr_ccir"
  | "outros_servicos";
export type PaymentStatus = "pagamento_nao_efetuado" | "pagamento_efetuado";
export type Priority = "low" | "medium" | "high" | "urgent";
export type FinanceStatus = "pending" | "paid" | "overdue";
export type DocumentStatus = "vigente" | "obsoleto";
export type LegislationStatus = "vigente" | "revogado" | "atencao";
export type GeoDataSourceType = "car" | "incra" | "alerta" | "tematica";
export type GeoImportStatus = "pending" | "imported" | "failed";
export type PropertySearchStatus = "found" | "not_found" | "partial" | "failed";
export type PropertySearchResultType =
  | "car"
  | "incra"
  | "alerta"
  | "tematica"
  | "documento"
  | "download";
export type PropertyDocumentStatus = "available" | "pending" | "failed" | "archived";
export type ContractStatus =
  | "contrato_a_gerar"
  | "contrato_gerado"
  | "enviado_para_assinatura"
  | "assinado"
  | "em_execucao"
  | "finalizado"
  | "cancelado";
export type AttachmentEntityType =
  | "profile"
  | "client"
  | "proposal"
  | "service_card"
  | "contract"
  | "revenue"
  | "expense"
  | "document_template"
  | "legislation_item";

type BaseRow = {
  id: string;
  created_at: string;
  updated_at?: string | null;
};

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string | null;
          cpf: string | null;
          organization_id: string | null;
          full_name: string | null;
          phone: string | null;
          birth_date: string | null;
          document_type: string | null;
          document_number: string | null;
          avatar_path: string | null;
          email_preferences: Json;
          account_preferences: Json;
          role: UserRole;
          onboarding_status: ProfileOnboardingStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          cpf?: string | null;
          organization_id?: string | null;
          full_name?: string | null;
          phone?: string | null;
          birth_date?: string | null;
          document_type?: string | null;
          document_number?: string | null;
          avatar_path?: string | null;
          email_preferences?: Json;
          account_preferences?: Json;
          role?: UserRole;
          onboarding_status?: ProfileOnboardingStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          email?: string | null;
          cpf?: string | null;
          organization_id?: string | null;
          full_name?: string | null;
          phone?: string | null;
          birth_date?: string | null;
          document_type?: string | null;
          document_number?: string | null;
          avatar_path?: string | null;
          email_preferences?: Json;
          account_preferences?: Json;
          role?: UserRole;
          onboarding_status?: ProfileOnboardingStatus;
          updated_at?: string;
        };
        Relationships: [];
      };
      plans: {
        Row: {
          id: string;
          name: string;
          slug: string;
          description: string | null;
          price_monthly: number;
          price_monthly_cents: number;
          max_users: number;
          storage_quota_mb: number;
          storage_limit_mb: number | null;
          max_proposals_per_month: number | null;
          max_contracts_per_month: number | null;
          max_finance_records_per_month: number | null;
          ai_enabled: boolean;
          features: Json;
          is_active: boolean;
          is_public: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          description?: string | null;
          price_monthly?: number;
          price_monthly_cents?: number;
          max_users?: number;
          storage_quota_mb?: number;
          storage_limit_mb?: number | null;
          max_proposals_per_month?: number | null;
          max_contracts_per_month?: number | null;
          max_finance_records_per_month?: number | null;
          ai_enabled?: boolean;
          features?: Json;
          is_active?: boolean;
          is_public?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          slug?: string;
          description?: string | null;
          price_monthly?: number;
          price_monthly_cents?: number;
          max_users?: number;
          storage_quota_mb?: number;
          storage_limit_mb?: number | null;
          max_proposals_per_month?: number | null;
          max_contracts_per_month?: number | null;
          max_finance_records_per_month?: number | null;
          ai_enabled?: boolean;
          features?: Json;
          is_active?: boolean;
          is_public?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      organizations: {
        Row: BaseRow & {
          name: string;
          slug: string | null;
          trade_name: string | null;
          document_number: string | null;
          owner_user_id: string | null;
          plan_id: string | null;
          storage_quota_mb: number;
          storage_quota_bytes: number;
          storage_used_bytes: number;
          storage_reserved_bytes: number;
          status: OrganizationStatus;
        };
        Insert: {
          id?: string;
          name: string;
          slug?: string | null;
          trade_name?: string | null;
          document_number?: string | null;
          owner_user_id?: string | null;
          plan_id?: string | null;
          storage_quota_mb?: number;
          storage_quota_bytes?: number;
          storage_used_bytes?: number;
          storage_reserved_bytes?: number;
          status?: OrganizationStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          slug?: string | null;
          trade_name?: string | null;
          document_number?: string | null;
          owner_user_id?: string | null;
          plan_id?: string | null;
          storage_quota_mb?: number;
          storage_quota_bytes?: number;
          storage_used_bytes?: number;
          storage_reserved_bytes?: number;
          status?: OrganizationStatus;
          updated_at?: string;
        };
        Relationships: [];
      };
      organization_members: {
        Row: {
          id: string;
          organization_id: string;
          user_id: string;
          role: OrganizationRole;
          status: OrganizationMemberStatus;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          user_id: string;
          role?: OrganizationRole;
          status?: OrganizationMemberStatus;
          created_at?: string;
        };
        Update: {
          organization_id?: string;
          user_id?: string;
          role?: OrganizationRole;
          status?: OrganizationMemberStatus;
        };
        Relationships: [];
      };
      organization_join_codes: {
        Row: {
          id: string;
          organization_id: string;
          code: string;
          status: OrganizationJoinCodeStatus;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          code: string;
          status?: OrganizationJoinCodeStatus;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          organization_id?: string;
          code?: string;
          status?: OrganizationJoinCodeStatus;
          created_by?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      organization_subscriptions: {
        Row: {
          id: string;
          organization_id: string;
          plan_id: string;
          status: SubscriptionStatus;
          current_period_start: string | null;
          current_period_end: string | null;
          billing_interval: BillingInterval;
          provider: string | null;
          provider_subscription_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          plan_id: string;
          status?: SubscriptionStatus;
          current_period_start?: string | null;
          current_period_end?: string | null;
          billing_interval?: BillingInterval;
          provider?: string | null;
          provider_subscription_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          organization_id?: string;
          plan_id?: string;
          status?: SubscriptionStatus;
          current_period_start?: string | null;
          current_period_end?: string | null;
          billing_interval?: BillingInterval;
          provider?: string | null;
          provider_subscription_id?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      billing_orders: {
        Row: {
          id: string;
          organization_id: string;
          plan_id: string;
          amount_cents: number;
          billing_period_months: number;
          status: BillingOrderStatus;
          provider: string | null;
          provider_checkout_url: string | null;
          provider_payment_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          plan_id: string;
          amount_cents?: number;
          billing_period_months?: number;
          status?: BillingOrderStatus;
          provider?: string | null;
          provider_checkout_url?: string | null;
          provider_payment_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          organization_id?: string;
          plan_id?: string;
          amount_cents?: number;
          billing_period_months?: number;
          status?: BillingOrderStatus;
          provider?: string | null;
          provider_checkout_url?: string | null;
          provider_payment_id?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      clients: {
        Row: BaseRow & {
          organization_id: string | null;
          kind: ClientKind;
          name: string;
          document: string | null;
          email: string | null;
          phone: string | null;
          address: string | null;
          notes: string | null;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          organization_id?: string | null;
          kind: ClientKind;
          name: string;
          document?: string | null;
          email?: string | null;
          phone?: string | null;
          address?: string | null;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          kind?: ClientKind;
          organization_id?: string | null;
          name?: string;
          document?: string | null;
          email?: string | null;
          phone?: string | null;
          address?: string | null;
          notes?: string | null;
          created_by?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      client_interactions: {
        Row: {
          id: string;
          organization_id: string | null;
          client_id: string;
          type: InteractionType;
          occurred_at: string;
          responsible_id: string | null;
          description: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id?: string | null;
          client_id: string;
          type: InteractionType;
          occurred_at?: string;
          responsible_id?: string | null;
          description: string;
          created_at?: string;
        };
        Update: {
          client_id?: string;
          organization_id?: string | null;
          type?: InteractionType;
          occurred_at?: string;
          responsible_id?: string | null;
          description?: string;
        };
        Relationships: [];
      };
      company_settings: {
        Row: BaseRow & {
          organization_id: string | null;
          singleton_key: string;
          trade_name: string | null;
          legal_name: string | null;
          cnpj: string | null;
          phone: string | null;
          email: string | null;
          website: string | null;
          address: string | null;
          city: string | null;
          state: string | null;
          logo_url: string | null;
          notes: string | null;
          bank_name: string | null;
          bank_agency: string | null;
          bank_account: string | null;
          bank_account_type: string | null;
          pix_key: string | null;
          bank_account_holder: string | null;
          bank_holder_document: string | null;
          bank_notes: string | null;
          payment_instructions: string | null;
          mission: string | null;
          vision: string | null;
          values_statement: string | null;
        };
        Insert: {
          id?: string;
          organization_id?: string | null;
          singleton_key?: string;
          trade_name?: string | null;
          legal_name?: string | null;
          cnpj?: string | null;
          phone?: string | null;
          email?: string | null;
          website?: string | null;
          address?: string | null;
          city?: string | null;
          state?: string | null;
          logo_url?: string | null;
          notes?: string | null;
          bank_name?: string | null;
          bank_agency?: string | null;
          bank_account?: string | null;
          bank_account_type?: string | null;
          pix_key?: string | null;
          bank_account_holder?: string | null;
          bank_holder_document?: string | null;
          bank_notes?: string | null;
          payment_instructions?: string | null;
          mission?: string | null;
          vision?: string | null;
          values_statement?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          singleton_key?: string;
          organization_id?: string | null;
          trade_name?: string | null;
          legal_name?: string | null;
          cnpj?: string | null;
          phone?: string | null;
          email?: string | null;
          website?: string | null;
          address?: string | null;
          city?: string | null;
          state?: string | null;
          logo_url?: string | null;
          notes?: string | null;
          bank_name?: string | null;
          bank_agency?: string | null;
          bank_account?: string | null;
          bank_account_type?: string | null;
          pix_key?: string | null;
          bank_account_holder?: string | null;
          bank_holder_document?: string | null;
          bank_notes?: string | null;
          payment_instructions?: string | null;
          mission?: string | null;
          vision?: string | null;
          values_statement?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      company_services: {
        Row: BaseRow & {
          organization_id: string | null;
          niche: string;
          name: string;
          base_price: number | null;
          billing_unit: string | null;
          description: string | null;
          is_active: boolean;
        };
        Insert: {
          id?: string;
          organization_id?: string | null;
          niche: string;
          name: string;
          base_price?: number | null;
          billing_unit?: string | null;
          description?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          niche?: string;
          organization_id?: string | null;
          name?: string;
          base_price?: number | null;
          billing_unit?: string | null;
          description?: string | null;
          is_active?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      properties: {
        Row: BaseRow & {
          organization_id: string | null;
          client_id: string;
          service_card_id: string | null;
          name: string;
          area: number | null;
          registry_number: string | null;
          registry_date: string | null;
          car_state: string | null;
          car_federal: string | null;
          city: string | null;
          state: string | null;
          notes: string | null;
        };
        Insert: {
          id?: string;
          organization_id?: string | null;
          client_id: string;
          service_card_id?: string | null;
          name: string;
          area?: number | null;
          registry_number?: string | null;
          registry_date?: string | null;
          car_state?: string | null;
          car_federal?: string | null;
          city?: string | null;
          state?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          client_id?: string;
          organization_id?: string | null;
          service_card_id?: string | null;
          name?: string;
          area?: number | null;
          registry_number?: string | null;
          registry_date?: string | null;
          car_state?: string | null;
          car_federal?: string | null;
          city?: string | null;
          state?: string | null;
          notes?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      property_geometries: {
        Row: {
          id: string;
          organization_id: string | null;
          property_id: string;
          client_id: string;
          service_card_id: string | null;
          file_path: string;
          file_name: string;
          mime_type: string | null;
          size_bytes: number | null;
          geojson: Json;
          uploaded_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id?: string | null;
          property_id: string;
          client_id: string;
          service_card_id?: string | null;
          file_path: string;
          file_name: string;
          mime_type?: string | null;
          size_bytes?: number | null;
          geojson: Json;
          uploaded_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          property_id?: string;
          organization_id?: string | null;
          client_id?: string;
          service_card_id?: string | null;
          file_path?: string;
          file_name?: string;
          mime_type?: string | null;
          size_bytes?: number | null;
          geojson?: Json;
          uploaded_by?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      geo_data_sources: {
        Row: {
          id: string;
          organization_id: string | null;
          source_type: GeoDataSourceType;
          name: string;
          provider: string | null;
          reference_year: string | null;
          reference_date: string | null;
          drive_folder_id: string | null;
          drive_file_id: string | null;
          original_file_name: string | null;
          original_file_path: string | null;
          storage_path: string | null;
          imported_at: string | null;
          imported_by: string | null;
          status: GeoImportStatus;
          error_message: string | null;
          record_count: number;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id?: string | null;
          source_type: GeoDataSourceType;
          name: string;
          provider?: string | null;
          reference_year?: string | null;
          reference_date?: string | null;
          drive_folder_id?: string | null;
          drive_file_id?: string | null;
          original_file_name?: string | null;
          original_file_path?: string | null;
          storage_path?: string | null;
          imported_at?: string | null;
          imported_by?: string | null;
          status?: GeoImportStatus;
          error_message?: string | null;
          record_count?: number;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          organization_id?: string | null;
          source_type?: GeoDataSourceType;
          name?: string;
          provider?: string | null;
          reference_year?: string | null;
          reference_date?: string | null;
          drive_folder_id?: string | null;
          drive_file_id?: string | null;
          original_file_name?: string | null;
          original_file_path?: string | null;
          storage_path?: string | null;
          imported_at?: string | null;
          imported_by?: string | null;
          status?: GeoImportStatus;
          error_message?: string | null;
          record_count?: number;
          metadata?: Json;
        };
        Relationships: [];
      };
      car_properties: {
        Row: BaseRow & {
          organization_id: string | null;
          cod_car: string;
          uf: string | null;
          municipio: string | null;
          area_ha: number | null;
          status_car: string | null;
          data_inscricao: string | null;
          data_atualizacao: string | null;
          attributes: Json;
          geom_geojson: Json | null;
          bbox: Json | null;
          source_id: string | null;
        };
        Insert: {
          id?: string;
          organization_id?: string | null;
          cod_car: string;
          uf?: string | null;
          municipio?: string | null;
          area_ha?: number | null;
          status_car?: string | null;
          data_inscricao?: string | null;
          data_atualizacao?: string | null;
          attributes?: Json;
          geom_geojson?: Json | null;
          bbox?: Json | null;
          source_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          organization_id?: string | null;
          cod_car?: string;
          uf?: string | null;
          municipio?: string | null;
          area_ha?: number | null;
          status_car?: string | null;
          data_inscricao?: string | null;
          data_atualizacao?: string | null;
          attributes?: Json;
          geom_geojson?: Json | null;
          bbox?: Json | null;
          source_id?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      incra_properties: {
        Row: BaseRow & {
          organization_id: string | null;
          sigef_code: string | null;
          cnir: string | null;
          codigo_imovel: string | null;
          certificacao: string | null;
          situacao: string | null;
          municipio: string | null;
          uf: string | null;
          area_ha: number | null;
          data_certificacao: string | null;
          attributes: Json;
          geom_geojson: Json | null;
          bbox: Json | null;
          source_id: string | null;
        };
        Insert: {
          id?: string;
          organization_id?: string | null;
          sigef_code?: string | null;
          cnir?: string | null;
          codigo_imovel?: string | null;
          certificacao?: string | null;
          situacao?: string | null;
          municipio?: string | null;
          uf?: string | null;
          area_ha?: number | null;
          data_certificacao?: string | null;
          attributes?: Json;
          geom_geojson?: Json | null;
          bbox?: Json | null;
          source_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          organization_id?: string | null;
          sigef_code?: string | null;
          cnir?: string | null;
          codigo_imovel?: string | null;
          certificacao?: string | null;
          situacao?: string | null;
          municipio?: string | null;
          uf?: string | null;
          area_ha?: number | null;
          data_certificacao?: string | null;
          attributes?: Json;
          geom_geojson?: Json | null;
          bbox?: Json | null;
          source_id?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      geo_alert_layers: {
        Row: {
          id: string;
          organization_id: string | null;
          layer_type: string;
          provider: string | null;
          reference_year: string | null;
          name: string;
          cod_car: string | null;
          cod_imovel: string | null;
          alert_code: number | null;
          codigo_alerta: string | null;
          alert_date: string | null;
          area_ha: number | null;
          area_intersecao_ha: number | null;
          area_alerta_ha: number | null;
          attributes: Json;
          geom_geojson: Json | null;
          bbox: Json | null;
          source_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id?: string | null;
          layer_type: string;
          provider?: string | null;
          reference_year?: string | null;
          name: string;
          cod_car?: string | null;
          cod_imovel?: string | null;
          alert_code?: number | null;
          codigo_alerta?: string | null;
          alert_date?: string | null;
          area_ha?: number | null;
          area_intersecao_ha?: number | null;
          area_alerta_ha?: number | null;
          attributes?: Json;
          geom_geojson?: Json | null;
          bbox?: Json | null;
          source_id?: string | null;
          created_at?: string;
        };
        Update: {
          organization_id?: string | null;
          layer_type?: string;
          provider?: string | null;
          reference_year?: string | null;
          name?: string;
          cod_car?: string | null;
          cod_imovel?: string | null;
          alert_code?: number | null;
          codigo_alerta?: string | null;
          alert_date?: string | null;
          area_ha?: number | null;
          area_intersecao_ha?: number | null;
          area_alerta_ha?: number | null;
          attributes?: Json;
          geom_geojson?: Json | null;
          bbox?: Json | null;
          source_id?: string | null;
        };
        Relationships: [];
      };
      geo_thematic_layers: {
        Row: {
          id: string;
          organization_id: string | null;
          layer_type: string;
          provider: string | null;
          reference_year: string | null;
          name: string;
          attributes: Json;
          geom_geojson: Json | null;
          bbox: Json | null;
          source_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id?: string | null;
          layer_type: string;
          provider?: string | null;
          reference_year?: string | null;
          name: string;
          attributes?: Json;
          geom_geojson?: Json | null;
          bbox?: Json | null;
          source_id?: string | null;
          created_at?: string;
        };
        Update: {
          organization_id?: string | null;
          layer_type?: string;
          provider?: string | null;
          reference_year?: string | null;
          name?: string;
          attributes?: Json;
          geom_geojson?: Json | null;
          bbox?: Json | null;
          source_id?: string | null;
        };
        Relationships: [];
      };
      property_searches: {
        Row: {
          id: string;
          organization_id: string | null;
          user_id: string | null;
          cod_car: string;
          client_id: string | null;
          service_card_id: string | null;
          property_id: string | null;
          status: PropertySearchStatus;
          result_summary: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id?: string | null;
          user_id?: string | null;
          cod_car: string;
          client_id?: string | null;
          service_card_id?: string | null;
          property_id?: string | null;
          status?: PropertySearchStatus;
          result_summary?: Json;
          created_at?: string;
        };
        Update: {
          organization_id?: string | null;
          user_id?: string | null;
          cod_car?: string;
          client_id?: string | null;
          service_card_id?: string | null;
          property_id?: string | null;
          status?: PropertySearchStatus;
          result_summary?: Json;
        };
        Relationships: [];
      };
      property_search_results: {
        Row: {
          id: string;
          search_id: string;
          result_type: PropertySearchResultType;
          title: string;
          description: string | null;
          data: Json;
          geometry_geojson: Json | null;
          storage_path: string | null;
          external_url: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          search_id: string;
          result_type: PropertySearchResultType;
          title: string;
          description?: string | null;
          data?: Json;
          geometry_geojson?: Json | null;
          storage_path?: string | null;
          external_url?: string | null;
          created_at?: string;
        };
        Update: {
          search_id?: string;
          result_type?: PropertySearchResultType;
          title?: string;
          description?: string | null;
          data?: Json;
          geometry_geojson?: Json | null;
          storage_path?: string | null;
          external_url?: string | null;
        };
        Relationships: [];
      };
      property_documents: {
        Row: {
          id: string;
          organization_id: string | null;
          cod_car: string | null;
          client_id: string | null;
          service_card_id: string | null;
          document_type: string;
          title: string;
          storage_path: string | null;
          external_url: string | null;
          source: string | null;
          status: PropertyDocumentStatus;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id?: string | null;
          cod_car?: string | null;
          client_id?: string | null;
          service_card_id?: string | null;
          document_type: string;
          title: string;
          storage_path?: string | null;
          external_url?: string | null;
          source?: string | null;
          status?: PropertyDocumentStatus;
          created_at?: string;
        };
        Update: {
          organization_id?: string | null;
          cod_car?: string | null;
          client_id?: string | null;
          service_card_id?: string | null;
          document_type?: string;
          title?: string;
          storage_path?: string | null;
          external_url?: string | null;
          source?: string | null;
          status?: PropertyDocumentStatus;
        };
        Relationships: [];
      };
      proposals: {
        Row: BaseRow & {
          organization_id: string | null;
          client_id: string;
          title: string;
          description: string | null;
          value: number | null;
          owner_id: string | null;
          sent_at: string | null;
          valid_until: string | null;
          comments: string | null;
          service_type: ProposalServiceType;
          payment_status: PaymentStatus;
          converted_at: string | null;
          contract_id: string | null;
          service_card_id: string | null;
          model_data: Json;
          pdf_file_path: string | null;
          pdf_generated_at: string | null;
          lost_at: string | null;
          lost_reason: string | null;
          stage: ProposalStage;
          position: number;
          converted_service_card_id: string | null;
        };
        Insert: {
          id?: string;
          organization_id?: string | null;
          client_id: string;
          title: string;
          description?: string | null;
          value?: number | null;
          owner_id?: string | null;
          sent_at?: string | null;
          valid_until?: string | null;
          comments?: string | null;
          service_type: ProposalServiceType;
          payment_status?: PaymentStatus;
          converted_at?: string | null;
          contract_id?: string | null;
          service_card_id?: string | null;
          model_data?: Json;
          pdf_file_path?: string | null;
          pdf_generated_at?: string | null;
          lost_at?: string | null;
          lost_reason?: string | null;
          stage?: ProposalStage;
          position?: number;
          converted_service_card_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          client_id?: string;
          organization_id?: string | null;
          title?: string;
          description?: string | null;
          value?: number | null;
          owner_id?: string | null;
          sent_at?: string | null;
          valid_until?: string | null;
          comments?: string | null;
          service_type?: ProposalServiceType;
          payment_status?: PaymentStatus;
          converted_at?: string | null;
          contract_id?: string | null;
          service_card_id?: string | null;
          model_data?: Json;
          pdf_file_path?: string | null;
          pdf_generated_at?: string | null;
          lost_at?: string | null;
          lost_reason?: string | null;
          stage?: ProposalStage;
          position?: number;
          converted_service_card_id?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      service_boards: {
        Row: BaseRow & {
          name: string;
          slug: string;
          description: string | null;
          position: number;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          description?: string | null;
          position?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          slug?: string;
          description?: string | null;
          position?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      service_columns: {
        Row: BaseRow & {
          board_id: string;
          name: string;
          slug: string;
          position: number;
        };
        Insert: {
          id?: string;
          board_id: string;
          name: string;
          slug: string;
          position?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          board_id?: string;
          name?: string;
          slug?: string;
          position?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      service_cards: {
        Row: BaseRow & {
          organization_id: string | null;
          column_id: string;
          client_id: string | null;
          owner_id: string | null;
          proposal_id: string | null;
          contract_id: string | null;
          service_type: ProposalServiceType | null;
          payment_status: PaymentStatus;
          title: string;
          description: string | null;
          municipality: string | null;
          responsible_user_id: string | null;
          payment_condition: string | null;
          custom_service_name: string | null;
          priority: Priority;
          service_date: string | null;
          due_date: string | null;
          completed_at: string | null;
          checklist_percent: number | null;
          custom_fields_json: Json;
          position: number;
          created_from_proposal_id: string | null;
          import_source: string | null;
          import_external_id: string | null;
          import_external_url: string | null;
          imported_at: string | null;
          imported_by: string | null;
          raw_import_data: Json | null;
        };
        Insert: {
          id?: string;
          organization_id?: string | null;
          column_id: string;
          client_id?: string | null;
          owner_id?: string | null;
          proposal_id?: string | null;
          contract_id?: string | null;
          service_type?: ProposalServiceType | null;
          payment_status?: PaymentStatus;
          title: string;
          description?: string | null;
          municipality?: string | null;
          responsible_user_id?: string | null;
          payment_condition?: string | null;
          custom_service_name?: string | null;
          priority?: Priority;
          service_date?: string | null;
          due_date?: string | null;
          completed_at?: string | null;
          checklist_percent?: number | null;
          custom_fields_json?: Json;
          position?: number;
          created_from_proposal_id?: string | null;
          import_source?: string | null;
          import_external_id?: string | null;
          import_external_url?: string | null;
          imported_at?: string | null;
          imported_by?: string | null;
          raw_import_data?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          column_id?: string;
          organization_id?: string | null;
          client_id?: string | null;
          owner_id?: string | null;
          proposal_id?: string | null;
          contract_id?: string | null;
          service_type?: ProposalServiceType | null;
          payment_status?: PaymentStatus;
          title?: string;
          description?: string | null;
          municipality?: string | null;
          responsible_user_id?: string | null;
          payment_condition?: string | null;
          custom_service_name?: string | null;
          priority?: Priority;
          service_date?: string | null;
          due_date?: string | null;
          completed_at?: string | null;
          checklist_percent?: number | null;
          custom_fields_json?: Json;
          position?: number;
          created_from_proposal_id?: string | null;
          import_source?: string | null;
          import_external_id?: string | null;
          import_external_url?: string | null;
          imported_at?: string | null;
          imported_by?: string | null;
          raw_import_data?: Json | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      service_members: {
        Row: {
          id: string;
          organization_id: string | null;
          service_card_id: string;
          user_id: string;
          role: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id?: string | null;
          service_card_id: string;
          user_id: string;
          role?: string;
          created_at?: string;
        };
        Update: {
          organization_id?: string | null;
          service_card_id?: string;
          user_id?: string;
          role?: string;
        };
        Relationships: [];
      };
      service_events: {
        Row: {
          id: string;
          organization_id: string | null;
          service_card_id: string;
          event_type: string;
          title: string;
          description: string | null;
          metadata: Json;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id?: string | null;
          service_card_id: string;
          event_type: string;
          title: string;
          description?: string | null;
          metadata?: Json;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          organization_id?: string | null;
          service_card_id?: string;
          event_type?: string;
          title?: string;
          description?: string | null;
          metadata?: Json;
          created_by?: string | null;
        };
        Relationships: [];
      };
      service_property_infos: {
        Row: {
          id: string;
          organization_id: string;
          service_card_id: string;
          title: string;
          value: string | null;
          position: number;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          service_card_id: string;
          title: string;
          value?: string | null;
          position?: number;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          organization_id?: string;
          service_card_id?: string;
          title?: string;
          value?: string | null;
          position?: number;
          created_by?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      team_members: {
        Row: BaseRow & {
          organization_id: string;
          auth_user_id: string | null;
          name: string;
          email: string | null;
          document_number: string | null;
          pix_key: string | null;
          bank_details: Json;
          monthly_amount: number | null;
          role_title: string | null;
          birth_date: string | null;
          work_schedule_type: WorkScheduleType;
          expected_minutes_by_weekday: Json;
          default_work_start: string | null;
          default_work_end: string | null;
          notes: string | null;
          status: "active" | "inactive";
          created_by: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          auth_user_id?: string | null;
          name: string;
          email?: string | null;
          document_number?: string | null;
          pix_key?: string | null;
          bank_details?: Json;
          monthly_amount?: number | null;
          role_title?: string | null;
          birth_date?: string | null;
          work_schedule_type?: WorkScheduleType;
          expected_minutes_by_weekday?: Json;
          default_work_start?: string | null;
          default_work_end?: string | null;
          notes?: string | null;
          status?: "active" | "inactive";
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          organization_id?: string;
          auth_user_id?: string | null;
          name?: string;
          email?: string | null;
          document_number?: string | null;
          pix_key?: string | null;
          bank_details?: Json;
          monthly_amount?: number | null;
          role_title?: string | null;
          birth_date?: string | null;
          work_schedule_type?: WorkScheduleType;
          expected_minutes_by_weekday?: Json;
          default_work_start?: string | null;
          default_work_end?: string | null;
          notes?: string | null;
          status?: "active" | "inactive";
          created_by?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      work_time_days: {
        Row: BaseRow & {
          organization_id: string;
          user_id: string;
          work_date: string;
          status: WorkTimeDayStatus;
          first_started_at: string;
          last_seen_at: string;
          last_safety_confirmed_at: string;
          next_safety_due_at: string;
          safety_grace_until: string;
          total_work_seconds: number;
          total_interval_seconds: number;
          total_field_seconds: number;
        };
        Insert: {
          id?: string;
          organization_id: string;
          user_id: string;
          work_date: string;
          status?: WorkTimeDayStatus;
          first_started_at?: string;
          last_seen_at?: string;
          last_safety_confirmed_at?: string;
          next_safety_due_at?: string;
          safety_grace_until?: string;
          total_work_seconds?: number;
          total_interval_seconds?: number;
          total_field_seconds?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          organization_id?: string;
          user_id?: string;
          work_date?: string;
          status?: WorkTimeDayStatus;
          first_started_at?: string;
          last_seen_at?: string;
          last_safety_confirmed_at?: string;
          next_safety_due_at?: string;
          safety_grace_until?: string;
          total_work_seconds?: number;
          total_interval_seconds?: number;
          total_field_seconds?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      work_time_sessions: {
        Row: BaseRow & {
          organization_id: string;
          user_id: string;
          work_day_id: string;
          started_at: string;
          ended_at: string | null;
          last_seen_at: string;
          mode: WorkTimeSessionMode;
          end_reason: WorkTimeSessionEndReason | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          user_id: string;
          work_day_id: string;
          started_at?: string;
          ended_at?: string | null;
          last_seen_at?: string;
          mode?: WorkTimeSessionMode;
          end_reason?: WorkTimeSessionEndReason | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          organization_id?: string;
          user_id?: string;
          work_day_id?: string;
          started_at?: string;
          ended_at?: string | null;
          last_seen_at?: string;
          mode?: WorkTimeSessionMode;
          end_reason?: WorkTimeSessionEndReason | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      work_time_events: {
        Row: {
          id: string;
          organization_id: string;
          user_id: string;
          work_day_id: string;
          event_type: string;
          occurred_at: string;
          metadata: Json;
        };
        Insert: {
          id?: string;
          organization_id: string;
          user_id: string;
          work_day_id: string;
          event_type: string;
          occurred_at?: string;
          metadata?: Json;
        };
        Update: {
          organization_id?: string;
          user_id?: string;
          work_day_id?: string;
          event_type?: string;
          occurred_at?: string;
          metadata?: Json;
        };
        Relationships: [];
      };
      company_holidays: {
        Row: BaseRow & {
          organization_id: string | null;
          date: string;
          name: string;
          type: CompanyHolidayType;
          affects_expected_hours: boolean;
          is_recurring: boolean;
        };
        Insert: {
          id?: string;
          organization_id?: string | null;
          date: string;
          name: string;
          type?: CompanyHolidayType;
          affects_expected_hours?: boolean;
          is_recurring?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          organization_id?: string | null;
          date?: string;
          name?: string;
          type?: CompanyHolidayType;
          affects_expected_hours?: boolean;
          is_recurring?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      team_chat_messages: {
        Row: {
          id: string;
          organization_id: string;
          sender_user_id: string;
          message: string;
          message_type: "text";
          chat_scope: "general" | "direct";
          recipient_user_id: string | null;
          conversation_key: string;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          sender_user_id: string;
          message: string;
          message_type?: "text";
          chat_scope?: "general" | "direct";
          recipient_user_id?: string | null;
          conversation_key?: string;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          organization_id?: string;
          sender_user_id?: string;
          message?: string;
          message_type?: "text";
          chat_scope?: "general" | "direct";
          recipient_user_id?: string | null;
          conversation_key?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      team_chat_reads: {
        Row: {
          id: string;
          organization_id: string;
          user_id: string;
          conversation_key: string;
          last_read_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          user_id: string;
          conversation_key?: string;
          last_read_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          organization_id?: string;
          user_id?: string;
          conversation_key?: string;
          last_read_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_integrations: {
        Row: {
          id: string;
          user_id: string;
          organization_id: string | null;
          provider: UserIntegrationProvider;
          provider_account_email: string | null;
          access_token_encrypted: string | null;
          refresh_token_encrypted: string | null;
          token_expires_at: string | null;
          scopes: string[] | null;
          status: UserIntegrationStatus;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          organization_id?: string | null;
          provider: UserIntegrationProvider;
          provider_account_email?: string | null;
          access_token_encrypted?: string | null;
          refresh_token_encrypted?: string | null;
          token_expires_at?: string | null;
          scopes?: string[] | null;
          status?: UserIntegrationStatus;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          organization_id?: string | null;
          provider?: UserIntegrationProvider;
          provider_account_email?: string | null;
          access_token_encrypted?: string | null;
          refresh_token_encrypted?: string | null;
          token_expires_at?: string | null;
          scopes?: string[] | null;
          status?: UserIntegrationStatus;
          metadata?: Json;
          updated_at?: string;
        };
        Relationships: [];
      };
      calendar_event_syncs: {
        Row: {
          id: string;
          organization_id: string;
          internal_event_id: string;
          user_id: string;
          provider: "google_calendar";
          external_event_id: string | null;
          sync_status: CalendarSyncStatus;
          last_error: string | null;
          synced_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          internal_event_id: string;
          user_id: string;
          provider?: "google_calendar";
          external_event_id?: string | null;
          sync_status?: CalendarSyncStatus;
          last_error?: string | null;
          synced_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          organization_id?: string;
          internal_event_id?: string;
          user_id?: string;
          provider?: "google_calendar";
          external_event_id?: string | null;
          sync_status?: CalendarSyncStatus;
          last_error?: string | null;
          synced_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          organization_id: string;
          recipient_user_id: string;
          actor_user_id: string | null;
          type: string;
          title: string;
          message: string;
          entity_type: string | null;
          entity_id: string | null;
          dedupe_key: string | null;
          action_url: string | null;
          metadata: Json;
          scheduled_for: string | null;
          read_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          recipient_user_id: string;
          actor_user_id?: string | null;
          type: string;
          title: string;
          message: string;
          entity_type?: string | null;
          entity_id?: string | null;
          dedupe_key?: string | null;
          action_url?: string | null;
          metadata?: Json;
          scheduled_for?: string | null;
          read_at?: string | null;
          created_at?: string;
        };
        Update: {
          organization_id?: string;
          recipient_user_id?: string;
          actor_user_id?: string | null;
          type?: string;
          title?: string;
          message?: string;
          entity_type?: string | null;
          entity_id?: string | null;
          dedupe_key?: string | null;
          action_url?: string | null;
          metadata?: Json;
          scheduled_for?: string | null;
          read_at?: string | null;
        };
        Relationships: [];
      };
      agenda_reminders: {
        Row: {
          id: string;
          organization_id: string;
          title: string;
          description: string | null;
          reminder_date: string;
          reminder_time: string | null;
          entity_type: string | null;
          entity_id: string | null;
          service_card_id: string | null;
          client_id: string | null;
          category: string;
          custom_category: string | null;
          recurrence: "none" | "weekly";
          recurrence_until: string | null;
          canceled_at: string | null;
          notification_preference: ReminderNotificationPreference;
          completed_at: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          title: string;
          description?: string | null;
          reminder_date: string;
          reminder_time?: string | null;
          entity_type?: string | null;
          entity_id?: string | null;
          service_card_id?: string | null;
          client_id?: string | null;
          category?: string;
          custom_category?: string | null;
          recurrence?: "none" | "weekly";
          recurrence_until?: string | null;
          canceled_at?: string | null;
          notification_preference?: ReminderNotificationPreference;
          completed_at?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          organization_id?: string;
          title?: string;
          description?: string | null;
          reminder_date?: string;
          reminder_time?: string | null;
          entity_type?: string | null;
          entity_id?: string | null;
          service_card_id?: string | null;
          client_id?: string | null;
          category?: string;
          custom_category?: string | null;
          recurrence?: "none" | "weekly";
          recurrence_until?: string | null;
          canceled_at?: string | null;
          notification_preference?: ReminderNotificationPreference;
          completed_at?: string | null;
          created_by?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      agenda_reminder_recipients: {
        Row: {
          id: string;
          organization_id: string;
          reminder_id: string;
          recipient_user_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          reminder_id: string;
          recipient_user_id: string;
          created_at?: string;
        };
        Update: {
          organization_id?: string;
          reminder_id?: string;
          recipient_user_id?: string;
        };
        Relationships: [];
      };
      recurring_expenses: {
        Row: BaseRow & {
          organization_id: string;
          team_member_id: string | null;
          amount: number;
          description: string;
          recurrence: "monthly";
          status: "active" | "inactive";
          next_due_date: string;
          category: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          team_member_id?: string | null;
          amount: number;
          description: string;
          recurrence?: "monthly";
          status?: "active" | "inactive";
          next_due_date?: string;
          category?: string;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          organization_id?: string;
          team_member_id?: string | null;
          amount?: number;
          description?: string;
          recurrence?: "monthly";
          status?: "active" | "inactive";
          next_due_date?: string;
          category?: string;
          created_by?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      contracts: {
        Row: BaseRow & {
          organization_id: string | null;
          client_id: string;
          proposal_id: string | null;
          service_card_id: string | null;
          title: string;
          description: string | null;
          amount: number | null;
          status: ContractStatus;
          pdf_file_path: string | null;
          pdf_generated_at: string | null;
          model_data: Json;
          clauses_json: Json;
          signers_json: Json;
          forum: string | null;
          payment_status: PaymentStatus;
          sent_at: string | null;
          signed_at: string | null;
          starts_at: string | null;
          ends_at: string | null;
          important_dates_json: Json;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          organization_id?: string | null;
          client_id: string;
          proposal_id?: string | null;
          service_card_id?: string | null;
          title: string;
          description?: string | null;
          amount?: number | null;
          status?: ContractStatus;
          pdf_file_path?: string | null;
          pdf_generated_at?: string | null;
          model_data?: Json;
          clauses_json?: Json;
          signers_json?: Json;
          forum?: string | null;
          payment_status?: PaymentStatus;
          sent_at?: string | null;
          signed_at?: string | null;
          starts_at?: string | null;
          ends_at?: string | null;
          important_dates_json?: Json;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          client_id?: string;
          organization_id?: string | null;
          proposal_id?: string | null;
          service_card_id?: string | null;
          title?: string;
          description?: string | null;
          amount?: number | null;
          status?: ContractStatus;
          pdf_file_path?: string | null;
          pdf_generated_at?: string | null;
          model_data?: Json;
          clauses_json?: Json;
          signers_json?: Json;
          forum?: string | null;
          payment_status?: PaymentStatus;
          sent_at?: string | null;
          signed_at?: string | null;
          starts_at?: string | null;
          ends_at?: string | null;
          important_dates_json?: Json;
          created_by?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      service_card_movements: {
        Row: {
          id: string;
          service_card_id: string;
          from_column_id: string | null;
          to_column_id: string;
          moved_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          service_card_id: string;
          from_column_id?: string | null;
          to_column_id: string;
          moved_by?: string | null;
          created_at?: string;
        };
        Update: {
          service_card_id?: string;
          from_column_id?: string | null;
          to_column_id?: string;
          moved_by?: string | null;
        };
        Relationships: [];
      };
      checklists: {
        Row: {
          id: string;
          organization_id: string | null;
          service_card_id: string;
          title: string;
          checklist_type: "documents" | "steps";
          position: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id?: string | null;
          service_card_id: string;
          title: string;
          checklist_type?: "documents" | "steps";
          position?: number;
          created_at?: string;
        };
        Update: {
          organization_id?: string | null;
          service_card_id?: string;
          title?: string;
          checklist_type?: "documents" | "steps";
          position?: number;
        };
        Relationships: [];
      };
      checklist_items: {
        Row: {
          id: string;
          checklist_id: string;
          title: string;
          is_done: boolean;
          completed_at: string | null;
          completed_by: string | null;
          due_date: string | null;
          due_time: string | null;
          scheduled_at: string | null;
          deleted_at: string | null;
          archived_at: string | null;
          position: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          checklist_id: string;
          title: string;
          is_done?: boolean;
          completed_at?: string | null;
          completed_by?: string | null;
          due_date?: string | null;
          due_time?: string | null;
          scheduled_at?: string | null;
          deleted_at?: string | null;
          archived_at?: string | null;
          position?: number;
          created_at?: string;
        };
        Update: {
          checklist_id?: string;
          title?: string;
          is_done?: boolean;
          completed_at?: string | null;
          completed_by?: string | null;
          due_date?: string | null;
          due_time?: string | null;
          scheduled_at?: string | null;
          deleted_at?: string | null;
          archived_at?: string | null;
          position?: number;
        };
        Relationships: [];
      };
      attachments: {
        Row: {
          id: string;
          organization_id: string | null;
          is_global: boolean;
          entity_type: AttachmentEntityType;
          entity_id: string;
          bucket: string;
          storage_path: string | null;
          file_path: string;
          file_name: string;
          mime_type: string | null;
          size_bytes: number | null;
          file_size: number | null;
          category: string | null;
          created_by: string | null;
          uploaded_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id?: string | null;
          is_global?: boolean;
          entity_type: AttachmentEntityType;
          entity_id: string;
          bucket?: string;
          storage_path?: string | null;
          file_path: string;
          file_name: string;
          mime_type?: string | null;
          size_bytes?: number | null;
          file_size?: number | null;
          category?: string | null;
          created_by?: string | null;
          uploaded_by?: string | null;
          created_at?: string;
        };
        Update: {
          organization_id?: string | null;
          is_global?: boolean;
          entity_type?: AttachmentEntityType;
          entity_id?: string;
          bucket?: string;
          storage_path?: string | null;
          file_path?: string;
          file_name?: string;
          mime_type?: string | null;
          size_bytes?: number | null;
          file_size?: number | null;
          category?: string | null;
          created_by?: string | null;
          uploaded_by?: string | null;
        };
        Relationships: [];
      };
      proposal_services: {
        Row: BaseRow & {
          proposal_id: string;
          name: string;
          description: string | null;
          quantity: number;
          unit: string | null;
          unit_price: number;
          total: number;
          position: number;
        };
        Insert: {
          id?: string;
          proposal_id: string;
          name: string;
          description?: string | null;
          quantity?: number;
          unit?: string | null;
          unit_price?: number;
          position?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          proposal_id?: string;
          name?: string;
          description?: string | null;
          quantity?: number;
          unit?: string | null;
          unit_price?: number;
          position?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      contract_services: {
        Row: BaseRow & {
          contract_id: string;
          proposal_service_id: string | null;
          name: string;
          description: string | null;
          quantity: number;
          unit: string | null;
          unit_price: number;
          total: number;
          position: number;
        };
        Insert: {
          id?: string;
          contract_id: string;
          proposal_service_id?: string | null;
          name: string;
          description?: string | null;
          quantity?: number;
          unit?: string | null;
          unit_price?: number;
          position?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          contract_id?: string;
          proposal_service_id?: string | null;
          name?: string;
          description?: string | null;
          quantity?: number;
          unit?: string | null;
          unit_price?: number;
          position?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      payment_installments: {
        Row: BaseRow & {
          proposal_id: string | null;
          contract_id: string | null;
          description: string | null;
          percentage: number | null;
          amount: number | null;
          due_date: string | null;
          payment_method: string | null;
          status: "pending" | "paid" | "overdue" | "canceled";
          position: number;
        };
        Insert: {
          id?: string;
          proposal_id?: string | null;
          contract_id?: string | null;
          description?: string | null;
          percentage?: number | null;
          amount?: number | null;
          due_date?: string | null;
          payment_method?: string | null;
          status?: "pending" | "paid" | "overdue" | "canceled";
          position?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          proposal_id?: string | null;
          contract_id?: string | null;
          description?: string | null;
          percentage?: number | null;
          amount?: number | null;
          due_date?: string | null;
          payment_method?: string | null;
          status?: "pending" | "paid" | "overdue" | "canceled";
          position?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      revenues: {
        Row: BaseRow & {
          organization_id: string | null;
          client_id: string;
          proposal_id: string | null;
          service_card_id: string | null;
          contract_id: string | null;
          auto_generated: boolean;
          description: string;
          category: string;
          amount: number;
          expected_amount: number | null;
          realized_amount: number | null;
          due_date: string;
          paid_at: string | null;
          bank_account: string | null;
          notes: string | null;
          status: FinanceStatus;
        };
        Insert: {
          id?: string;
          organization_id?: string | null;
          client_id: string;
          proposal_id?: string | null;
          service_card_id?: string | null;
          contract_id?: string | null;
          auto_generated?: boolean;
          description: string;
          category: string;
          amount: number;
          expected_amount?: number | null;
          realized_amount?: number | null;
          due_date: string;
          paid_at?: string | null;
          bank_account?: string | null;
          notes?: string | null;
          status?: FinanceStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          client_id?: string;
          organization_id?: string | null;
          proposal_id?: string | null;
          service_card_id?: string | null;
          contract_id?: string | null;
          auto_generated?: boolean;
          description?: string;
          category?: string;
          amount?: number;
          expected_amount?: number | null;
          realized_amount?: number | null;
          due_date?: string;
          paid_at?: string | null;
          bank_account?: string | null;
          notes?: string | null;
          status?: FinanceStatus;
          updated_at?: string;
        };
        Relationships: [];
      };
      expenses: {
        Row: BaseRow & {
          organization_id: string | null;
          client_id: string | null;
          proposal_id: string | null;
          service_card_id: string | null;
          team_member_id: string | null;
          recurring_expense_id: string | null;
          description: string;
          category: string;
          amount: number;
          expected_amount: number | null;
          realized_amount: number | null;
          due_date: string;
          paid_at: string | null;
          bank_account: string | null;
          notes: string | null;
          status: FinanceStatus;
        };
        Insert: {
          id?: string;
          organization_id?: string | null;
          client_id?: string | null;
          proposal_id?: string | null;
          service_card_id?: string | null;
          team_member_id?: string | null;
          recurring_expense_id?: string | null;
          description: string;
          category: string;
          amount: number;
          expected_amount?: number | null;
          realized_amount?: number | null;
          due_date: string;
          paid_at?: string | null;
          bank_account?: string | null;
          notes?: string | null;
          status?: FinanceStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          client_id?: string | null;
          organization_id?: string | null;
          proposal_id?: string | null;
          service_card_id?: string | null;
          team_member_id?: string | null;
          recurring_expense_id?: string | null;
          description?: string;
          category?: string;
          amount?: number;
          expected_amount?: number | null;
          realized_amount?: number | null;
          due_date?: string;
          paid_at?: string | null;
          bank_account?: string | null;
          notes?: string | null;
          status?: FinanceStatus;
          updated_at?: string;
        };
        Relationships: [];
      };
      finance_transfers: {
        Row: BaseRow & {
          organization_id: string;
          from_bank_account: string;
          to_bank_account: string;
          amount: number;
          transfer_date: string;
          description: string;
          notes: string | null;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          from_bank_account: string;
          to_bank_account: string;
          amount: number;
          transfer_date: string;
          description: string;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          organization_id?: string;
          from_bank_account?: string;
          to_bank_account?: string;
          amount?: number;
          transfer_date?: string;
          description?: string;
          notes?: string | null;
          created_by?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      company_knowledge_categories: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          slug: string;
          position: number;
          sort_order: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          name: string;
          slug: string;
          position?: number;
          sort_order?: number | null;
          created_at?: string;
        };
        Update: {
          organization_id?: string;
          name?: string;
          slug?: string;
          position?: number;
          sort_order?: number | null;
        };
        Relationships: [];
      };
      company_knowledge_items: {
        Row: BaseRow & {
          organization_id: string;
          category_id: string | null;
          title: string;
          slug: string | null;
          status: string;
          description: string | null;
          content: Json | null;
          content_markdown: string | null;
          created_by: string | null;
          updated_by: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          category_id?: string | null;
          title: string;
          slug?: string | null;
          status?: string;
          description?: string | null;
          content?: Json | null;
          content_markdown?: string | null;
          created_by?: string | null;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          organization_id?: string;
          category_id?: string | null;
          title?: string;
          slug?: string | null;
          status?: string;
          description?: string | null;
          content?: Json | null;
          content_markdown?: string | null;
          created_by?: string | null;
          updated_by?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      company_knowledge_blocks: {
        Row: BaseRow & {
          organization_id: string;
          item_id: string;
          title: string;
          content: string | null;
          position: number;
        };
        Insert: {
          id?: string;
          organization_id: string;
          item_id: string;
          title: string;
          content?: string | null;
          position?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          organization_id?: string;
          item_id?: string;
          title?: string;
          content?: string | null;
          position?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      hr_documents: {
        Row: BaseRow & {
          organization_id: string;
          team_member_id: string | null;
          document_type: string;
          title: string;
          document_date: string | null;
          due_date: string | null;
          status: string;
          storage_path: string | null;
          file_name: string | null;
          mime_type: string | null;
          size_bytes: number | null;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          team_member_id?: string | null;
          document_type: string;
          title: string;
          document_date?: string | null;
          due_date?: string | null;
          status?: string;
          storage_path?: string | null;
          file_name?: string | null;
          mime_type?: string | null;
          size_bytes?: number | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          organization_id?: string;
          team_member_id?: string | null;
          document_type?: string;
          title?: string;
          document_date?: string | null;
          due_date?: string | null;
          status?: string;
          storage_path?: string | null;
          file_name?: string | null;
          mime_type?: string | null;
          size_bytes?: number | null;
          created_by?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      hr_absences: {
        Row: BaseRow & {
          organization_id: string;
          team_member_id: string;
          absence_type: "ferias" | "falta" | "afastamento" | "outro";
          start_date: string;
          end_date: string | null;
          notes: string | null;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          team_member_id: string;
          absence_type: "ferias" | "falta" | "afastamento" | "outro";
          start_date: string;
          end_date?: string | null;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          organization_id?: string;
          team_member_id?: string;
          absence_type?: "ferias" | "falta" | "afastamento" | "outro";
          start_date?: string;
          end_date?: string | null;
          notes?: string | null;
          created_by?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      hr_birthdays: {
        Row: BaseRow & {
          organization_id: string;
          team_member_id: string | null;
          name: string;
          birthday: string;
          notes: string | null;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          team_member_id?: string | null;
          name: string;
          birthday: string;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          organization_id?: string;
          team_member_id?: string | null;
          name?: string;
          birthday?: string;
          notes?: string | null;
          created_by?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      routine_items: {
        Row: BaseRow & {
          organization_id: string;
          user_id: string;
          title: string;
          description: string | null;
          routine_scope: "daily" | "weekly" | "monthly" | "annual";
          routine_date: string | null;
          due_time: string | null;
          status: "open" | "done" | "canceled";
          is_emergency: boolean;
          source: string;
          daily_checklist_item_id: string | null;
          completed_at: string | null;
          created_by: string | null;
          deleted_at: string | null;
          archived_at: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          user_id: string;
          title: string;
          description?: string | null;
          routine_scope?: "daily" | "weekly" | "monthly" | "annual";
          routine_date?: string | null;
          due_time?: string | null;
          status?: "open" | "done" | "canceled";
          is_emergency?: boolean;
          source?: string;
          daily_checklist_item_id?: string | null;
          completed_at?: string | null;
          created_by?: string | null;
          deleted_at?: string | null;
          archived_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          organization_id?: string;
          user_id?: string;
          title?: string;
          description?: string | null;
          routine_scope?: "daily" | "weekly" | "monthly" | "annual";
          routine_date?: string | null;
          due_time?: string | null;
          status?: "open" | "done" | "canceled";
          is_emergency?: boolean;
          source?: string;
          daily_checklist_item_id?: string | null;
          completed_at?: string | null;
          created_by?: string | null;
          deleted_at?: string | null;
          archived_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      company_knowledge_checklist_items: {
        Row: BaseRow & {
          organization_id: string;
          knowledge_item_id: string;
          title: string;
          is_done: boolean;
          due_date: string | null;
          due_time: string | null;
          completed_at: string | null;
          created_by: string | null;
          deleted_at: string | null;
          archived_at: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          knowledge_item_id: string;
          title: string;
          is_done?: boolean;
          due_date?: string | null;
          due_time?: string | null;
          completed_at?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
          archived_at?: string | null;
        };
        Update: {
          organization_id?: string;
          knowledge_item_id?: string;
          title?: string;
          is_done?: boolean;
          due_date?: string | null;
          due_time?: string | null;
          completed_at?: string | null;
          created_by?: string | null;
          updated_at?: string;
          deleted_at?: string | null;
          archived_at?: string | null;
        };
        Relationships: [];
      };
      document_templates: {
        Row: BaseRow & {
          organization_id: string | null;
          is_global: boolean;
          title: string;
          category: string;
          version: string;
          status: DocumentStatus;
          description: string | null;
          file_path: string | null;
          bucket: string;
          storage_path: string | null;
          file_name: string | null;
          mime_type: string | null;
          size_bytes: number | null;
        };
        Insert: {
          id?: string;
          organization_id?: string | null;
          is_global?: boolean;
          title: string;
          category: string;
          version: string;
          status?: DocumentStatus;
          description?: string | null;
          file_path?: string | null;
          bucket?: string;
          storage_path?: string | null;
          file_name?: string | null;
          mime_type?: string | null;
          size_bytes?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          title?: string;
          organization_id?: string | null;
          is_global?: boolean;
          category?: string;
          version?: string;
          status?: DocumentStatus;
          description?: string | null;
          file_path?: string | null;
          bucket?: string;
          storage_path?: string | null;
          file_name?: string | null;
          mime_type?: string | null;
          size_bytes?: number | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      documents: {
        Row: {
          id: string;
          organization_id: string | null;
          client_id: string | null;
          property_id: string | null;
          service_id: string | null;
          employee_id: string | null;
          related_type: string | null;
          related_id: string | null;
          uploaded_by: string | null;
          original_name: string;
          stored_name: string | null;
          document_type: string | null;
          category: string | null;
          title: string | null;
          description: string | null;
          notes: string | null;
          storage_provider: string;
          storage_bucket: string;
          storage_path: string;
          size_bytes: number;
          mime_type: string | null;
          upload_status: "aguardando_upload" | "enviado" | "erro_upload" | "cancelado" | "removido";
          processing_status: "nao_processado" | "pendente" | "processando" | "concluido" | "erro" | "precisa_ocr";
          processing_error: string | null;
          extracted_text: string | null;
          pages: number | null;
          file_hash: string | null;
          google_drive_file_id: string | null;
          google_drive_owner_user_id: string | null;
          google_drive_owner_email: string | null;
          external_url: string | null;
          external_metadata: Json;
          is_global: boolean;
          is_official: boolean;
          deleted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id?: string | null;
          client_id?: string | null;
          property_id?: string | null;
          service_id?: string | null;
          employee_id?: string | null;
          related_type?: string | null;
          related_id?: string | null;
          uploaded_by?: string | null;
          original_name: string;
          stored_name?: string | null;
          document_type?: string | null;
          category?: string | null;
          title?: string | null;
          description?: string | null;
          notes?: string | null;
          storage_provider?: string;
          storage_bucket?: string;
          storage_path: string;
          size_bytes?: number;
          mime_type?: string | null;
          upload_status?: "aguardando_upload" | "enviado" | "erro_upload" | "cancelado" | "removido";
          processing_status?: "nao_processado" | "pendente" | "processando" | "concluido" | "erro" | "precisa_ocr";
          processing_error?: string | null;
          extracted_text?: string | null;
          pages?: number | null;
          file_hash?: string | null;
          google_drive_file_id?: string | null;
          google_drive_owner_user_id?: string | null;
          google_drive_owner_email?: string | null;
          external_url?: string | null;
          external_metadata?: Json;
          is_global?: boolean;
          is_official?: boolean;
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          organization_id?: string | null;
          client_id?: string | null;
          property_id?: string | null;
          service_id?: string | null;
          employee_id?: string | null;
          related_type?: string | null;
          related_id?: string | null;
          uploaded_by?: string | null;
          original_name?: string;
          stored_name?: string | null;
          document_type?: string | null;
          category?: string | null;
          title?: string | null;
          description?: string | null;
          notes?: string | null;
          storage_provider?: string;
          storage_bucket?: string;
          storage_path?: string;
          size_bytes?: number;
          mime_type?: string | null;
          upload_status?: "aguardando_upload" | "enviado" | "erro_upload" | "cancelado" | "removido";
          processing_status?: "nao_processado" | "pendente" | "processando" | "concluido" | "erro" | "precisa_ocr";
          processing_error?: string | null;
          extracted_text?: string | null;
          pages?: number | null;
          file_hash?: string | null;
          google_drive_file_id?: string | null;
          google_drive_owner_user_id?: string | null;
          google_drive_owner_email?: string | null;
          external_url?: string | null;
          external_metadata?: Json;
          is_global?: boolean;
          is_official?: boolean;
          deleted_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      document_chunks: {
        Row: {
          id: string;
          document_id: string;
          organization_id: string;
          page: number | null;
          chunk_index: number;
          text: string;
          source: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          document_id: string;
          organization_id: string;
          page?: number | null;
          chunk_index?: number;
          text: string;
          source?: string | null;
          created_at?: string;
        };
        Update: {
          document_id?: string;
          organization_id?: string;
          page?: number | null;
          chunk_index?: number;
          text?: string;
          source?: string | null;
        };
        Relationships: [];
      };
      document_processing_jobs: {
        Row: {
          id: string;
          document_id: string;
          organization_id: string;
          status: "pending" | "processing" | "done" | "error" | "canceled";
          attempts: number;
          payload: Json;
          available_at: string;
          locked_at: string | null;
          processed_at: string | null;
          last_error: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          document_id: string;
          organization_id: string;
          status?: "pending" | "processing" | "done" | "error" | "canceled";
          attempts?: number;
          payload?: Json;
          available_at?: string;
          locked_at?: string | null;
          processed_at?: string | null;
          last_error?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          status?: "pending" | "processing" | "done" | "error" | "canceled";
          attempts?: number;
          payload?: Json;
          available_at?: string;
          locked_at?: string | null;
          processed_at?: string | null;
          last_error?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      legislation_items: {
        Row: BaseRow & {
          organization_id: string | null;
          is_global: boolean;
          title: string;
          category: string;
          official_link: string | null;
          technical_summary: string | null;
          practical_points: string | null;
          status: LegislationStatus;
          file_path: string | null;
          bucket: string;
          storage_path: string | null;
          file_name: string | null;
          mime_type: string | null;
          size_bytes: number | null;
        };
        Insert: {
          id?: string;
          organization_id?: string | null;
          is_global?: boolean;
          title: string;
          category: string;
          official_link?: string | null;
          technical_summary?: string | null;
          practical_points?: string | null;
          status?: LegislationStatus;
          file_path?: string | null;
          bucket?: string;
          storage_path?: string | null;
          file_name?: string | null;
          mime_type?: string | null;
          size_bytes?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          title?: string;
          organization_id?: string | null;
          is_global?: boolean;
          category?: string;
          official_link?: string | null;
          technical_summary?: string | null;
          practical_points?: string | null;
          status?: LegislationStatus;
          file_path?: string | null;
          bucket?: string;
          storage_path?: string | null;
          file_name?: string | null;
          mime_type?: string | null;
          size_bytes?: number | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      ai_agents: {
        Row: {
          id: string;
          slug: string;
          name: string;
          description: string | null;
          system_prompt: string | null;
          schedule_type: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          name: string;
          description?: string | null;
          system_prompt?: string | null;
          schedule_type?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          slug?: string;
          name?: string;
          description?: string | null;
          system_prompt?: string | null;
          schedule_type?: string | null;
          is_active?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      ai_agent_runs: {
        Row: {
          id: string;
          organization_id: string;
          agent_id: string;
          triggered_by: string | null;
          trigger_type: string;
          status: AiAgentRunStatus;
          input: Json;
          output: Json;
          summary: string | null;
          error: string | null;
          started_at: string | null;
          finished_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          agent_id: string;
          triggered_by?: string | null;
          trigger_type?: string;
          status?: AiAgentRunStatus;
          input?: Json;
          output?: Json;
          summary?: string | null;
          error?: string | null;
          started_at?: string | null;
          finished_at?: string | null;
          created_at?: string;
        };
        Update: {
          organization_id?: string;
          agent_id?: string;
          triggered_by?: string | null;
          trigger_type?: string;
          status?: AiAgentRunStatus;
          input?: Json;
          output?: Json;
          summary?: string | null;
          error?: string | null;
          started_at?: string | null;
          finished_at?: string | null;
        };
        Relationships: [];
      };
      ai_agent_deliveries: {
        Row: {
          id: string;
          organization_id: string;
          agent_run_id: string;
          user_id: string;
          delivery_type: string;
          read_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          agent_run_id: string;
          user_id: string;
          delivery_type?: string;
          read_at?: string | null;
          created_at?: string;
        };
        Update: {
          organization_id?: string;
          agent_run_id?: string;
          user_id?: string;
          delivery_type?: string;
          read_at?: string | null;
        };
        Relationships: [];
      };
      service_import_batches: {
        Row: {
          id: string;
          organization_id: string;
          uploaded_by: string | null;
          source: string;
          filename: string | null;
          total_rows: number;
          imported_count: number;
          skipped_count: number;
          error_count: number;
          dry_run: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          uploaded_by?: string | null;
          source?: string;
          filename?: string | null;
          total_rows?: number;
          imported_count?: number;
          skipped_count?: number;
          error_count?: number;
          dry_run?: boolean;
          created_at?: string;
        };
        Update: {
          organization_id?: string;
          uploaded_by?: string | null;
          source?: string;
          filename?: string | null;
          total_rows?: number;
          imported_count?: number;
          skipped_count?: number;
          error_count?: number;
          dry_run?: boolean;
        };
        Relationships: [];
      };
      assistant_conversations: {
        Row: BaseRow & {
          organization_id: string;
          user_id: string;
          title: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          user_id: string;
          title?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          organization_id?: string;
          user_id?: string;
          title?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      assistant_messages: {
        Row: {
          id: string;
          organization_id: string;
          conversation_id: string;
          user_id: string;
          role: "user" | "assistant";
          content: string;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          conversation_id: string;
          user_id: string;
          role: "user" | "assistant";
          content: string;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          organization_id?: string;
          conversation_id?: string;
          user_id?: string;
          role?: "user" | "assistant";
          content?: string;
          metadata?: Json;
        };
        Relationships: [];
      };
      assistant_intents: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          category: string | null;
          examples: Json;
          patterns: Json;
          action_name: string;
          enabled: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          category?: string | null;
          examples?: Json;
          patterns?: Json;
          action_name: string;
          enabled?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          description?: string | null;
          category?: string | null;
          examples?: Json;
          patterns?: Json;
          action_name?: string;
          enabled?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      assistant_intent_examples: {
        Row: {
          id: string;
          intent_id: string;
          raw_text: string;
          normalized_text: string;
          source: string;
          source_file: string | null;
          source_line: number | null;
          synonym: string | null;
          params_sample: Json;
          entities_sample: Json;
          requires_confirmation: boolean | null;
          confidence: number | null;
          is_real_data: boolean;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          intent_id: string;
          raw_text: string;
          normalized_text: string;
          source?: string;
          source_file?: string | null;
          source_line?: number | null;
          synonym?: string | null;
          params_sample?: Json;
          entities_sample?: Json;
          requires_confirmation?: boolean | null;
          confidence?: number | null;
          is_real_data?: boolean;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          intent_id?: string;
          raw_text?: string;
          normalized_text?: string;
          source?: string;
          source_file?: string | null;
          source_line?: number | null;
          synonym?: string | null;
          params_sample?: Json;
          entities_sample?: Json;
          requires_confirmation?: boolean | null;
          confidence?: number | null;
          is_real_data?: boolean;
          is_active?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      assistant_dataset_imports: {
        Row: {
          id: string;
          source_file: string;
          source_hash: string | null;
          total_lines: number;
          imported_count: number;
          skipped_count: number;
          duplicate_count: number;
          unknown_count: number;
          imported_at: string;
          notes: string | null;
        };
        Insert: {
          id?: string;
          source_file: string;
          source_hash?: string | null;
          total_lines?: number;
          imported_count?: number;
          skipped_count?: number;
          duplicate_count?: number;
          unknown_count?: number;
          imported_at?: string;
          notes?: string | null;
        };
        Update: {
          source_file?: string;
          source_hash?: string | null;
          total_lines?: number;
          imported_count?: number;
          skipped_count?: number;
          duplicate_count?: number;
          unknown_count?: number;
          notes?: string | null;
        };
        Relationships: [];
      };
      assistant_action_logs: {
        Row: {
          id: string;
          organization_id: string;
          user_id: string;
          conversation_id: string | null;
          message_id: string | null;
          action_name: string;
          input: Json;
          output: Json;
          status: "ok" | "needs_confirmation" | "error";
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          user_id: string;
          conversation_id?: string | null;
          message_id?: string | null;
          action_name: string;
          input?: Json;
          output?: Json;
          status: "ok" | "needs_confirmation" | "error";
          created_at?: string;
        };
        Update: {
          organization_id?: string;
          user_id?: string;
          conversation_id?: string | null;
          message_id?: string | null;
          action_name?: string;
          input?: Json;
          output?: Json;
          status?: "ok" | "needs_confirmation" | "error";
        };
        Relationships: [];
      };
      assistant_tasks: {
        Row: BaseRow & {
          organization_id: string;
          user_id: string;
          client_id: string | null;
          service_card_id: string | null;
          title: string;
          description: string | null;
          due_date: string | null;
          status: "pending" | "done" | "canceled";
        };
        Insert: {
          id?: string;
          organization_id: string;
          user_id: string;
          client_id?: string | null;
          service_card_id?: string | null;
          title: string;
          description?: string | null;
          due_date?: string | null;
          status?: "pending" | "done" | "canceled";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          organization_id?: string;
          user_id?: string;
          client_id?: string | null;
          service_card_id?: string | null;
          title?: string;
          description?: string | null;
          due_date?: string | null;
          status?: "pending" | "done" | "canceled";
          updated_at?: string;
        };
        Relationships: [];
      };
      assistant_feedback: {
        Row: {
          id: string;
          organization_id: string | null;
          user_id: string;
          conversation_id: string | null;
          message_id: string | null;
          message_text: string;
          assistant_response: string;
          detected_intent: string | null;
          detected_params: Json;
          rating: "positive" | "negative";
          correction_text: string | null;
          corrected_intent: string | null;
          corrected_params: Json | null;
          source: string | null;
          conversation_context: Json;
          is_resolved: boolean;
          resolved_at: string | null;
          resolved_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id?: string | null;
          user_id: string;
          conversation_id?: string | null;
          message_id?: string | null;
          message_text: string;
          assistant_response: string;
          detected_intent?: string | null;
          detected_params?: Json;
          rating: "positive" | "negative";
          correction_text?: string | null;
          corrected_intent?: string | null;
          corrected_params?: Json | null;
          source?: string | null;
          conversation_context?: Json;
          is_resolved?: boolean;
          resolved_at?: string | null;
          resolved_by?: string | null;
          created_at?: string;
        };
        Update: {
          detected_intent?: string | null;
          detected_params?: Json;
          rating?: "positive" | "negative";
          correction_text?: string | null;
          corrected_intent?: string | null;
          corrected_params?: Json | null;
          source?: string | null;
          conversation_context?: Json;
          is_resolved?: boolean;
          resolved_at?: string | null;
          resolved_by?: string | null;
        };
        Relationships: [];
      };
      assistant_global_learning_examples: {
        Row: {
          id: string;
          promoted_from_feedback_id: string | null;
          original_sanitized: string;
          correction_sanitized: string;
          corrected_intent: string | null;
          params_schema: Json;
          source: string;
          is_sanitized: boolean;
          privacy_level: "global_sanitized";
          needs_review: boolean;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          promoted_from_feedback_id?: string | null;
          original_sanitized: string;
          correction_sanitized: string;
          corrected_intent?: string | null;
          params_schema?: Json;
          source?: string;
          is_sanitized?: boolean;
          privacy_level?: "global_sanitized";
          needs_review?: boolean;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          promoted_from_feedback_id?: string | null;
          original_sanitized?: string;
          correction_sanitized?: string;
          corrected_intent?: string | null;
          params_schema?: Json;
          source?: string;
          is_sanitized?: boolean;
          privacy_level?: "global_sanitized";
          needs_review?: boolean;
          is_active?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      daily_checklists: {
        Row: BaseRow & {
          organization_id: string;
          user_id: string;
          checklist_date: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          user_id: string;
          checklist_date: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          organization_id?: string;
          user_id?: string;
          checklist_date?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      daily_checklist_items: {
        Row: BaseRow & {
          checklist_id: string;
          organization_id: string;
          assigned_to: string;
          created_by: string;
          title: string;
          description: string | null;
          status: "open" | "done" | "canceled";
          is_emergency: boolean;
          source: "self" | "owner_assignment" | "assistant";
          related_service_id: string | null;
          due_date: string | null;
          completed_at: string | null;
          deleted_at: string | null;
          archived_at: string | null;
        };
        Insert: {
          id?: string;
          checklist_id: string;
          organization_id: string;
          assigned_to: string;
          created_by: string;
          title: string;
          description?: string | null;
          status?: "open" | "done" | "canceled";
          is_emergency?: boolean;
          source?: "self" | "owner_assignment" | "assistant";
          related_service_id?: string | null;
          due_date?: string | null;
          completed_at?: string | null;
          deleted_at?: string | null;
          archived_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          checklist_id?: string;
          organization_id?: string;
          assigned_to?: string;
          created_by?: string;
          title?: string;
          description?: string | null;
          status?: "open" | "done" | "canceled";
          is_emergency?: boolean;
          source?: "self" | "owner_assignment" | "assistant";
          related_service_id?: string | null;
          due_date?: string | null;
          completed_at?: string | null;
          deleted_at?: string | null;
          archived_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      organization_activity_log: {
        Row: {
          id: string;
          organization_id: string;
          actor_user_id: string;
          target_user_id: string | null;
          activity_type: string;
          entity_type: string | null;
          entity_id: string | null;
          metadata: Json;
          occurred_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          actor_user_id: string;
          target_user_id?: string | null;
          activity_type: string;
          entity_type?: string | null;
          entity_id?: string | null;
          metadata?: Json;
          occurred_at?: string;
        };
        Update: never;
        Relationships: [];
      };
      audit_logs: {
        Row: {
          id: string;
          actor_id: string | null;
          action: string;
          entity_type: string;
          entity_id: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          actor_id?: string | null;
          action: string;
          entity_type: string;
          entity_id?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: never;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      can_request_password_reset: {
        Args: {
          p_email: string;
          p_birth_date: string;
        };
        Returns: boolean;
      };
      create_organization_for_current_user: {
        Args: {
          p_name: string;
          p_document_number?: string | null;
          p_phone?: string | null;
          p_email?: string | null;
          p_address?: string | null;
          p_city?: string | null;
          p_state?: string | null;
          p_notes?: string | null;
        };
        Returns: Array<{
          organization_id: string;
          join_code: string;
        }>;
      };
      join_organization_by_code: {
        Args: {
          p_join_code: string;
        };
        Returns: Array<{
          organization_id: string;
          role: string;
        }>;
      };
      get_organization_usage: {
        Args: {
          p_organization_id: string;
        };
        Returns: Array<{
          users_count: number;
          storage_used_mb: number;
          services_count: number;
          documents_count: number;
        }>;
      };
      reserve_document_storage: {
        Args: {
          p_organization_id: string;
          p_size_bytes: number;
        };
        Returns: boolean;
      };
      confirm_document_storage: {
        Args: {
          p_organization_id: string;
          p_size_bytes: number;
        };
        Returns: undefined;
      };
      release_document_storage: {
        Args: {
          p_organization_id: string;
          p_size_bytes: number;
        };
        Returns: undefined;
      };
      remove_document_storage: {
        Args: {
          p_organization_id: string;
          p_size_bytes: number;
        };
        Returns: undefined;
      };
      find_alerts_by_car_app: {
        Args: {
          p_cod_car: string;
          p_include_nearby?: boolean;
          p_buffer_meters?: number;
          p_limit?: number;
        };
        Returns: Array<{
          id: string;
          organization_id: string | null;
          layer_type: string;
          provider: string | null;
          reference_year: string | null;
          name: string;
          cod_car: string | null;
          cod_imovel: string | null;
          alert_code: number | null;
          codigo_alerta: string | null;
          alert_date: string | null;
          area_ha: number | null;
          area_intersecao_ha: number | null;
          area_alerta_ha: number | null;
          distance_m: number | null;
          match_type: string;
          is_spatially_confirmed: boolean;
          is_nearby_only: boolean;
          attributes: Json;
          geom_geojson: Json | null;
          bbox: Json | null;
          source_id: string | null;
          created_at: string;
        }>;
      };
      find_sigef_matches_by_car: {
        Args: {
          p_cod_car: string;
          p_min_car_overlap?: number;
          p_limit?: number;
          p_buffer_meters?: number;
        };
        Returns: Array<{
          id: string;
          organization_id: string | null;
          sigef_code: string | null;
          cnir: string | null;
          codigo_imovel: string | null;
          certificacao: string | null;
          situacao: string | null;
          municipio: string | null;
          uf: string | null;
          area_ha: number | null;
          data_certificacao: string | null;
          attributes: Json;
          geom_geojson: Json | null;
          intersection_area_ha: number | null;
          car_area_ha: number | null;
          incra_area_ha: number | null;
          car_overlap_ratio: number | null;
          incra_overlap_ratio: number | null;
        }>;
      };
      find_sigef_matches_by_car_app: {
        Args: {
          p_cod_car: string;
          p_min_car_overlap?: number;
          p_limit?: number;
          p_buffer_meters?: number;
        };
        Returns: Array<{
          id: string;
          organization_id: string | null;
          sigef_code: string | null;
          cnir: string | null;
          codigo_imovel: string | null;
          certificacao: string | null;
          situacao: string | null;
          municipio: string | null;
          uf: string | null;
          area_ha: number | null;
          data_certificacao: string | null;
          attributes: Json;
          geom_geojson: Json | null;
          intersection_area_ha: number | null;
          car_area_ha: number | null;
          incra_area_ha: number | null;
          car_overlap_ratio: number | null;
          incra_overlap_ratio: number | null;
        }>;
      };
      refresh_geoquery_geometries: {
        Args: {
          p_force?: boolean;
        };
        Returns: Array<{
          table_name: string;
          updated_count: number;
        }>;
      };
      refresh_alert_geom_batch: {
        Args: {
          p_limit?: number;
        };
        Returns: Array<{
          table_name: string;
          processed_count: number;
          updated_count: number;
          skipped_count: number;
        }>;
      };
      find_assistant_intent_examples: {
        Args: {
          p_normalized_text: string;
          p_limit?: number;
        };
        Returns: Array<{
          raw_text: string;
          normalized_text: string;
          synonym: string | null;
          intent_name: string;
          action_name: string;
        }>;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type Client = Database["public"]["Tables"]["clients"]["Row"];
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Plan = Database["public"]["Tables"]["plans"]["Row"];
export type Organization = Database["public"]["Tables"]["organizations"]["Row"];
export type OrganizationMember = Database["public"]["Tables"]["organization_members"]["Row"];
export type OrganizationJoinCode = Database["public"]["Tables"]["organization_join_codes"]["Row"];
export type OrganizationSubscription =
  Database["public"]["Tables"]["organization_subscriptions"]["Row"];
export type BillingOrder = Database["public"]["Tables"]["billing_orders"]["Row"];
export type CompanySettings = Database["public"]["Tables"]["company_settings"]["Row"];
export type CompanyService = Database["public"]["Tables"]["company_services"]["Row"];
export type Property = Database["public"]["Tables"]["properties"]["Row"];
export type PropertyGeometry = Database["public"]["Tables"]["property_geometries"]["Row"];
export type GeoDataSource = Database["public"]["Tables"]["geo_data_sources"]["Row"];
export type CarProperty = Database["public"]["Tables"]["car_properties"]["Row"];
export type IncraProperty = Database["public"]["Tables"]["incra_properties"]["Row"];
export type SigefSpatialMatch =
  Database["public"]["Functions"]["find_sigef_matches_by_car"]["Returns"][number];
export type GeoAlertLayer = Database["public"]["Tables"]["geo_alert_layers"]["Row"];
export type GeoAlertSearchMatch =
  Database["public"]["Functions"]["find_alerts_by_car_app"]["Returns"][number];
export type GeoThematicLayer = Database["public"]["Tables"]["geo_thematic_layers"]["Row"];
export type PropertySearch = Database["public"]["Tables"]["property_searches"]["Row"];
export type PropertySearchResult = Database["public"]["Tables"]["property_search_results"]["Row"];
export type PropertyDocument = Database["public"]["Tables"]["property_documents"]["Row"];
export type Proposal = Database["public"]["Tables"]["proposals"]["Row"];
export type ServiceBoard = Database["public"]["Tables"]["service_boards"]["Row"];
export type ServiceColumn = Database["public"]["Tables"]["service_columns"]["Row"];
export type ServiceCard = Database["public"]["Tables"]["service_cards"]["Row"];
export type ServiceMember = Database["public"]["Tables"]["service_members"]["Row"];
export type ServiceEvent = Database["public"]["Tables"]["service_events"]["Row"];
export type ServiceImportBatch = Database["public"]["Tables"]["service_import_batches"]["Row"];
export type ServicePropertyInfo = Database["public"]["Tables"]["service_property_infos"]["Row"];
export type TeamMember = Database["public"]["Tables"]["team_members"]["Row"];
export type WorkTimeDay = Database["public"]["Tables"]["work_time_days"]["Row"];
export type WorkTimeSession = Database["public"]["Tables"]["work_time_sessions"]["Row"];
export type WorkTimeEvent = Database["public"]["Tables"]["work_time_events"]["Row"];
export type CompanyHoliday = Database["public"]["Tables"]["company_holidays"]["Row"];
export type TeamChatMessage = Database["public"]["Tables"]["team_chat_messages"]["Row"];
export type TeamChatRead = Database["public"]["Tables"]["team_chat_reads"]["Row"];
export type UserIntegration = Database["public"]["Tables"]["user_integrations"]["Row"];
export type CalendarEventSync = Database["public"]["Tables"]["calendar_event_syncs"]["Row"];
export type Notification = Database["public"]["Tables"]["notifications"]["Row"];
export type AgendaReminder = Database["public"]["Tables"]["agenda_reminders"]["Row"];
export type AgendaReminderRecipient = Database["public"]["Tables"]["agenda_reminder_recipients"]["Row"];
export type RecurringExpense = Database["public"]["Tables"]["recurring_expenses"]["Row"];
export type Contract = Database["public"]["Tables"]["contracts"]["Row"];
export type ProposalService = Database["public"]["Tables"]["proposal_services"]["Row"];
export type ContractService = Database["public"]["Tables"]["contract_services"]["Row"];
export type PaymentInstallment = Database["public"]["Tables"]["payment_installments"]["Row"];
export type Revenue = Database["public"]["Tables"]["revenues"]["Row"];
export type Expense = Database["public"]["Tables"]["expenses"]["Row"];
export type FinanceTransfer = Database["public"]["Tables"]["finance_transfers"]["Row"];
export type CompanyKnowledgeCategory =
  Database["public"]["Tables"]["company_knowledge_categories"]["Row"];
export type CompanyKnowledgeItem =
  Database["public"]["Tables"]["company_knowledge_items"]["Row"];
export type CompanyKnowledgeBlock =
  Database["public"]["Tables"]["company_knowledge_blocks"]["Row"];
export type CompanyKnowledgeChecklistItem =
  Database["public"]["Tables"]["company_knowledge_checklist_items"]["Row"];
export type HrDocument = Database["public"]["Tables"]["hr_documents"]["Row"];
export type ProfessionalDocument = Database["public"]["Tables"]["documents"]["Row"];
export type DocumentChunk = Database["public"]["Tables"]["document_chunks"]["Row"];
export type DocumentProcessingJob = Database["public"]["Tables"]["document_processing_jobs"]["Row"];
export type AiAgent = Database["public"]["Tables"]["ai_agents"]["Row"];
export type AiAgentRun = Database["public"]["Tables"]["ai_agent_runs"]["Row"];
export type AiAgentDelivery = Database["public"]["Tables"]["ai_agent_deliveries"]["Row"];
export type HrAbsence = Database["public"]["Tables"]["hr_absences"]["Row"];
export type HrBirthday = Database["public"]["Tables"]["hr_birthdays"]["Row"];
export type RoutineItem = Database["public"]["Tables"]["routine_items"]["Row"];
export type AssistantConversation = Database["public"]["Tables"]["assistant_conversations"]["Row"];
export type AssistantMessage = Database["public"]["Tables"]["assistant_messages"]["Row"];
export type AssistantIntent = Database["public"]["Tables"]["assistant_intents"]["Row"];
export type AssistantIntentExample = Database["public"]["Tables"]["assistant_intent_examples"]["Row"];
export type AssistantDatasetImport = Database["public"]["Tables"]["assistant_dataset_imports"]["Row"];
export type AssistantActionLog = Database["public"]["Tables"]["assistant_action_logs"]["Row"];
export type AssistantTask = Database["public"]["Tables"]["assistant_tasks"]["Row"];
export type AssistantFeedback = Database["public"]["Tables"]["assistant_feedback"]["Row"];
export type AssistantGlobalLearningExample = Database["public"]["Tables"]["assistant_global_learning_examples"]["Row"];
export type DailyChecklist = Database["public"]["Tables"]["daily_checklists"]["Row"];
export type DailyChecklistItem = Database["public"]["Tables"]["daily_checklist_items"]["Row"];
export type OrganizationActivityLog = Database["public"]["Tables"]["organization_activity_log"]["Row"];
