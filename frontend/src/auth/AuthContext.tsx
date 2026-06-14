import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { api } from "../api/client";

type UserRole = "PUBLIC" | "SUPER_ADMIN" | "TOUR_COMMITTEE";

type AuthState = {
  role: UserRole;
  name: string;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<UserRole>((localStorage.getItem("role") as UserRole) ?? "PUBLIC");
  const [name, setName] = useState(localStorage.getItem("name") ?? "");

  async function login(username: string, password: string) {
    const { data } = await api.post("/auth/token/", { username, password });
    localStorage.setItem("access_token", data.access);
    localStorage.setItem("refresh_token", data.refresh);
    localStorage.setItem("role", data.role);
    localStorage.setItem("name", data.name);
    setRole(data.role);
    setName(data.name);
  }

  function logout() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("role");
    localStorage.removeItem("name");
    setRole("PUBLIC");
    setName("");
  }

  const value = useMemo(
    () => ({
      role,
      name,
      isAuthenticated: role !== "PUBLIC" && Boolean(localStorage.getItem("access_token")),
      login,
      logout,
    }),
    [role, name],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return value;
}
