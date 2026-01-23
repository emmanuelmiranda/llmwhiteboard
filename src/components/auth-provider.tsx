"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { apiClient, type User } from "@/lib/api-client";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => void;
  loginWithGitHub: () => Promise<void>;
  handleGitHubCallback: (code: string, state: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Check if user is logged in
    const token = apiClient.getToken();
    if (token) {
      // For now, we store user info in localStorage
      const storedUser = localStorage.getItem("user");
      if (storedUser) {
        setUser(JSON.parse(storedUser));
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    const response = await apiClient.login(email, password);
    setUser(response.user);
    localStorage.setItem("user", JSON.stringify(response.user));
  };

  const signup = async (email: string, password: string, name?: string) => {
    const response = await apiClient.signup(email, password, name);
    setUser(response.user);
    localStorage.setItem("user", JSON.stringify(response.user));
  };

  const logout = () => {
    apiClient.logout();
    setUser(null);
    localStorage.removeItem("user");
    router.push("/login");
  };

  const loginWithGitHub = async () => {
    const redirectUri = `${window.location.origin}/auth/github/callback`;
    const { url, state } = await apiClient.getGitHubAuthUrl(redirectUri);

    // Store state in sessionStorage for CSRF verification
    sessionStorage.setItem("github_oauth_state", state);

    // Redirect to GitHub authorization
    window.location.href = url;
  };

  const handleGitHubCallback = async (code: string, state: string) => {
    // Verify state matches (CSRF protection)
    const storedState = sessionStorage.getItem("github_oauth_state");
    if (state !== storedState) {
      throw new Error("Invalid OAuth state. Please try logging in again.");
    }

    // Clear stored state
    sessionStorage.removeItem("github_oauth_state");

    const redirectUri = `${window.location.origin}/auth/github/callback`;
    const response = await apiClient.githubCallback(code, state, redirectUri);
    setUser(response.user);
    localStorage.setItem("user", JSON.stringify(response.user));
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, signup, logout, loginWithGitHub, handleGitHubCallback }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
