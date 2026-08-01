import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";

const FIELDS = [
  {
    key: "name",
    label: "Nombre completo",
    type: "text",
    mode: "text",
    autocomplete: "name",
  },
  {
    key: "email",
    label: "Email",
    type: "email",
    mode: "email",
    autocomplete: "email",
  },
  {
    key: "password",
    label: "Contraseña",
    type: "password",
    mode: "text",
    autocomplete: "new-password",
  },
];

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [fieldErrors, setFE] = useState({});
  const [loading, setLoading] = useState(false);
  const [allowRegistration, setAllowRegistration] = useState(null);

  useEffect(() => {
    api
      .get("/auth/config")
      .then((res) => setAllowRegistration(!!res.data?.allow_public_registration))
      .catch(() => setAllowRegistration(false));
  }, []);

  if (allowRegistration === null) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400 text-sm">
        Cargando…
      </div>
    );
  }

  if (!allowRegistration) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center px-5 max-w-sm mx-auto text-center">
        <div className="text-5xl mb-3">🔒</div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">Registro cerrado</h1>
        <p className="text-gray-500 text-sm mb-6">
          Solo cuentas creadas por el administrador pueden acceder.
        </p>
        <Link to="/login" className="text-green-600 font-semibold">
          Volver a iniciar sesión
        </Link>
      </div>
    );
  }

  const handle = async (e) => {
    e.preventDefault();
    setError("");
    setFE({});
    setLoading(true);
    try {
      await register(form.name, form.email, form.password);
      navigate("/");
    } catch (err) {
      setError(err.message);
      if (err.errors) setFE(err.errors);
    } finally {
      setLoading(false);
    }
  };

  const set = (key) => (e) => setForm((p) => ({ ...p, [key]: e.target.value }));

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center px-5 max-w-sm mx-auto">
      <div className="text-center mb-8">
        <div className="text-5xl mb-3">💼</div>
        <h1 className="text-3xl font-bold text-gray-900">Loan &amp; Budget</h1>
        <p className="text-gray-500 mt-1 text-sm">Crea tu cuenta</p>
      </div>

      <form
        onSubmit={handle}
        className="bg-white rounded-2xl p-6 shadow-sm space-y-4"
      >
        <h2 className="text-xl font-bold text-gray-900">Registro</h2>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        {FIELDS.map(({ key, label, type, mode, autocomplete }) => (
          <div key={key}>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {label}
            </label>
            <input
              type={type}
              inputMode={mode}
              autoComplete={autocomplete}
              value={form[key]}
              onChange={set(key)}
              className={`w-full border rounded-xl px-4 py-3 outline-none focus:border-green-500
                ${fieldErrors[key] ? "border-red-400" : "border-gray-300"}`}
              required
            />
            {fieldErrors[key] && (
              <p className="text-xs text-red-500 mt-1">{fieldErrors[key]}</p>
            )}
          </div>
        ))}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-green-500 disabled:opacity-50 text-white font-bold py-4 rounded-xl text-lg active:bg-green-600"
        >
          {loading ? "Creando cuenta…" : "Crear cuenta"}
        </button>

        <p className="text-center text-sm text-gray-500">
          ¿Ya tienes cuenta?{" "}
          <Link to="/login" className="text-green-600 font-semibold">
            Inicia sesión
          </Link>
        </p>
      </form>
    </div>
  );
}
