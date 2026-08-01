import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Calendar, Clock, Users, Plus, X, Trash2, Ban, Link2, Unlink } from "lucide-react";
import { TopNav } from "@/components/top-nav";
import { supabase } from "@/lib/supabase";
import {
  fetchReservations,
  createReservation,
  assignReservationToTable,
  unassignReservation,
  cancelReservation,
  deleteReservation,
  type Reservation,
} from "@/lib/reservations-api";
import { fetchTables, type PosTable } from "@/lib/tables-api";
import { updateTableStatusInSupabase } from "@/lib/supabase-service";

export const Route = createFileRoute("/prenotazioni")({
  component: PrenotazioniPage,
  head: () => ({
    meta: [
      { title: "Prenotazioni -- Gestione Sale e Tavoli" },
      {
        name: "description",
        content: "Elenco prenotazioni, assegnazione ai tavoli e stato in tempo reale.",
      },
    ],
  }),
});

const statusMeta: Record<Reservation["status"], { label: string; className: string }> = {
  confirmed: {
    label: "da assegnare",
    className: "text-cyan-400 bg-cyan-500/10 border border-cyan-500/30",
  },
  seated: {
    label: "assegnata",
    className: "text-emerald-300 bg-emerald-500/15 border border-emerald-500/40",
  },
  cancelled: {
    label: "annullata",
    className: "text-slate-500 bg-slate-800/60 border border-slate-700",
  },
};

function PrenotazioniPage() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [tables, setTables] = useState<PosTable[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [flash, setFlash] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [assigningId, setAssigningId] = useState<string | null>(null);

  const [clientName, setClientName] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState("20:00");
  const [covers, setCovers] = useState(2);
  const [notes, setNotes] = useState("");

  const reload = useCallback(async () => {
    try {
      const [res, tbl] = await Promise.all([fetchReservations(), fetchTables()]);
      setReservations(res);
      setTables(tbl);
    } catch (e) {
      console.error("Errore caricamento prenotazioni:", e);
      setFlash("⚠️ Errore di sincronizzazione database");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
    const channelRes = supabase
      .channel("public:reservations:page")
      .on("postgres_changes", { event: "*", schema: "public", table: "reservations" }, () => reload())
      .subscribe();
    const channelTbl = supabase
      .channel("public:Tables:reservations-page")
      .on("postgres_changes", { event: "*", schema: "public", table: "Tables" }, () => reload())
      .subscribe();
    return () => {
      supabase.removeChannel(channelRes);
      supabase.removeChannel(channelTbl);
    };
  }, [reload]);

  useEffect(() => {
    if (!flash) return;
    const t = window.setTimeout(() => setFlash(""), 3000);
    return () => window.clearTimeout(t);
  }, [flash]);

  const sorted = useMemo(
    () =>
      [...reservations].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)),
    [reservations],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim()) return;
    try {
      await createReservation({ clientName: clientName.trim(), date, time, covers, notes: notes.trim() });
      setFlash(`📅 Prenotazione creata per ${clientName.trim()}`);
      setClientName("");
      setNotes("");
      setShowModal(false);
      reload();
    } catch (e) {
      console.error(e);
      setFlash("⚠️ Errore nel salvataggio della prenotazione");
    }
  };

  const handleAssign = async (res: Reservation, tableLabel: string) => {
    try {
      // libera il vecchio tavolo se la prenotazione era già assegnata altrove
      if (res.tableId && res.tableId !== tableLabel) {
        const oldTable = tables.find((t) => t.label === res.tableId);
        if (oldTable) await updateTableStatusInSupabase(oldTable.id, "free");
      }
      await assignReservationToTable(res.id, tableLabel);
      const newTable = tables.find((t) => t.label === tableLabel);
      if (newTable) await updateTableStatusInSupabase(newTable.id, "reserved");
      setFlash(`✨ ${res.clientName} assegnato al Tavolo ${tableLabel}`);
      setAssigningId(null);
      reload();
    } catch (e) {
      console.error(e);
      setFlash("⚠️ Assegnazione non riuscita");
    }
  };

  const handleUnassign = async (res: Reservation) => {
    try {
      if (res.tableId) {
        const oldTable = tables.find((t) => t.label === res.tableId);
        if (oldTable) await updateTableStatusInSupabase(oldTable.id, "free");
      }
      await unassignReservation(res.id);
      setFlash(`↩️ Tavolo liberato per ${res.clientName}`);
      reload();
    } catch (e) {
      console.error(e);
      setFlash("⚠️ Operazione non riuscita");
    }
  };

  const handleCancel = async (res: Reservation) => {
    try {
      if (res.tableId) {
        const oldTable = tables.find((t) => t.label === res.tableId);
        if (oldTable) await updateTableStatusInSupabase(oldTable.id, "free");
      }
      await cancelReservation(res.id);
      setFlash(`🚫 Prenotazione di ${res.clientName} annullata`);
      reload();
    } catch (e) {
      console.error(e);
      setFlash("⚠️ Operazione non riuscita");
    }
  };

  const handleDelete = async (res: Reservation) => {
    try {
      await deleteReservation(res.id);
      setFlash("🗑️ Prenotazione rimossa");
      reload();
    } catch (e) {
      console.error(e);
      setFlash("⚠️ Eliminazione non riuscita");
    }
  };

  return (
    <div className="flex h-screen min-h-screen w-full flex-col overflow-hidden bg-[#030712] text-slate-100 font-sans">
      <TopNav />

      <main className="relative flex flex-1 flex-col overflow-hidden bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-[#030712] to-black">
        <div className="flex items-center justify-between gap-3 border-b border-cyan-500/15 bg-slate-950/70 px-6 py-4 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-sm font-black uppercase tracking-wider text-white">Prenotazioni</h1>
              <p className="text-[11px] text-slate-400">Tutte le prenotazioni del ristorante, in tempo reale</p>
            </div>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 px-4 py-2.5 text-xs font-extrabold text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.2)] transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            Nuova prenotazione
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex h-full w-full items-center justify-center">
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent shadow-[0_0_15px_rgba(6,182,212,0.6)]" />
            </div>
          ) : sorted.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-slate-500">
              <p className="text-sm font-semibold">Nessuna prenotazione registrata</p>
              <p className="text-xs">Crea la prima prenotazione con il pulsante in alto.</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {sorted.map((res) => {
                const meta = statusMeta[res.status];
                const isAssigning = assigningId === res.id;
                return (
                  <div
                    key={res.id}
                    className={`rounded-2xl border p-4 backdrop-blur-md transition-all ${
                      res.status === "cancelled"
                        ? "border-slate-800 bg-slate-950/60 opacity-60"
                        : res.tableId
                          ? "border-emerald-500/30 bg-emerald-950/10 shadow-[0_0_20px_rgba(16,185,129,0.08)]"
                          : "border-cyan-500/25 bg-cyan-950/10 shadow-[0_0_20px_rgba(6,182,212,0.08)]"
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className="text-sm font-black text-white">{res.clientName}</span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-950 border border-slate-800 text-[10px] font-mono font-bold text-slate-300">
                          {res.date}
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-950 border border-slate-800 text-[10px] font-mono font-bold text-slate-300">
                          <Clock className="w-3 h-3" /> {res.time}
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-950 border border-slate-800 text-[10px] font-mono text-slate-300">
                          <Users className="w-3 h-3" /> {res.covers}
                        </span>
                        <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wide ${meta.className}`}>
                          {meta.label}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {res.status !== "cancelled" && (
                          <>
                            {isAssigning ? (
                              <select
                                autoFocus
                                defaultValue=""
                                onChange={(e) => e.target.value && handleAssign(res, e.target.value)}
                                onBlur={() => setAssigningId(null)}
                                className="rounded-lg border border-cyan-500/40 bg-slate-900 px-2 py-1.5 text-[11px] font-semibold text-cyan-200 outline-none"
                              >
                                <option value="" disabled>
                                  Scegli tavolo…
                                </option>
                                {tables.map((t) => (
                                  <option key={t.id} value={t.label}>
                                    {t.label} {t.status === "reserved" && t.label !== res.tableId ? "(già prenotato)" : ""}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <button
                                onClick={() => setAssigningId(res.id)}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-2.5 py-1.5 text-[11px] font-bold text-cyan-300 hover:bg-cyan-500/20 active:scale-95 transition-all"
                              >
                                <Link2 className="w-3.5 h-3.5" />
                                {res.tableId ? `Tavolo ${res.tableId}` : "Assegna tavolo"}
                              </button>
                            )}

                            {res.tableId && (
                              <button
                                onClick={() => handleUnassign(res)}
                                title="Libera il tavolo"
                                className="inline-flex items-center justify-center rounded-lg border border-amber-500/40 bg-amber-500/10 p-1.5 text-amber-300 hover:bg-amber-500/20 active:scale-95 transition-all"
                              >
                                <Unlink className="w-3.5 h-3.5" />
                              </button>
                            )}

                            <button
                              onClick={() => handleCancel(res)}
                              title="Annulla prenotazione"
                              className="inline-flex items-center justify-center rounded-lg border border-rose-500/40 bg-rose-500/10 p-1.5 text-rose-300 hover:bg-rose-500/20 active:scale-95 transition-all"
                            >
                              <Ban className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => handleDelete(res)}
                          title="Elimina definitivamente"
                          className="inline-flex items-center justify-center rounded-lg border border-slate-700 bg-slate-900 p-1.5 text-slate-400 hover:text-rose-400 hover:border-rose-500/30 active:scale-95 transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {res.notes && (
                      <p className="mt-2 text-[11px] italic text-slate-400">"{res.notes}"</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="w-full max-w-sm rounded-3xl bg-slate-950 border border-cyan-500/50 p-6 shadow-[0_0_40px_rgba(6,182,212,0.3)] text-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-cyan-500/20 mb-4">
              <h4 className="text-sm font-black text-cyan-400 uppercase tracking-wider">Nuova Prenotazione</h4>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 rounded-xl bg-slate-900 border border-cyan-500/20 text-slate-400 hover:text-white transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Nome Cliente
                </label>
                <input
                  type="text"
                  required
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Es. Mario Rossi"
                  className="w-full rounded-xl bg-slate-900 border border-cyan-500/30 px-3.5 py-2.5 text-xs text-white focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400/50"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Data</label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full rounded-xl bg-slate-900 border border-cyan-500/30 px-3 py-2.5 text-xs text-white focus:border-cyan-400 focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Orario</label>
                  <input
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="w-full rounded-xl bg-slate-900 border border-cyan-500/30 px-3 py-2.5 text-xs text-white focus:border-cyan-400 focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Coperti</label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={covers}
                  onChange={(e) => setCovers(Number(e.target.value))}
                  className="w-full rounded-xl bg-slate-900 border border-cyan-500/30 px-3.5 py-2.5 text-xs text-white focus:border-cyan-400 focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Note (opzionale)</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Es. Seggiolone, allergie…"
                  className="w-full rounded-xl bg-slate-900 border border-cyan-500/30 px-3.5 py-2.5 text-xs text-white focus:border-cyan-400 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                className="w-full mt-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 py-3 text-xs font-black text-slate-950 uppercase tracking-wide shadow-[0_0_20px_rgba(6,182,212,0.4)] transition-all"
              >
                Salva Prenotazione
              </button>
            </form>
          </div>
        </div>
      )}

      {flash && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-cyan-500/50 bg-slate-950/95 px-4 py-2.5 text-[11px] font-bold text-cyan-300 shadow-[0_0_20px_rgba(6,182,212,0.4)] backdrop-blur-xl">
          {flash}
        </div>
      )}
    </div>
  );
}
