import { Link } from "react-router-dom";
import { useMemo, useState, type FormEvent } from "react";
import { usePos } from "@/context/PosContext";
import type { Client, ClientInput } from "@/types";
import ui from "@/components/ui.module.css";
import styles from "./Pages.module.css";

const emptyClient: ClientInput = {
  name: "",
  phone: "",
  email: "",
  notes: "",
};

export function ClientsPage() {
  const {
    clients,
    inventorySource,
    createClient,
    updateClient,
    removeClient,
  } = usePos();
  const [q, setQ] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [form, setForm] = useState<ClientInput>(emptyClient);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const mongo = inventorySource === "mongo";

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return clients;
    return clients.filter(
      (c) =>
        c.name.toLowerCase().includes(term) ||
        c.phone.includes(term) ||
        c.email.toLowerCase().includes(term)
    );
  }, [clients, q]);

  function openCreate() {
    setEditing(null);
    setForm(emptyClient);
    setError("");
    setShowForm(true);
  }

  function openEdit(c: Client) {
    setEditing(c);
    setForm({
      name: c.name,
      phone: c.phone,
      email: c.email,
      notes: c.notes ?? "",
    });
    setError("");
    setShowForm(true);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("El nombre es obligatorio.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      if (editing) {
        await updateClient(editing.id, form);
      } else {
        await createClient(form);
      }
      setShowForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  }

  async function onRemove(c: Client) {
    if (!confirm(`¿Eliminar a ${c.name}?`)) return;
    try {
      await removeClient(c.id);
    } catch (err) {
      alert(err instanceof Error ? err.message : "No se pudo eliminar.");
    }
  }

  return (
    <div>
      <header className={styles.clientsHeader}>
        <div>
          <h1 className={ui.pageTitle}>Clientes</h1>
          <p className={ui.pageDesc}>
            {mongo
              ? "Altas y datos de contacto. Desde aquí puedes abrir un pedido."
              : "Conecta MongoDB (Ajustes) para guardar clientes en la nube."}
          </p>
        </div>
        <button
          type="button"
          className={`${ui.btn} ${ui.btnPrimary}`}
          disabled={!mongo}
          onClick={openCreate}
        >
          Nuevo cliente
        </button>
      </header>

      <input
        className={ui.input}
        placeholder="Buscar por nombre, teléfono o email…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        style={{ maxWidth: 360, marginBottom: "1.25rem" }}
        disabled={!mongo}
      />

      {!mongo ? (
        <div className={styles.salesEmpty}>
          <p>Clientes disponibles con API y MongoDB activos.</p>
        </div>
      ) : (
        <div className={ui.tableWrap}>
          <table className={ui.table}>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Teléfono</th>
                <th>Email</th>
                <th>Notas</th>
                <th aria-label="Acciones" />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ color: "var(--text-muted)" }}>
                    {clients.length === 0
                      ? "Aún no hay clientes registrados."
                      : "Sin coincidencias."}
                  </td>
                </tr>
              ) : (
                filtered.map((c) => (
                  <tr key={c.id}>
                    <td>{c.name}</td>
                    <td>{c.phone || "—"}</td>
                    <td>{c.email || "—"}</td>
                    <td
                      style={{
                        color: "var(--text-muted)",
                        fontSize: "0.85rem",
                        maxWidth: 200,
                      }}
                    >
                      {c.notes ?? "—"}
                    </td>
                    <td>
                      <div className={styles.rowActionsInline}>
                        <Link
                          to={`/pedidos?cliente=${c.id}`}
                          className={`${ui.btn} ${ui.btnGhost}`}
                          style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem" }}
                        >
                          Pedido
                        </Link>
                        <button
                          type="button"
                          className={`${ui.btn} ${ui.btnGhost}`}
                          style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem" }}
                          onClick={() => openEdit(c)}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          className={`${ui.btn} ${ui.btnDanger}`}
                          style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem" }}
                          onClick={() => void onRemove(c)}
                        >
                          Borrar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div
          className={styles.modalOverlay}
          role="dialog"
          aria-modal
          onClick={(e) => e.target === e.currentTarget && !saving && setShowForm(false)}
        >
          <form className={styles.modal} onSubmit={(e) => void onSubmit(e)}>
            <h3>{editing ? "Editar cliente" : "Nuevo cliente"}</h3>
            {error && (
              <p style={{ color: "var(--danger)", fontSize: "0.9rem" }}>{error}</p>
            )}
            <label className={styles.formField}>
              Nombre *
              <input
                className={ui.input}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </label>
            <label className={styles.formField}>
              Teléfono
              <input
                className={ui.input}
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </label>
            <label className={styles.formField}>
              Email
              <input
                type="email"
                className={ui.input}
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </label>
            <label className={styles.formField}>
              Notas
              <textarea
                className={ui.input}
                rows={3}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </label>
            <div className={styles.modalActions}>
              <button
                type="button"
                className={`${ui.btn} ${ui.btnGhost}`}
                disabled={saving}
                onClick={() => setShowForm(false)}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className={`${ui.btn} ${ui.btnPrimary}`}
                disabled={saving}
              >
                {saving ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
