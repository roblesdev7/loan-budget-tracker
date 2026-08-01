import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { api, setUnauthorizedHandler } from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem("token"));
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("user"));
    } catch {
      return null;
    }
  });
  const [sessionExpired, setSessionExpired] = useState(false);

  const persist = (token, user) => {
    setToken(token);
    setUser(user);
    setSessionExpired(false);
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(user));
  };

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      logout();
      setSessionExpired(true);
    });
  }, [logout]);

  // Refresh profile from server (picks up role changes without re-login)
  useEffect(() => {
    if (!token) return;
    api
      .get("/auth/me", token)
      .then((res) => {
        if (res.data) {
          setUser(res.data);
          localStorage.setItem("user", JSON.stringify(res.data));
        }
      })
      .catch(() => {});
  }, [token]);

  const login = useCallback(async (email, password) => {
    const res = await api.post("/auth/login", { email, password });
    persist(res.data.token, res.data.user);
    return res;
  }, []);

  const register = useCallback(async (name, email, password) => {
    const res = await api.post("/auth/register", { name, email, password });
    persist(res.data.token, res.data.user);
    return res;
  }, []);

  const updateProfile = useCallback(async (payload) => {
    const res = await api.put("/auth/profile", payload, token);
    persist(res.data.token, res.data.user);
    return res;
  }, [token]);

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        login,
        register,
        logout,
        updateProfile,
        sessionExpired,
        setSessionExpired,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
