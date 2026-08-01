const BASE_URL = import.meta.env.VITE_API_URL || "/api";

let onUnauthorized = null;

export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler;
}

async function request(method, path, body, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && onUnauthorized) {
    onUnauthorized();
    throw new Error("Sesión expirada");
  }

  if (res.status === 204) return { success: true, data: null };

  const text = await res.text();
  if (!text.trim()) {
    if (!res.ok) throw new Error("Error en la solicitud");
    return { success: true, data: null };
  }

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("Respuesta inválida del servidor");
  }

  if (!res.ok) {
    const err = new Error(data.message || "Error en la solicitud");
    err.status = res.status;
    err.errors = data.errors ?? {};
    throw err;
  }

  return data;
}

export async function downloadCsv(path, token) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (res.status === 401 && onUnauthorized) {
    onUnauthorized();
    throw new Error("Sesión expirada");
  }

  if (!res.ok) throw new Error("Error al exportar");

  const blob = await res.blob();
  const disposition = res.headers.get("Content-Disposition") ?? "";
  const match = disposition.match(/filename="(.+)"/);
  const filename = match?.[1] ?? "export.csv";

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export const api = {
  get: (path, token) => request("GET", path, undefined, token),
  post: (path, body, token) => request("POST", path, body, token),
  put: (path, body, token) => request("PUT", path, body, token),
  delete: (path, token) => request("DELETE", path, undefined, token),
};
