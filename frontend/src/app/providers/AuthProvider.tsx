import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { authService } from "../../services/authService";

export interface User {
  UserID: number;
  Username: string;
  Email: string;
  OfficerID: number;
  RoleID: number;
  Rank?: string;
  GrantedScope?: string;
  IsActive: boolean;
  role?: {
    RoleID: number;
    RoleName: string;
    Description: string;
  };
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<any>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem("access_token"));
  const [isLoading, setIsLoading] = useState(true);

  const fetchProfile = async () => {
    try {
      const profile = await authService.getMe();
      setUser(profile);
    } catch (err) {
      console.error("Failed to fetch user profile, logging out...", err);
      logout();
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchProfile();
    } else {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    const handleSessionExpired = () => {
      logout();
    };
    window.addEventListener("auth_session_expired", handleSessionExpired);
    return () => window.removeEventListener("auth_session_expired", handleSessionExpired);
  }, []);

  const login = async (username: string, password: string) => {
    setIsLoading(true);
    try {
      const data = await authService.login({ Username: username, Password: password });
      const { access_token, refresh_token } = data;
      localStorage.setItem("access_token", access_token);
      localStorage.setItem("refresh_token", refresh_token);
      setToken(access_token);
      
      // Immediately fetch and populate user profile so ProtectedRoute has full user object before navigation
      const profile = await authService.getMe();
      setUser(profile);
      setIsLoading(false);
      return data;
    } catch (err) {
      setIsLoading(false);
      throw err;
    }
  };

  const logout = () => {
    const refToken = localStorage.getItem("refresh_token");
    if (refToken) {
      authService.logout(refToken).catch((err) => console.error("Logout request failed", err));
    }
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    setToken(null);
    setUser(null);
    setIsLoading(false);
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

