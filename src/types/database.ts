// ============================================================
// LES TRAITEURS ENGAGÉS — Types TypeScript générés depuis le schéma
// ============================================================

export type UserRole = "client_admin" | "client_user" | "caterer" | "super_admin";

export type QuoteRequestStatus =
  | "draft"
  | "pending_review"
  | "approved"
  | "sent_to_caterers"
  | "completed"
  | "cancelled";

export type QuoteRequestCatererStatus =
  | "selected"
  | "responded"
  | "transmitted_to_client"
  | "rejected";

export type QuoteStatus = "draft" | "sent" | "accepted" | "refused" | "expired";

export type OrderStatus =
  | "confirmed"
  | "in_progress"
  | "delivered"
  | "invoiced"
  | "paid"
  | "disputed";

export type InvoiceStatus = "pending" | "paid" | "overdue";

export type MealType =
  | "dejeuner"
  | "diner"
  | "cocktail"
  | "petit_dejeuner"
  | "autre";

// ============================================================
// Database schema type (pour Supabase client générique)
// ============================================================

export type Database = {
  public: {
    Tables: {
      companies: {
        Row: Company;
        Insert: CompanyInsert;
        Update: Partial<CompanyInsert>;
      };
      caterers: {
        Row: Caterer;
        Insert: CatererInsert;
        Update: Partial<CatererInsert>;
      };
      users: {
        Row: UserProfile;
        Insert: UserProfileInsert;
        Update: Partial<UserProfileInsert>;
      };
      quote_requests: {
        Row: QuoteRequest;
        Insert: QuoteRequestInsert;
        Update: Partial<QuoteRequestInsert>;
      };
      quote_request_caterers: {
        Row: QuoteRequestCaterer;
        Insert: QuoteRequestCatererInsert;
        Update: Partial<QuoteRequestCatererInsert>;
      };
      quotes: {
        Row: Quote;
        Insert: QuoteInsert;
        Update: Partial<QuoteInsert>;
      };
      orders: {
        Row: Order;
        Insert: OrderInsert;
        Update: Partial<OrderInsert>;
      };
      invoices: {
        Row: Invoice;
        Insert: InvoiceInsert;
        Update: Partial<InvoiceInsert>;
      };
      commission_invoices: {
        Row: CommissionInvoice;
        Insert: CommissionInvoiceInsert;
        Update: Partial<CommissionInvoiceInsert>;
      };
      notifications: {
        Row: Notification;
        Insert: NotificationInsert;
        Update: Partial<NotificationInsert>;
      };
      messages: {
        Row: Message;
        Insert: MessageInsert;
        Update: Partial<MessageInsert>;
      };
    };
    Views: Record<string, never>;
    Functions: {
      auth_role: { Args: Record<string, never>; Returns: UserRole };
      auth_company_id: { Args: Record<string, never>; Returns: string };
      auth_caterer_id: { Args: Record<string, never>; Returns: string };
    };
    Enums: {
      user_role: UserRole;
      quote_request_status: QuoteRequestStatus;
      quote_request_caterer_status: QuoteRequestCatererStatus;
      quote_status: QuoteStatus;
      order_status: OrderStatus;
      invoice_status: InvoiceStatus;
      meal_type: MealType;
    };
  };
};

// ============================================================
// ENTITY TYPES
// ============================================================

export type Company = {
  id: string;
  name: string;
  siret: string | null;
  address: string | null;
  city: string | null;
  zip_code: string | null;
  oeth_eligible: boolean;
  budget_annual: number | null;
  created_at: string;
  updated_at: string;
};

export type CompanyInsert = Omit<Company, "id" | "created_at" | "updated_at">;

export type Caterer = {
  id: string;
  name: string;
  siret: string | null;
  esat_status: boolean;
  address: string | null;
  city: string | null;
  zip_code: string | null;
  description: string | null;
  specialties: string[];
  photos: string[];
  capacity_min: number | null;
  capacity_max: number | null;
  is_validated: boolean;
  commission_rate: number;
  created_at: string;
  updated_at: string;
};

export type CatererInsert = Omit<Caterer, "id" | "created_at" | "updated_at">;

export type UserProfile = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: UserRole;
  company_id: string | null;
  caterer_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type UserProfileInsert = Omit<
  UserProfile,
  "id" | "created_at" | "updated_at"
>;

export type QuoteRequest = {
  id: string;
  title: string;
  client_user_id: string;
  company_id: string;
  event_date: string;
  event_start_time: string | null;
  event_end_time: string | null;
  event_address: string;
  guest_count: number;
  budget_global: number | null;
  budget_per_person: number | null;
  budget_flexibility: "none" | "5" | "10" | null;
  meal_type: MealType;
  is_full_day: boolean;
  meal_type_secondary: MealType | null;
  dietary_vegetarian: boolean;
  dietary_vegan: boolean;
  dietary_halal: boolean;
  dietary_kosher: boolean;
  dietary_gluten_free: boolean;
  dietary_other: string | null;
  drinks_included: boolean;
  drinks_details: string | null;
  service_waitstaff: boolean;
  service_equipment: boolean;
  service_decoration: boolean;
  service_other: string | null;
  description: string | null;
  status: QuoteRequestStatus;
  super_admin_notes: string | null;
  created_at: string;
  updated_at: string;
};

export type QuoteRequestInsert = Omit<
  QuoteRequest,
  "id" | "created_at" | "updated_at"
>;

export type QuoteRequestCaterer = {
  id: string;
  quote_request_id: string;
  caterer_id: string;
  status: QuoteRequestCatererStatus;
  responded_at: string | null;
  response_rank: number | null;
  created_at: string;
};

export type QuoteRequestCatererInsert = Omit<
  QuoteRequestCaterer,
  "id" | "created_at"
>;

export type QuoteDetail = {
  label: string;
  quantity: number;
  unit_price_ht: number;
  total_ht: number;
  description?: string;
};

export type Quote = {
  id: string;
  quote_request_id: string;
  caterer_id: string;
  total_amount_ht: number;
  amount_per_person: number | null;
  valorisable_agefiph: number | null;
  details: QuoteDetail[];
  valid_until: string | null;
  status: QuoteStatus;
  created_at: string;
  updated_at: string;
};

export type QuoteInsert = Omit<Quote, "id" | "created_at" | "updated_at">;

export type Order = {
  id: string;
  quote_id: string;
  client_admin_id: string;
  status: OrderStatus;
  delivery_date: string;
  delivery_address: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type OrderInsert = Omit<Order, "id" | "created_at" | "updated_at">;

export type Invoice = {
  id: string;
  esat_invoice_ref: string | null; // référence fournie par l'ESAT — jamais générée par la plateforme
  order_id: string;
  caterer_id: string;
  amount_ht: number;
  tva_rate: number;
  amount_ttc: number;
  valorisable_agefiph: number | null;
  esat_mention: string | null;
  issued_at: string | null;
  due_at: string | null;
  paid_at: string | null;
  status: InvoiceStatus;
  created_at: string;
  updated_at: string;
};

export type InvoiceInsert = Omit<Invoice, "id" | "created_at" | "updated_at">;

export type CommissionInvoice = {
  id: string;
  invoice_number: string;
  order_id: string;
  party: "client" | "caterer";
  amount_ht: number;
  tva_rate: number;
  amount_ttc: number;
  issued_at: string;
  paid_at: string | null;
  status: InvoiceStatus;
  created_at: string;
};

export type CommissionInvoiceInsert = Omit<
  CommissionInvoice,
  "id" | "created_at"
>;

export type Notification = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  is_read: boolean;
  related_entity_type: string | null;
  related_entity_id: string | null;
  created_at: string;
};

export type NotificationInsert = Omit<Notification, "id" | "created_at">;

export type Message = {
  id: string;
  thread_id: string;
  sender_id: string;
  recipient_id: string;
  order_id: string | null;
  quote_request_id: string | null;
  body: string;
  is_read: boolean;
  created_at: string;
};

export type MessageInsert = Omit<Message, "id" | "created_at">;
