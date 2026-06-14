import { useState } from "react";
import type React from "react";
import { useAuth } from "../auth/AuthContext";
import { LoginModal } from "./LoginModal";
import { Button } from "./ui";

export function ProtectedAction({
  children,
  onClick,
  variant = "primary",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "ghost" | "danger" | "outline";
}) {
  const { isAuthenticated } = useAuth();
  const [loginOpen, setLoginOpen] = useState(false);

  return (
    <>
      <Button
        variant={variant}
        onClick={() => {
          if (!isAuthenticated) {
            setLoginOpen(true);
            return;
          }
          onClick?.();
        }}
      >
        {children}
      </Button>
      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
    </>
  );
}
