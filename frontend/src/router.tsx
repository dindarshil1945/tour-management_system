import { createBrowserRouter } from "react-router-dom";
import { AppLayout } from "./layout/AppLayout";
import { Dashboard } from "./pages/Dashboard";
import { ReportsPage } from "./pages/ReportsPage";
import { ResourcePage } from "./pages/ResourcePage";
import { SettingsPage } from "./pages/SettingsPage";
import { TreasuryPage } from "./pages/TreasuryPage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppLayout />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: "families", element: <ResourcePage title="Families" resource="/families/" /> },
      { path: "members", element: <ResourcePage title="Members" resource="/members/" /> },
      { path: "payments", element: <ResourcePage title="Payments" resource="/payments/" /> },
      { path: "payment-transactions", element: <ResourcePage title="Payment Transactions" resource="/payment-transactions/" /> },
      { path: "treasury", element: <TreasuryPage /> },
      { path: "committee-wallets", element: <ResourcePage title="Committee Wallets" resource="/committee-wallets/" /> },
      { path: "bank-accounts", element: <ResourcePage title="Bank Accounts" resource="/bank-accounts/" /> },
      { path: "expenses", element: <ResourcePage title="Expenses" resource="/expenses/" /> },
      { path: "transfers", element: <ResourcePage title="Transfers" resource="/transfers/" /> },
      { path: "treasury-ledger", element: <ResourcePage title="Treasury Ledger" resource="/treasury-ledger/" readOnly /> },
      { path: "announcements", element: <ResourcePage title="Announcements" resource="/announcements/" /> },
      { path: "tours", element: <ResourcePage title="Tours" resource="/tours/" /> },
      { path: "users", element: <ResourcePage title="Users" resource="/users/" /> },
      { path: "reports", element: <ReportsPage /> },
      { path: "audit", element: <ResourcePage title="Audit Logs" resource="/audit-logs/" readOnly /> },
      { path: "settings", element: <SettingsPage /> },
    ],
  },
]);
