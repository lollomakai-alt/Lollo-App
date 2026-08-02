import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { MapPinned, Save, CheckCircle2, FileText, ImageIcon, Upload, Store, MessageSquareQuote, QrCode, Sparkles, AlarmClock } from "lucide-react";
import { TopNav } from "@/components/top-nav";
import { supabase } from "@/lib/supabase";
import { fetchAlertThreshold, saveAlertThreshold, DEFAULT_ALERT_THRESHOLD_MINUTES } from "@/lib/alert-settings-api";
import { saveLayoutSnapshot } from "@/lib/layout-snapshot-api";

export const Route = createFileRoute("/settings")({
  component: SettingsScreen,
});

function SettingsScreen() {
  const [menuFile, setMenuFile] = useState<string>("Nessun file selezionato");
  const [photos, setPhotos] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  // Stati unificati per le impostazioni della tabella "settings" su Supabase[span_0](start_span)[span_0](end_span)
  const [restaurantName, setRestaurantName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [receiptFooter, setReceiptFooter] = useState("");
  const [googleReviewLink, setGoogleReviewLink] = useState("");
  const [alertThreshold, setAlertThreshold] = useState<number>(DEFAULT_ALERT_THRESHOLD_MINUTES);
  const [savingLayout, setSavingLayout] = useState(false);
  const [layoutSaved, setLayoutSaved] = useState(false);
  const [loadingSettings, setLoadingSettings] = useState(true);

  // Carica i dati da Supabase e il layout salvato all'avvio della schermata[span_1](start_span)[span_1](end_span)
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        setLoadingSettings(true);
        const { data, error } = await supabase.from("settings").select("*");
        if (error) throw error;
        
        if (data) {
          data.forEach((row: Record<string, any>) => {
            if (row.key === "nome_locale") {
              setRestaurantName(row.value || "");
            }
            if (row.key === "indirizzo_locale") {
              setAddress(row.value || "");
            }
            if (row.key === "phone") {
              setPhone(row.value || "");
            }
            if (row.key === "saluti") {
              setReceiptFooter(row.value || "");
            }
            if (row.key === "qr_code") {
              setGoogleReviewLink(row.value || "");
            }
          });
        }
      } catch (err) {
        console.error("Errore nel caricamento delle impostazioni da Supabase:", err);
      } finally {
        setLoadingSettings(false);
      }
    };

    fetchSettings();
    fetchAlertThreshold().then(setAlertThreshold);
  }, []);

  // Funzione di salvataggio del layout definitivo su Supabase
  const handleSaveLayout = async () => {
    setSavingLayout(true);
    try {
      const result = await saveLayoutSnapshot();
      if (result.ok) {
        setLayoutSaved(true);
        setTimeout(() => setLayoutSaved(false), 3000);
      }
    } finally {
      setSavingLayout(false);
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      const updates = [
        { key: "nome_locale", value: restaurantName },
        { key: "indirizzo_locale", value: address },
        { key: "phone", value: phone },
        { key: "saluti", value: receiptFooter },
        { key: "qr_code", value: googleReviewLink },
      ];

      for (const item of updates) {
        const { error } = await supabase
          .from("settings")
          .upsert({ key: item.key, value: item.value }, { onConflict: "key" });
        if (error) throw error;
      }
      await saveAlertThreshold(alertThreshold);

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error("Errore durante il salvataggio su Supabase:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full flex-col bg-[#030712] text-slate-100">
      <TopNav active="Impostazioni" />
      <main className="mx-auto w-full max-w-4xl flex-1 space-y-6 p-4 lg:p-6">
        {/* ── Header ── */}
        <div className="bg-slate-950/80 p-5 rounded-2xl border border-cyan-500/30 backdrop-blur-xl shadow-[0_0_25px_rgba(6,182,212,0.15)]">
          <h1 className="text-xl font-black tracking-tight text-white flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-cyan-400" /> Impostazioni Locale
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Configura i dati del locale, il layout della mappa, il menu ed i media sincronizzati con Supabase.
          </p>
        </div>

        {/* ── Dati del Locale ── */}
        <section className="rounded-2xl border border-slate-800 bg-slate-950/80 p-5 shadow-xl space-y-4">
          <div className="flex items-center gap-2 border-b pb-3 border-slate-800">
            <Store className="h-5 w-5 text-cyan-400" />
            <h2 className="text-base font-extrabold text-white">Informazioni Generali del Locale</h2>
          </div>
          <p className="text-xs text-slate-400">
            Questi dati verranno utilizzati automaticamente nei preconti, nelle stampe termiche e nell'intestazione dell'app.
          </p>

          {loadingSettings ? (
            <p className="text-xs text-slate-500 py-4">Caricamento impostazioni in corso...</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Nome Locale</label>
                <input
                  type="text"
                  value={restaurantName}
                  onChange={(e) => setRestaurantName(e.target.value)}
                  placeholder="Es: Nakai Tiki Bar"
                  className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500 transition-colors"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Indirizzo</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Es: Via dei Tiki, 1 - Roma"
                  className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500 transition-colors"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Telefono</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Es: 061234567"
                  className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500 transition-colors"
                />
              </div>
            </div>
          )}
        </section>

        {/* ── Messaggio di Cortesia / Saluti Scontrino ── */}
        <section className="rounded-2xl border border-slate-800 bg-slate-950/80 p-5 shadow-xl space-y-4">
          <div className="flex items-center gap-2 border-b pb-3 border-slate-800">
            <MessageSquareQuote className="h-5 w-5 text-cyan-400" />
            <h2 className="text-base font-extrabold text-white">Messaggio di Cortesia / Saluti per lo Scontrino</h2>
          </div>
          <p className="text-xs text-slate-400">
            Questo testo comparirà in fondo allo scontrino o al conto stampato (es. ringraziamenti, orari o link social).
          </p>

          {!loadingSettings && (
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Testo di Chiusura Scontrino</label>
              <textarea
                rows={2}
                value={receiptFooter}
                onChange={(e) => setReceiptFooter(e.target.value)}
                placeholder="Es: Grazie e Arrivederci! Seguici su Instagram @ristorante"
                className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500 transition-colors"
              />
            </div>
          )}
        </section>

        {/* ── Link Recensioni Google (QR Code) ── */}
        <section className="rounded-2xl border border-slate-800 bg-slate-950/80 p-5 shadow-xl space-y-4">
          <div className="flex items-center gap-2 border-b pb-3 border-slate-800">
            <QrCode className="h-5 w-5 text-cyan-400" />
            <h2 className="text-base font-extrabold text-white">QR Code Recensioni Google</h2>
          </div>
          <p className="text-xs text-slate-400">
            Inserisci il link diretto alla pagina Google My Business o recensioni del locale. Verrà stampato un QR code in fondo al preconto.
          </p>

          {!loadingSettings && (
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">URL Google Maps / Recensioni</label>
              <input
                type="url"
                value={googleReviewLink}
                onChange={(e) => setGoogleReviewLink(e.target.value)}
                placeholder="Es: https://g.page/r/tuo-link-google/review"
                className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500 transition-colors"
              />
            </div>
          )}
        </section>

        {/* ── Alert Tavoli in Attesa ── */}
        <section className="rounded-2xl border border-slate-800 bg-slate-950/80 p-5 shadow-xl space-y-4">
          <div className="flex items-center gap-2 border-b pb-3 border-slate-800">
            <AlarmClock className="h-5 w-5 text-cyan-400" />
            <h2 className="text-base font-extrabold text-white">Alert Tavoli in Attesa</h2>
          </div>
          <p className="text-xs text-slate-400">
            Se un tavolo resta in attesa (portata non ancora servita) oltre questa soglia, sulla Mappa Live
            comparirà un alert visivo pulsante per aiutare i camerieri a non perdere il ritmo durante il rush.
            Imposta <span className="font-bold text-slate-300">0</span> per disattivare completamente l'alert.
          </p>

          {!loadingSettings && (
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={0}
                value={alertThreshold}
                onChange={(e) => setAlertThreshold(Math.max(0, Number(e.target.value) || 0))}
                className="w-24 rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500 transition-colors font-mono"
              />
              <span className="text-xs text-slate-400 font-semibold">
                {alertThreshold === 0 ? "minuti (alert disattivato)" : "minuti"}
              </span>
            </div>
          )}
        </section>

        {/* ── Layout Definitivo Mappa ── */}
        <section className="rounded-2xl border border-slate-800 bg-slate-950/80 p-5 shadow-xl space-y-4">
          <div className="flex items-center gap-2 border-b pb-3 border-slate-800">
            <MapPinned className="h-5 w-5 text-cyan-400" />
            <h2 className="text-base font-extrabold text-white">Layout Definitivo Mappa</h2>
          </div>
          <p className="text-xs text-slate-400">
            Salva la disposizione attuale dei tavoli (posizione, ingombro, sala) come layout di riferimento.
            Da quel momento, sulla Mappa Live il pulsante "Ripristina tavoli" riporterà istantaneamente
            i tavoli a questa disposizione, anche se nel frattempo sono stati spostati per errore.
          </p>
          <button
            onClick={handleSaveLayout}
            disabled={savingLayout}
            className="inline-flex items-center gap-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 px-4 py-2.5 text-xs font-black text-slate-950 uppercase tracking-wide transition-all"
          >
            {layoutSaved ? <CheckCircle2 className="h-4 w-4" /> : <MapPinned className="h-4 w-4" />}
            {layoutSaved ? "Layout salvato!" : savingLayout ? "Salvataggio…" : "Salva layout definitivo mappa attuale"}
          </button>
        </section>

        {/* ── Media ── */}
        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-5 shadow-xl space-y-3">
            <div className="flex items-center gap-2 border-b pb-3 border-slate-800">
              <FileText className="h-5 w-5 text-cyan-400" />
              <h3 className="text-sm font-extrabold text-white">Carica Menu (PDF/IMG)</h3>
            </div>
            <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-800 bg-slate-900/50 px-4 py-6 text-center text-xs text-slate-400 hover:border-cyan-500/50 hover:text-white transition-all">
              <Upload className="h-5 w-5 text-cyan-400" />
              <span>Seleziona un file</span>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                className="hidden"
                onChange={(e) => setMenuFile(e.target.files?.[0]?.name ?? "Nessun file selezionato")}
              />
              <span className="text-xs font-bold text-white">{menuFile}</span>
            </label>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-5 shadow-xl space-y-3">
            <div className="flex items-center gap-2 border-b pb-3 border-slate-800">
              <ImageIcon className="h-5 w-5 text-cyan-400" />
              <h3 className="text-sm font-extrabold text-white">Carica Foto Locale</h3>
            </div>
            <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-800 bg-slate-900/50 px-4 py-6 text-center text-xs text-slate-400 hover:border-cyan-500/50 hover:text-white transition-all">
              <Upload className="h-5 w-5 text-cyan-400" />
              <span>Seleziona una o più foto</span>
              <input
                type="file"
                multiple
                accept="image/*"
                className="hidden"
                onChange={(e) => setPhotos(Array.from(e.target.files ?? []).map((f) => f.name))}
              />
              <span className="text-xs font-bold text-white">
                {photos.length > 0 ? photos.join(", ") : "Nessuna foto selezionata"}
              </span>
            </label>
          </div>
        </section>

        {/* ── Salva tutto su Supabase ── */}
        <div className="flex justify-end pb-6">
          <button
            type="button"
            onClick={handleSave}
            disabled={loading}
            className={[
              "inline-flex items-center gap-2 rounded-xl px-6 py-3 text-xs font-bold uppercase tracking-wider transition-all shadow-xl cursor-pointer",
              saved ? "bg-emerald-500 text-slate-950 font-black shadow-[0_0_15px_rgba(16,185,129,0.4)]" : "neon-btn-cyan",
              loading ? "opacity-50 cursor-not-allowed" : "",
            ].join(" ")}
          >
            {saved ? (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Salvato su Supabase!
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                {loading ? "Salvataggio in corso..." : "Salva impostazioni su Supabase"}
              </>
            )}
          </button>
        </div>
      </main>
    </div>
  );
}
