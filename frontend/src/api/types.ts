export type Tour = {
  id: number;
  name: string;
  starts_on?: string;
  ends_on?: string;
  is_active: boolean;
};

export type DashboardMetrics = {
  total_families: number;
  total_members: number;
  total_adults: number;
  total_teens: number;
  total_children: number;
  total_babies: number;
  total_seniors: number;
  total_males: number;
  total_females: number;
  expected_collection: number;
  collected_amount: number;
  pending_amount: number;
  collection_percentage: number;
};

export type TreasurySummary = {
  members: TreasuryMember[];
  total_wallet_funds: number | string;
  total_bank_funds: number | string;
  grand_total_funds: number | string;
};

export type TreasuryMember = {
  member_id: number;
  member: string;
  cash_collections: number | string;
  bank_collections: number | string;
  cash_expenses: number | string;
  bank_expenses: number | string;
  wallet_balance: number | string;
  bank_balance: number | string;
  total_funds: number | string;
};

export type Family = {
  id: number;
  tour: number;
  family_id: string;
  family_head: string;
  contact_number: string;
  alternate_contact?: string;
  address?: string;
  notes?: string;
  total_members?: number;
  adults?: number;
  teens?: number;
  children?: number;
  babies?: number;
  seniors?: number;
  males?: number;
  females?: number;
};

export type Member = {
  id: number;
  family: number;
  family_id_display?: string;
  family_head?: string;
  name: string;
  age: number;
  gender: "MALE" | "FEMALE" | "OTHER";
  phone?: string;
  status: "CONFIRMED" | "PENDING" | "NOT_ATTENDING";
  age_category: string;
};

export type Payment = {
  id: number;
  family: number;
  family_code: string;
  family_head: string;
  amount_expected: string;
  amount_paid: string;
  balance: string;
  collection_percentage: number;
  status: "Paid" | "Partial" | "Pending";
};

export type Announcement = {
  id: number;
  title: string;
  body: string;
  category: string;
  is_pinned: boolean;
  created_at: string;
};
