import { Download } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import type { DashboardMetrics, TreasurySummary } from "../api/types";
import { Button, Card, Skeleton } from "../components/ui";
import { formatCurrency } from "../lib/utils";

export function ReportsPage() {
  const metrics = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => (await api.get<DashboardMetrics>("/dashboard/")).data,
  });
  const treasury = useQuery({
    queryKey: ["treasury-summary"],
    queryFn: async () => (await api.get<TreasurySummary>("/treasury-summary/")).data,
  });

  async function download(path: string, filename: string) {
    const result = await api.get(path, { responseType: "blob" });
    const href = URL.createObjectURL(result.data);
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(href);
  }

  return (
    <div className="space-y-5 animate-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
          <p className="text-sm text-muted-foreground">Family metrics and auditable member treasury summaries.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => download("/reports/treasury.xlsx", "treasury-report.xlsx")}>
            <Download className="h-4 w-4" /> Excel
          </Button>
          <Button variant="outline" onClick={() => download("/reports/treasury.pdf", "treasury-report.pdf")}>
            <Download className="h-4 w-4" /> PDF
          </Button>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <ReportCard title="Families" value={metrics.data?.total_families} loading={metrics.isLoading} />
        <ReportCard title="Members" value={metrics.data?.total_members} loading={metrics.isLoading} />
        <ReportCard title="Wallet Funds" value={formatCurrency(treasury.data?.total_wallet_funds)} loading={treasury.isLoading} />
        <ReportCard title="Bank Funds" value={formatCurrency(treasury.data?.total_bank_funds)} loading={treasury.isLoading} />
      </div>
      <Card className="overflow-x-auto p-4">
        <h2 className="mb-3 font-semibold">Committee Treasury</h2>
        <table className="w-full min-w-[900px] text-sm">
          <thead className="text-left text-xs uppercase text-muted-foreground">
            <tr>
              {["Member", "Wallet", "Bank", "Total", "Cash Collections", "Bank Collections", "Cash Expenses", "Bank Expenses"].map((heading) => (
                <th key={heading} className="border-b px-3 py-2">{heading}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(treasury.data?.members ?? []).map((member) => (
              <tr key={member.member_id}>
                <td className="border-b px-3 py-3 font-medium">{member.member}</td>
                {[member.wallet_balance, member.bank_balance, member.total_funds, member.cash_collections, member.bank_collections, member.cash_expenses, member.bank_expenses].map((value, index) => (
                  <td key={index} className="border-b px-3 py-3">{formatCurrency(value)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function ReportCard({ title, value, loading }: { title: string; value?: string | number; loading: boolean }) {
  return (
    <Card className="p-4">
      <p className="text-sm text-muted-foreground">{title}</p>
      {loading ? <Skeleton className="mt-3 h-8 w-28" /> : <p className="mt-2 text-2xl font-semibold">{value ?? 0}</p>}
    </Card>
  );
}
