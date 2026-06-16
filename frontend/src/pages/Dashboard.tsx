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
  const totalMembers = m?.total_members ?? 0;
  const otherGender = m?.total_other_gender ?? Math.max(totalMembers - (m?.total_males ?? 0) - (m?.total_females ?? 0), 0);
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
  const genderDistribution = [
    { label: "Male", value: m?.total_males ?? 0 },
    { label: "Female", value: m?.total_females ?? 0 },
    ...(otherGender ? [{ label: "Other", value: otherGender }] : []),
  ];
  const ageDistribution = [
    { label: "Infants (0-5)", value: m?.total_babies ?? 0 },
    { label: "Children (6-12)", value: m?.total_children ?? 0 },
    { label: "Teenagers (13-17)", value: m?.total_teens ?? 0 },
    { label: "Adults (18-49)", value: m?.total_adults ?? 0 },
    { label: "Seniors (50+)", value: m?.total_seniors ?? 0 },
  ];
  const attendanceDistribution = [
    { label: "Confirmed", value: m?.confirmed_members ?? 0 },
    { label: "Pending", value: m?.pending_members ?? 0 },
    { label: "Not Attending", value: m?.not_attending_members ?? 0 },
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

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Dashboard Analytics</h2>
          <p className="text-sm text-muted-foreground">Demographics and family distribution for the active tour data.</p>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="p-4">
            <h3 className="mb-3 font-semibold">Members Overview</h3>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <Metric label="Total Members" value={m?.total_members ?? 0} />
              <Metric label="Total Families" value={m?.total_families ?? 0} />
              <Metric label="Male Members" value={m?.total_males ?? 0} />
              <Metric label="Female Members" value={m?.total_females ?? 0} />
              {otherGender > 0 && <Metric label="Other Gender" value={otherGender} />}
            </dl>
          </Card>
          <Card className="p-4 lg:col-span-2">
            <h3 className="mb-3 font-semibold">Age Group Distribution</h3>
            <div className="space-y-3">
              {ageDistribution.map((item) => (
                <DistributionBar key={item.label} label={item.label} value={item.value} total={totalMembers} />
              ))}
            </div>
          </Card>
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Tour Insights</h2>
          <p className="text-sm text-muted-foreground">Attendance, family size, collection, and treasury snapshots.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <InsightCard
            title="Attendance"
            items={[
              ["Confirmed", m?.confirmed_members ?? 0],
              ["Pending", m?.pending_members ?? 0],
              ["Not Attending", m?.not_attending_members ?? 0],
            ]}
            loading={metrics.isLoading}
          />
          <InsightCard
            title="Family Statistics"
            items={[
              ["Average Size", m?.average_family_size ?? 0],
              ["Largest Family", `${m?.largest_family_size ?? 0}${m?.largest_family_head ? ` - ${m.largest_family_head}` : ""}`],
              ["Smallest Family", `${m?.smallest_family_size ?? 0}${m?.smallest_family_head ? ` - ${m.smallest_family_head}` : ""}`],
            ]}
            loading={metrics.isLoading}
          />
          <InsightCard
            title="Financial Overview"
            items={[
              ["Expected", formatCurrency(m?.expected_collection)],
              ["Received", formatCurrency(m?.collected_amount)],
              ["Pending", formatCurrency(m?.pending_amount)],
              ["Collection", `${m?.collection_percentage ?? 0}%`],
            ]}
            loading={metrics.isLoading}
          />
          <InsightCard
            title="Treasury Snapshot"
            items={[
              ["Wallet Funds", formatCurrency(treasury.data?.total_wallet_funds)],
              ["Bank Funds", formatCurrency(treasury.data?.total_bank_funds)],
              ["Treasury Value", formatCurrency(treasury.data?.grand_total_funds)],
            ]}
            loading={treasury.isLoading}
          />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Visual Summaries</h2>
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="p-4">
            <h3 className="mb-3 font-semibold">Gender Distribution</h3>
            <div className="space-y-3">
              {genderDistribution.map((item) => (
                <DistributionBar key={item.label} label={item.label} value={item.value} total={totalMembers} />
              ))}
            </div>
          </Card>
          <Card className="p-4">
            <h3 className="mb-3 font-semibold">Age Groups</h3>
            <div className="space-y-3">
              {ageDistribution.map((item) => (
                <DistributionBar key={item.label} label={item.label} value={item.value} total={totalMembers} />
              ))}
            </div>
          </Card>
          <Card className="p-4">
            <h3 className="mb-3 font-semibold">Attendance Status</h3>
            <div className="space-y-3">
              {attendanceDistribution.map((item) => (
                <DistributionBar key={item.label} label={item.label} value={item.value} total={totalMembers} />
              ))}
            </div>
          </Card>
        </div>
      </section>

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

function DistributionBar({ label, value, total }: { label: string; value: number; total: number }) {
  const percentage = total ? Math.round((value / total) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="min-w-0 truncate text-muted-foreground">{label}</span>
        <span className="shrink-0 font-medium">
          {value} ({percentage}%)
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}

function InsightCard({
  title,
  items,
  loading,
}: {
  title: string;
  items: Array<[string, React.ReactNode]>;
  loading: boolean;
}) {
  return (
    <Card className="p-4">
      <h3 className="mb-3 font-semibold">{title}</h3>
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-9 w-full" />
          ))}
        </div>
      ) : (
        <dl className="space-y-2 text-sm">
          {items.map(([label, value]) => (
            <div key={label} className="flex items-start justify-between gap-3 rounded-md bg-muted p-2">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="text-right font-semibold">{value}</dd>
            </div>
          ))}
        </dl>
      )}
    </Card>
  );
}
