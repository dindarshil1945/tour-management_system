import { useQuery } from "@tanstack/react-query";
import { Activity, CreditCard, UserRound, Users } from "lucide-react";
import type React from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip, Bar, BarChart, XAxis, YAxis } from "recharts";
import { api } from "../api/client";
import type { DashboardMetrics, Payment, Announcement, TreasurySummary } from "../api/types";
import { ProtectedAction } from "../components/ProtectedAction";
import { Card, Skeleton } from "../components/ui";
import { formatCurrency } from "../lib/utils";

const COLORS = ["#6366f1", "#10b981", "#f97316", "#ef4444", "#8b5cf6"];

export function Dashboard() {
  const metrics = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => (await api.get<DashboardMetrics>("/dashboard/")).data,
  });
  const payments = useQuery({
    queryKey: ["payments", "recent"],
    queryFn: async () => (await api.get<{ results: Payment[] }>("/payments/", { params: { ordering: "-updated_at" } })).data.results,
  });
  const announcements = useQuery({
    queryKey: ["announcements", "recent"],
    queryFn: async () => (await api.get<{ results: Announcement[] }>("/announcements/")).data.results,
  });
  const treasury = useQuery({
    queryKey: ["treasury-summary"],
    queryFn: async () => (await api.get<TreasurySummary>("/treasury-summary/")).data,
  });

  const m = metrics.data;
  const ageData = [
    { name: "Adults", value: m?.total_adults ?? 0 },
    { name: "Teens", value: m?.total_teens ?? 0 },
    { name: "Children", value: m?.total_children ?? 0 },
    { name: "Babies", value: m?.total_babies ?? 0 },
    { name: "Seniors", value: m?.total_seniors ?? 0 },
  ];
  const moneyData = [
    { name: "Collected", value: Number(m?.collected_amount ?? 0) },
    { name: "Pending", value: Number(m?.pending_amount ?? 0) },
  ];

  return (
    <div className="space-y-6 animate-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Executive Dashboard</h1>
          <p className="text-sm text-muted-foreground">Live operating view for families, members, collections, and updates.</p>
        </div>
        <ProtectedAction>Record Payment</ProtectedAction>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi title="Families" value={m?.total_families} icon={<Users className="h-4 w-4" />} loading={metrics.isLoading} />
        <Kpi title="Members" value={m?.total_members} icon={<UserRound className="h-4 w-4" />} loading={metrics.isLoading} />
        <Kpi title="Collected" value={formatCurrency(m?.collected_amount)} icon={<CreditCard className="h-4 w-4" />} loading={metrics.isLoading} />
        <Kpi title="Available Funds" value={formatCurrency(treasury.data?.grand_total_funds)} icon={<Activity className="h-4 w-4" />} loading={treasury.isLoading} />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="p-4 xl:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">Collection Progress</h2>
            <span className="text-sm text-muted-foreground">{m?.collection_percentage ?? 0}%</span>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={moneyData}>
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} fill="#6366f1" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="p-4">
          <h2 className="mb-4 font-semibold">Age Categories</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={ageData} dataKey="value" nameKey="name" innerRadius={54} outerRadius={92}>
                  {ageData.map((_, index) => (
                    <Cell key={index} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="p-4">
          <h2 className="mb-3 font-semibold">Recent Payments</h2>
          <div className="space-y-3">
            {(payments.data ?? []).slice(0, 5).map((payment) => (
              <div key={payment.id} className="flex items-center justify-between rounded-md border p-3 text-sm">
                <div>
                  <p className="font-medium">{payment.family_head}</p>
                  <p className="text-muted-foreground">{payment.status}</p>
                </div>
                <span>{formatCurrency(payment.amount_paid)}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-4">
          <h2 className="mb-3 font-semibold">Collections By Member</h2>
          <div className="space-y-3">
            {(treasury.data?.members ?? []).slice(0, 5).map((item) => (
              <div key={item.member} className="flex items-center justify-between rounded-md border p-3 text-sm">
                <span className="font-medium">{item.member}</span>
                <span>{formatCurrency(Number(item.cash_collections) + Number(item.bank_collections))}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-4">
          <h2 className="mb-3 font-semibold">Announcements</h2>
          <div className="space-y-3">
            {(announcements.data ?? []).slice(0, 4).map((item) => (
              <div key={item.id} className="rounded-md border p-3">
                <p className="text-sm font-medium">{item.title}</p>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{item.body}</p>
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-4">
          <h2 className="mb-3 font-semibold">Operational Snapshot</h2>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <Metric label="Adults" value={m?.total_adults ?? 0} />
            <Metric label="Pending" value={formatCurrency(m?.pending_amount)} />
            <Metric label="Males" value={m?.total_males ?? 0} />
            <Metric label="Females" value={m?.total_females ?? 0} />
          </dl>
        </Card>
      </div>
    </div>
  );
}

function Kpi({ title, value, icon, loading }: { title: string; value?: string | number; icon: React.ReactNode; loading: boolean }) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between text-muted-foreground">
        <span className="text-sm">{title}</span>
        {icon}
      </div>
      {loading ? <Skeleton className="mt-4 h-8 w-28" /> : <p className="mt-3 text-2xl font-semibold">{value ?? 0}</p>}
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md bg-muted p-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-semibold">{value}</dd>
    </div>
  );
}
