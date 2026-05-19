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
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
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
          created_at?: string;
          updated_at?: string;
        };
        Update: {
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
          updated_at?: string;
        };
        Relationships: [];
      };
      plans: {
        Row: {
          id: string;
          name: string;
          slug: string;
          price_monthly: number;
          max_users: number;
          storage_quota_mb: number;
          max_proposals_per_month: number | null;
          max_contracts_per_month: number | null;
          max_finance_records_per_month: number | null;
          features: Json;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          price_monthly?: number;
          max_users?: number;
          storage_quota_mb?: number;
          max_proposals_per_month?: number | null;
          max_contracts_per_month?: number | null;
          max_finance_records_per_month?: number | null;
          features?: Json;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          name?: string;
          slug?: string;
          price_monthly?: number;
          max_users?: number;
          storage_quota_mb?: number;
          max_proposals_per_month?: number | null;
          max_contracts_per_month?: number | null;
          max_finance_records_per_month?: number | null;
          features?: Json;
          is_active?: boolean;
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
          storage_used_bytes: number;
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
          storage_used_bytes?: number;
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
          storage_used_bytes?: number;
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
          priority: Priority;
          due_date: string | null;
          checklist_percent: number | null;
          custom_fields_json: Json;
          position: number;
          created_from_proposal_id: string | null;
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
          priority?: Priority;
          due_date?: string | null;
          checklist_percent?: number | null;
          custom_fields_json?: Json;
          position?: number;
          created_from_proposal_id?: string | null;
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
          priority?: Priority;
          due_date?: string | null;
          checklist_percent?: number | null;
          custom_fields_json?: Json;
          position?: number;
          created_from_proposal_id?: string | null;
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
          notes?: string | null;
          status?: "active" | "inactive";
          created_by?: string | null;
          updated_at?: string;
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
          service_card_id: string;
          title: string;
          position: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          service_card_id: string;
          title: string;
          position?: number;
          created_at?: string;
        };
        Update: {
          service_card_id?: string;
          title?: string;
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
          position: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          checklist_id: string;
          title: string;
          is_done?: boolean;
          position?: number;
          created_at?: string;
        };
        Update: {
          checklist_id?: string;
          title?: string;
          is_done?: boolean;
          position?: number;
        };
        Relationships: [];
      };
      attachments: {
        Row: {
          id: string;
          organization_id: string | null;
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
          due_date: string;
          paid_at: string | null;
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
          due_date: string;
          paid_at?: string | null;
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
          due_date?: string;
          paid_at?: string | null;
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
          due_date: string;
          paid_at: string | null;
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
          due_date: string;
          paid_at?: string | null;
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
          due_date?: string;
          paid_at?: string | null;
          status?: FinanceStatus;
          updated_at?: string;
        };
        Relationships: [];
      };
      document_templates: {
        Row: BaseRow & {
          organization_id: string | null;
          title: string;
          category: string;
          version: string;
          status: DocumentStatus;
          description: string | null;
          file_path: string | null;
        };
        Insert: {
          id?: string;
          organization_id?: string | null;
          title: string;
          category: string;
          version: string;
          status?: DocumentStatus;
          description?: string | null;
          file_path?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          title?: string;
          organization_id?: string | null;
          category?: string;
          version?: string;
          status?: DocumentStatus;
          description?: string | null;
          file_path?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      legislation_items: {
        Row: BaseRow & {
          organization_id: string | null;
          title: string;
          category: string;
          official_link: string | null;
          technical_summary: string | null;
          practical_points: string | null;
          status: LegislationStatus;
        };
        Insert: {
          id?: string;
          organization_id?: string | null;
          title: string;
          category: string;
          official_link?: string | null;
          technical_summary?: string | null;
          practical_points?: string | null;
          status?: LegislationStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          title?: string;
          organization_id?: string | null;
          category?: string;
          official_link?: string | null;
          technical_summary?: string | null;
          practical_points?: string | null;
          status?: LegislationStatus;
          updated_at?: string;
        };
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
export type TeamMember = Database["public"]["Tables"]["team_members"]["Row"];
export type RecurringExpense = Database["public"]["Tables"]["recurring_expenses"]["Row"];
export type Contract = Database["public"]["Tables"]["contracts"]["Row"];
export type ProposalService = Database["public"]["Tables"]["proposal_services"]["Row"];
export type ContractService = Database["public"]["Tables"]["contract_services"]["Row"];
export type PaymentInstallment = Database["public"]["Tables"]["payment_installments"]["Row"];
export type Revenue = Database["public"]["Tables"]["revenues"]["Row"];
export type Expense = Database["public"]["Tables"]["expenses"]["Row"];
