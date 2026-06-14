import { X } from "lucide-react";
import { FormEvent, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { Button, Card } from "./ui";

export function LoginModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { login } = useAuth();
  const [error, setError] = useState("");

  if (!open) return null;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await login(String(form.get("username")), String(form.get("password")));
      onClose();
    } catch {
      setError("Invalid credentials or unavailable server.");
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <Card className="w-full max-w-md p-5 shadow-soft animate-in">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Committee login</h2>
            <p className="mt-1 text-sm text-muted-foreground">Please login as Tour Committee or Super Admin.</p>
          </div>
          <Button variant="ghost" className="h-8 w-8 px-0" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <form className="mt-5 space-y-3" onSubmit={onSubmit}>
          <input className="h-10 w-full rounded-md border bg-background px-3" name="username" placeholder="Username" />
          <input
            className="h-10 w-full rounded-md border bg-background px-3"
            name="password"
            type="password"
            placeholder="Password"
          />
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button className="w-full" type="submit">
            Login
          </Button>
        </form>
      </Card>
    </div>
  );
}
