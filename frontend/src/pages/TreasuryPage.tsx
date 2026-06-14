import { useQuery } from "@tanstack/react-query";
import { Landmark, ReceiptText, Repeat2, WalletCards } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import type { TreasurySummary } from "../api/types";
import { Card, Skeleton } from "../components/ui";
import { formatCurrency } from "../lib/utils";

const links = [
  { to: "/payment-transactions", label: "Collections", icon: ReceiptText },
  { to: "/expenses", label: "Expenses", icon: ReceiptText },
  { to: "/transfers", label: "Transfers", icon: Repeat2 },
  { to: "/committee-wallets", label: "Wallet Opening Balances", icon: WalletCards },
  { to: "/bank-accounts", label: "Bank Opening Balances", icon: Landmark },
  { to: "/treasury-ledger", label: "Financial Ledger", icon: ReceiptText },
];

export function TreasuryPage() {
  const summary = useQuery({
    queryKey: ["treasury-summary"],
    queryFn: async () => (await api.get<TreasurySummary>("/treasury-summary/")).data,
  });
  const data = summary.data;

  return (
    <div className="space-y-5 animate-in">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Treasury Dashboard</h1>
        <p className="text-sm text-muted-foreground">Independent cash and bank balances for every committee member.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryCard title="Total Wallet Funds" value={data?.total_wallet_funds} loading={summary.isLoading} />
        <SummaryCard title="Total Bank Funds" value={data?.total_bank_funds} loading={summary.isLoading} />
        <SummaryCard title="Grand Total Funds" value={data?.grand_total_funds} loading={summary.isLoading} emphasized />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {(data?.members ?? []).map((member) => (
          <Card key={member.member_id} className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">{member.member}</h2>
                <p className="text-xs text-muted-foreground">Committee treasury profile</p>
              </div>
              <strong className="text-lg text-primary">{formatCurrency(member.total_funds)}</strong>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Metric label="Wallet Balance" value={member.wallet_balance} />
              <Metric label="Bank Balance" value={member.bank_balance} />
              <Metric label="Cash Collections" value={member.cash_collections} />
              <Metric label="Bank Collections" value={member.bank_collections} />
              <Metric label="Cash Expenses" value={member.cash_expenses} />
              <Metric label="Bank Expenses" value={member.bank_expenses} />
            </div>
          </Card>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {links.map((item) => (
          <Link key={item.to} to={item.to} className="flex items-center gap-3 rounded-lg border bg-card p-4 text-sm font-medium shadow-sm hover:bg-muted">
            <item.icon className="h-5 w-5 text-primary" />
            {item.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

function SummaryCard({ title, value, loading, emphasized = false }: { title: string; value?: number | string; loading: boolean; emphasized?: boolean }) {
  return (
    <Card className={`p-5 ${emphasized ? "border-primary/40 bg-primary/5" : ""}`}>
      <p className="text-sm text-muted-foreground">{title}</p>
      {loading ? <Skeleton className="mt-3 h-9 w-36" /> : <p className="mt-2 text-2xl font-semibold">{formatCurrency(value)}</p>}
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-md bg-muted p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-semibold">{formatCurrency(value)}</p>
    </div>
  );
}
