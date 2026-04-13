import {
  PropsWithChildren,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { apiRequest } from "../lib/api";

export type Role =
  | "SYSTEM_ADMIN"
  | "CLIENT_ADMIN"
  | "SUPERVISOR"
  | "ENGINEER"
  | "TECHNICIAN";

export type TenantSummary = {
  id: number;
  name: string;
  code: string;
  status: string;
};

export type User = {
  id: number;
  tenant_id: number | null;
  email: string;
  full_name: string;
  role: Role;
  status: string;
  supervisor_user_id: number | null;
  tenant?: TenantSummary | null;
};

type TokenResponse = {
  access_token: string;
  token_type: string;
  user: User;
};

type AuthContextValue = {
  user: User | null;
  token: string | null;
  authLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshMe: () => Promise<void>;
  updateProfile: (fullName: string) => Promise<User>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const TOKEN_KEY = "pw_token";

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const persistToken = (value: string | null) => {
    if (value) {
      localStorage.setItem(TOKEN_KEY, value);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
    setToken(value);
  };

  const refreshMe = async () => {
    const activeToken = token || localStorage.getItem(TOKEN_KEY);
    if (!activeToken) {
      setUser(null);
      return;
    }
    const me = await apiRequest<User>("/auth/me", { method: "GET" }, activeToken);
    setUser(me);
    persistToken(activeToken);
  };

  useEffect(() => {
    const bootstrap = async () => {
      try {
        await refreshMe();
      } catch {
        persistToken(null);
        setUser(null);
      } finally {
        setAuthLoading(false);
      }
    };
    bootstrap();
  }, []);

  const login = async (email: string, password: string) => {
    const response = await apiRequest<TokenResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    persistToken(response.access_token);
    setUser(response.user);
  };

  const logout = () => {
    persistToken(null);
    setUser(null);
  };

  const updateProfile = async (fullName: string) => {
    if (!token) {
      throw new Error("Not authenticated");
    }
    const updated = await apiRequest<User>(
      "/users/me",
      { method: "PATCH", body: JSON.stringify({ full_name: fullName }) },
      token
    );
    setUser(updated);
    return updated;
  };

  const changePassword = async (currentPassword: string, newPassword: string) => {
    if (!token) {
      throw new Error("Not authenticated");
    }
    await apiRequest(
      "/auth/change-password",
      { method: "POST", body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }) },
      token
    );
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      authLoading,
      isAuthenticated: Boolean(user),
      login,
      logout,
      refreshMe,
      updateProfile,
      changePassword,
    }),
    [user, token, authLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
