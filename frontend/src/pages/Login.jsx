import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";

export default function Login() {
  const { login, sessionExpired, setSessionExpired } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [allowRegistration, setAllowRegistration] = useState(false);

  useEffect(() => {
    api
      .get("/auth/config")
      .then((res) => setAllowRegistration(!!res.data?.allow_public_registration))
      .catch(() => setAllowRegistration(false));
  }, []);

  const handle = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(form.email, form.password);
      setSessionExpired(false);
      navigate("/");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const set = (field) => (e) =>
    setForm((p) => ({ ...p, [field]: e.target.value }));

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center px-5 max-w-sm mx-auto">
      <div className="text-center mb-8">
        <div className="text-5xl mb-3">💼</div>
        <h1 className="text-3xl font-bold text-gray-900">Loan &amp; Budget</h1>
        <p className="text-gray-500 mt-1 text-sm">
          Control financiero personal
        </p>
      </div>

      <form
        onSubmit={handle}
        className="bg-white rounded-2xl p-6 shadow-sm space-y-4"
      >
        <h2 className="text-xl font-bold text-gray-900">Iniciar sesión</h2>

        {sessionExpired && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-lg text-sm">
            Tu sesión expiró. Inicia sesión de nuevo.
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email
          </label>
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            value={form.email}
            onChange={set("email")}
            className="w-full border border-gray-300 rounded-xl px-4 py-3 outline-none focus:border-green-500"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Contraseña
          </label>
          <input
            type="password"
            autoComplete="current-password"
            value={form.password}
            onChange={set("password")}
            className="w-full border border-gray-300 rounded-xl px-4 py-3 outline-none focus:border-green-500"
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-green-500 disabled:opacity-50 text-white font-bold py-4 rounded-xl text-lg active:bg-green-600"
        >
          {loading ? "Entrando…" : "Entrar"}
        </button>

        <p className="text-center text-sm text-gray-500">
          {allowRegistration ? (
            <>
              ¿Sin cuenta?{" "}
              <Link to="/register" className="text-green-600 font-semibold">
                Regístrate
              </Link>
            </>
          ) : (
            "Acceso solo por invitación"
          )}
        </p>
      </form>
    </div>
  );
}
