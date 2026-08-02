import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { ArrowLeftRight, ArchiveRestore, Lock, Receipt, RotateCcw, Sparkles } from "lucide-react";
import { TopNav } from "../components/top-nav";
import { supabase } from "../lib/supabase";
import { reopenTicketInSupabase } from "../lib/supabase-service";

export interface PosTicket {
  id: string;
  tableId: string;
  tableLabel: string;
  items: { id: string; name: string; price: number; qty: number }[];
  total: number;
  closedAt: string;
}

function isToday(dateString: string): boolean {
  const today = new Date();
  const date = new Date(dateString);
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
}

export const Route = createFileRoute("/storico")({
  head: () => ({
    meta: [
      { title: "Storico -- Incassi giornalieri" },
      { name: "description", content: "Storico conti chiusi, chiusura cassa e riapertura tavoli." },
      { property: "og:title", content: "Storico -- Gestione ristorante" },
      { property: "og:description", content: "Registro incassi e chiusura di cassa." },
    ],
  }),
  component: StoricoPage,
});

function StoricoPage() {
  const [history, setHistory] = useState<PosTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigateToMappa();

  // Caricamento dei ticket chiusi direttamente da Supabase all'avvio[span_1](start_span)[span_1](end_span)
  useEffect(() => {
    const fetchClosedTickets = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from("tickets")
          .select("*")
          .eq("status", "closed")
          .order("closed_at", { ascending: false });

        if (error) throw error;

        if (data) {
          const formattedTickets: PosTicket[] = data.map((t: any) => ({
            id: t.id,
            tableId: t.table_id,
            tableLabel: t.table_label || `Tavolo ${t.table_id}`,
            items: t.items || [],
            total: t.total || 0,
            closedAt: t.closed_at || t.updated_at || new Date().toISOString(),
          }));
          setHistory(formattedTickets);
        }
      } catch (err) {
        console.error("Errore nel caricamento dello storico da Supabase:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchClosedTickets();
  }, []);

  const todayTickets = useMemo(() => history.filter((t) => isToday(t.closedAt)), [history]);
  const olderTickets = useMemo(() => history.filter((t) => !isToday(t.closedAt)), [history]);

  const totalToday = todayTickets.reduce((s, t) => s + t.total, 0);
  const totalOlder = olderTickets.reduce((s, t) => s + t.total, 0);

  const [filter, setFilter] = useState<"today" | "all">("today");
  const list = filter === "today" ? todayTickets : history;

  const handleReopen = async (ticket: PosTicket) => {
    if (
      !window.confirm(
        `Riaprire il tavolo ${ticket.tableLabel}? Il conto verrà rimosso dallo storico e il tavolo tornerà attivo.`,
      )
    )
      return;

    try {
      setHistory((prev) => prev.filter((t) => t.id !== ticket.id));
      await reopenTicketInSupabase(ticket);
      navigate();
    } catch (err) {
      console.error("Errore durante la riapertura del ticket:", err);
    }
  };

  const handleCloseCassa = async () => {
    if (todayTickets.length === 0) {
      window.alert("Nessun conto da archiviare per oggi.");
      return;
    }
    if (
      !window.confirm(
        `Chiudere la cassa?\n\n${todayTickets.length} conti -- Totale € ${totalToday.toFixed(2)}\n\nLa giornata verrà archiviata.`,
      )
    )
      return;

    try {
      // Registra la chiusura cassa salvando il report giornaliero su Supabase (tabella settings)
      const closingData = {
        date: new Date().toISOString(),
        total: totalToday,
        count: todayTickets.length,
      };

      await supabase.from("settings").upsert({
        key: `chiusura_cassa_${new Date().toISOString().split("T")[0]}`,
        value: JSON.stringify(closingData),
      }, { onConflict: "key" });

      window.alert("Cassa chiusa e archiviata con successo su Supabase!");
    } catch (err) {
      console.error("Errore durante la chiusura cassa:", err);
    }
  };

  return (
    <div className="flex h-screen min-h-screen w-full flex-col overflow-hidden bg-[#030712] text-slate-100">
      <TopNav active="Storico" />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 p-4 md:p-6">
          
          {/* Header */}
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between bg-slate-950/80 p-5 rounded-2xl border border-cyan-500/30 backdrop-blur-xl shadow-[0_0_25px_rgba(6,182,212,0.15)]">
            <div>
              <h1 className="text-xl font-black tracking-tight text-white flex items-center gap-2">
                <Sparkles className="w-6 h-6 text-cyan-400" /> Storico Incassi
              </h1>
              <p className="mt-1 text-xs text-slate-400">
                Conti chiusi, riaperture e chiusura di cassa sincronizzati con Supabase.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex rounded-xl border border-slate-800 bg-slate-900 p-1">
                <button
                  type="button"
                  onClick={() => setFilter("today")}
                  className={[
                    "min-h-[36px] rounded-lg px-3 text-xs font-bold transition-all",
                    filter === "today"
                      ? "bg-cyan-500 text-slate-950 shadow-[0_0_10px_rgba(6,182,212,0.4)]"
                      : "text-slate-400 hover:text-white",
                  ].join(" ")}
                >
                  Oggi
                </button>
                <button
                  type="button"
                  onClick={() => setFilter("all")}
                  className={[
                    "min-h-[36px] rounded-lg px-3 text-xs font-bold transition-all",
                    filter === "all"
                      ? "bg-cyan-500 text-slate-950 shadow-[0_0_10px_rgba(6,182,212,0.4)]"
                      : "text-slate-400 hover:text-white",
                  ].join(" ")}
                >
                  Tutto lo storico
                </button>
              </div>
              <button
                type="button"
                onClick={handleCloseCassa}
                className="inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-cyan-500 px-4 text-xs font-extrabold uppercase tracking-wider text-slate-950 hover:bg-cyan-400 transition-all shadow-[0_0_15px_rgba(6,182,212,0.4)] cursor-pointer"
              >
                <Lock className="h-4 w-4" />
                Chiudi Cassa
              </button>
            </div>
          </div>

          {/* Riepilogo */}
          <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <SummaryCard
              label="Conti chiusi oggi"
              value={String(todayTickets.length)}
              icon={<Receipt className="h-4 w-4 text-cyan-400" />}
            />
            <SummaryCard
              label="Incasso oggi"
              value={`€ ${totalToday.toFixed(2)}`}
              icon={<ArrowLeftRight className="h-4 w-4 text-cyan-400" />}
              accent
            />
            <SummaryCard
              label="Storico precedente"
              value={`€ ${totalOlder.toFixed(2)}`}
              hint={`${olderTickets.length} conti`}
              icon={<ArchiveRestore className="h-4 w-4 text-cyan-400" />}
            />
          </section>

          {/* Tabella Storico */}
          <section className="rounded-2xl border border-slate-800 bg-slate-950/80 p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-sm font-extrabold text-white tracking-tight">
                {filter === "today" ? "Conti chiusi oggi" : "Tutti i conti"}
              </h2>
              <span className="text-xs font-bold text-slate-400">{list.length} elementi</span>
            </div>
            {loading ? (
              <p className="p-6 text-center text-xs text-slate-500">Caricamento storico in corso...</p>
            ) : list.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-800 p-6 text-center text-xs text-slate-500">
                Nessun conto presente.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-[11px] uppercase tracking-widest text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="py-3 pr-2 font-bold">Ticket</th>
                      <th className="py-3 pr-2 font-bold">Data / ora</th>
                      <th className="py-3 pr-2 font-bold">Tavolo</th>
                      <th className="py-3 pr-2 font-bold">Articoli</th>
                      <th className="py-3 pr-2 text-right font-bold">Totale</th>
                      <th className="py-3 pl-2 text-right font-bold">Azioni</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {list.map((t) => (
                      <tr key={t.id} className="hover:bg-slate-900/50 transition-colors">
                        <td className="py-3 pr-2 font-mono text-xs text-slate-400">
                          {t.id.slice(-8)}
                        </td>
                        <td className="py-3 pr-2 tabular-nums text-xs text-slate-300">
                          {new Date(t.closedAt).toLocaleString("it-IT")}
                        </td>
                        <td className="py-3 pr-2 font-bold text-white">{t.tableLabel}</td>
                        <td className="py-3 pr-2 text-xs text-slate-400">
                          {t.items.reduce((s, i) => s + i.qty, 0)} articoli
                        </td>
                        <td className="py-3 pr-2 text-right font-extrabold text-cyan-400 tabular-nums">
                          € {t.total.toFixed(2)}
                        </td>
                        <td className="py-3 pl-2 text-right">
                          {isToday(t.closedAt) ? (
                            <button
                              type="button"
                              onClick={() => handleReopen(t)}
                              className="inline-flex min-h-[32px] items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 text-xs font-bold text-slate-200 hover:border-cyan-500 hover:text-white transition-all cursor-pointer shadow-sm"
                            >
                              <RotateCcw className="h-3.5 w-3.5 text-cyan-400" />
                              Riapri
                            </button>
                          ) : (
                            <span className="text-xs text-slate-500 font-medium">Archiviato</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <div>
            <Link
              to="/"
              className="text-xs font-bold text-slate-400 hover:text-cyan-400 transition-colors underline underline-offset-4"
            >
              ← Torna alla Mappa Live
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

function useNavigateToMappa() {
  return () => {
    if (typeof window !== "undefined") window.location.href = "/";
  };
}

function SummaryCard({
  label,
  value,
  hint,
  icon,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div className={`rounded-2xl border p-5 shadow-xl transition-all ${accent ? 'bg-slate-950/90 border-cyan-500/50 shadow-[0_0_20px_rgba(6,182,212,0.15)]' : 'bg-slate-950/80 border-slate-800'}`}>
      <div className="flex items-center justify-between">
        <span
          className={[
            "inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-800 bg-slate-900",
          ].join(" ")}
        >
          {icon}
        </span>
      </div>
      <p className="mt-4 text-[11px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
      <p className={`mt-1 text-2xl font-black tabular-nums ${accent ? 'text-cyan-400' : 'text-white'}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}
