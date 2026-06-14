import { ShieldCheck, UsersRound } from "lucide-react";
import { ProtectedAction } from "../components/ProtectedAction";
import { Card } from "../components/ui";

export function SettingsPage() {
  return (
    <div className="space-y-5 animate-in">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Super admin controls for users, tours, imports, exports, and platform configuration.</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <div className="mb-4 flex items-center gap-3">
            <UsersRound className="h-5 w-5 text-primary" />
            <h2 className="font-semibold">Committee Accounts</h2>
          </div>
          <p className="mb-4 text-sm text-muted-foreground">Create and manage operational users with role based access control.</p>
          <ProtectedAction>Manage Users</ProtectedAction>
        </Card>
        <Card className="p-5">
          <div className="mb-4 flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 text-secondary" />
            <h2 className="font-semibold">Data Governance</h2>
          </div>
          <p className="mb-4 text-sm text-muted-foreground">Configure import validation, audit retention, and export settings.</p>
          <ProtectedAction variant="outline">Open Controls</ProtectedAction>
        </Card>
      </div>
    </div>
  );
}
