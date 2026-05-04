export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRole = "admin" | "gerente" | "tecnico" | "financeiro" | "leitura";
export type ClientKind = "pf" | "pj";
export type InteractionType = "ligacao" | "email" | "reuniao" | "whatsapp" | "nota";
export type ProposalStage =
  | "todo"
  | "sent"
  | "negotiation"
  | "execution"
  | "finished"
  | "lost";
export type Priority = "low" | "medium" | "high" | "urgent";
export type FinanceStatus = "pending" | "paid" | "overdue";
export type DocumentStatus = "vigente" | "obsoleto";
export type LegislationStatus = "vigente" | "revogado" | "atencao";
export type ContractStatus =
  | "contrato_a_gerar"
  | "contrato_gerado"
  | "enviado_para_assinatura"
  | "assinado"
  | "em_execucao"
  | "finalizado"
  | "cancelado";
export type AttachmentEntityType =
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
          full_name: string | null;
          phone: string | null;
          role: UserRole;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          phone?: string | null;
          role?: UserRole;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          full_name?: string | null;
          phone?: string | null;
          role?: UserRole;
          updated_at?: string;
        };
        Relationships: [];
      };
      clients: {
        Row: BaseRow & {
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
          client_id: string;
          type: InteractionType;
          occurred_at: string;
          responsible_id: string | null;
          description: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          type: InteractionType;
          occurred_at?: string;
          responsible_id?: string | null;
          description: string;
          created_at?: string;
        };
        Update: {
          client_id?: string;
          type?: InteractionType;
          occurred_at?: string;
          responsible_id?: string | null;
          description?: string;
        };
        Relationships: [];
      };
      proposals: {
        Row: BaseRow & {
          client_id: string;
          title: string;
          description: string | null;
          value: number | null;
          owner_id: string | null;
          sent_at: string | null;
          valid_until: string | null;
          comments: string | null;
          stage: ProposalStage;
          position: number;
          converted_service_card_id: string | null;
        };
        Insert: {
          id?: string;
          client_id: string;
          title: string;
          description?: string | null;
          value?: number | null;
          owner_id?: string | null;
          sent_at?: string | null;
          valid_until?: string | null;
          comments?: string | null;
          stage?: ProposalStage;
          position?: number;
          converted_service_card_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          client_id?: string;
          title?: string;
          description?: string | null;
          value?: number | null;
          owner_id?: string | null;
          sent_at?: string | null;
          valid_until?: string | null;
          comments?: string | null;
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
          column_id: string;
          client_id: string | null;
          owner_id: string | null;
          proposal_id: string | null;
          contract_id: string | null;
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
          column_id: string;
          client_id?: string | null;
          owner_id?: string | null;
          proposal_id?: string | null;
          contract_id?: string | null;
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
          client_id?: string | null;
          owner_id?: string | null;
          proposal_id?: string | null;
          contract_id?: string | null;
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
      contracts: {
        Row: BaseRow & {
          client_id: string;
          proposal_id: string | null;
          service_card_id: string | null;
          title: string;
          description: string | null;
          amount: number | null;
          status: ContractStatus;
          pdf_file_path: string | null;
          sent_at: string | null;
          signed_at: string | null;
          starts_at: string | null;
          ends_at: string | null;
          important_dates_json: Json;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          client_id: string;
          proposal_id?: string | null;
          service_card_id?: string | null;
          title: string;
          description?: string | null;
          amount?: number | null;
          status?: ContractStatus;
          pdf_file_path?: string | null;
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
          proposal_id?: string | null;
          service_card_id?: string | null;
          title?: string;
          description?: string | null;
          amount?: number | null;
          status?: ContractStatus;
          pdf_file_path?: string | null;
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
          entity_type: AttachmentEntityType;
          entity_id: string;
          file_path: string;
          file_name: string;
          mime_type: string | null;
          size_bytes: number | null;
          uploaded_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          entity_type: AttachmentEntityType;
          entity_id: string;
          file_path: string;
          file_name: string;
          mime_type?: string | null;
          size_bytes?: number | null;
          uploaded_by?: string | null;
          created_at?: string;
        };
        Update: {
          entity_type?: AttachmentEntityType;
          entity_id?: string;
          file_path?: string;
          file_name?: string;
          mime_type?: string | null;
          size_bytes?: number | null;
          uploaded_by?: string | null;
        };
        Relationships: [];
      };
      revenues: {
        Row: BaseRow & {
          client_id: string;
          proposal_id: string | null;
          service_card_id: string | null;
          contract_id: string | null;
          description: string;
          category: string;
          amount: number;
          due_date: string;
          paid_at: string | null;
          status: FinanceStatus;
        };
        Insert: {
          id?: string;
          client_id: string;
          proposal_id?: string | null;
          service_card_id?: string | null;
          contract_id?: string | null;
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
          proposal_id?: string | null;
          service_card_id?: string | null;
          contract_id?: string | null;
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
          client_id: string | null;
          proposal_id: string | null;
          service_card_id: string | null;
          description: string;
          category: string;
          amount: number;
          due_date: string;
          paid_at: string | null;
          status: FinanceStatus;
        };
        Insert: {
          id?: string;
          client_id?: string | null;
          proposal_id?: string | null;
          service_card_id?: string | null;
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
          proposal_id?: string | null;
          service_card_id?: string | null;
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
          title: string;
          category: string;
          version: string;
          status: DocumentStatus;
          description: string | null;
          file_path: string | null;
        };
        Insert: {
          id?: string;
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
          title: string;
          category: string;
          official_link: string | null;
          technical_summary: string | null;
          practical_points: string | null;
          status: LegislationStatus;
        };
        Insert: {
          id?: string;
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
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type Client = Database["public"]["Tables"]["clients"]["Row"];
export type Proposal = Database["public"]["Tables"]["proposals"]["Row"];
export type ServiceBoard = Database["public"]["Tables"]["service_boards"]["Row"];
export type ServiceColumn = Database["public"]["Tables"]["service_columns"]["Row"];
export type ServiceCard = Database["public"]["Tables"]["service_cards"]["Row"];
export type Contract = Database["public"]["Tables"]["contracts"]["Row"];
export type Revenue = Database["public"]["Tables"]["revenues"]["Row"];
export type Expense = Database["public"]["Tables"]["expenses"]["Row"];
