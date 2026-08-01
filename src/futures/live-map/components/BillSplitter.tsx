import React, { useState } from "react";
import { supabase } from "@/lib/supabase";

interface BillSplitterProps {
  tableId: string;
  tableLabel: string;
  totalAmount: number; // Totale prodotti iniziale
  onClose: () => void;
  onFlash: (msg: string) => void;
}

export const BillSplitter: React.FC<BillSplitterProps> = ({
  tableId,
  tableLabel,
  totalAmount,
  onClose,
  onFlash,
}) => {
  const [splitCount, setSplitCount] = useState(1);
  const [coverCount, setCoverCount] = useState(0); // Numero coperti
  const [coverPrice, setCoverPrice] = useState(0); // Costo unitario coperto (può essere 0)
  const [discountPercent, setDiscountPercent] = useState(0); // Sconto %
  const [paymentMethod, setPaymentMethod] = useState<"contanti" | "carta" | "altro">("carta");

  // Calcoli
  const totalCovers = coverCount * coverPrice;
  const subtotalBeforeDiscount = totalAmount + totalCovers;
  const discountAmount = (subtotalBeforeDiscount * discountPercent) / 100;
  const finalTotal = Math.max(0, subtotalBeforeDiscount - discountAmount);
  const amountPerPerson = finalTotal / (splitCount > 0 ? splitCount : 1);

  const handleCompletePayment = async () => {
    try {
      const { error } = await supabase
        .from("Tables")
        .update({ status: "free" })
        .eq("id", tableId);

      if (error) throw error;

      onFlash(`Conto del tavolo ${tableLabel} chiuso con successo (€ ${finalTotal.toFixed(2)} - ${paymentMethod})! 💳`);
      onClose();
    } catch (err) {
      console.error("Errore durante la chiusura del conto:", err);
      onFlash("Errore di connessione con il database durante il pagamento.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md rounded-3xl bg-zinc-950 border border-emerald-500/50 p-6 shadow-[0_0_60px_rgba(16,185,129,0.25)] text-white flex flex-col gap-4 ring-1 ring-emerald-400/20 max-h-[90vh] overflow-y-auto">
        
        {/* Header Modale */}
        <div className="flex items-center justify-between border-b border-emerald-500/20 pb-4">
          <div>
            <h3 className="text-xl font-extrabold text-emerald-400 drop-shadow-[0_0_10px_rgba(16,185,129,0.4)]">
              Chiusura Conto - Tavolo {tableLabel}
            </h3>
            <p className="text-xs text-zinc-400 mt-1">
              Totale Prodotti: <span className="font-bold text-emerald-300">€ {totalAmount.toFixed(2)}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl bg-zinc-900 border border-zinc-800 p-2 text-zinc-400 hover:bg-zinc-800 hover:text-white hover:border-emerald-500/40 transition-all"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-col gap-4">
          
          {/* Gestione Coperti */}
          <div className="flex flex-col gap-2 bg-black/40 p-3.5 rounded-2xl border border-emerald-500/20">
            <label className="text-xs font-bold uppercase tracking-wider text-emerald-400/80">
              Gestione Coperti
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <span className="text-[11px] text-zinc-400">N. Coperti:</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCoverCount(Math.max(0, coverCount - 1))}
                    className="w-7 h-7 rounded-lg bg-zinc-900 border border-zinc-800 font-bold text-zinc-300 hover:bg-rose-500/20"
                  >-</button>
                  <span className="text-sm font-extrabold text-emerald-300 w-6 text-center">{coverCount}</span>
                  <button
                    onClick={() => setCoverCount(coverCount + 1)}
                    className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-500/50 font-bold text-emerald-300 hover:bg-emerald-500/30"
                  >+</button>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[11px] text-zinc-400">Costo Cad. (€):</span>
                <input
                  type="number"
                  min="0"
                  step="0.50"
                  value={coverPrice}
                  onChange={(e) => setCoverPrice(Math.max(0, Number(e.target.value)))}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-2.5 py-1 text-xs text-emerald-300 font-bold focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
            {coverCount > 0 && (
              <div className="text-[11px] text-emerald-400 text-right mt-1">
                Totale Coperti: € {totalCovers.toFixed(2)}
              </div>
            )}
          </div>

          {/* Gestione Sconto */}
          <div className="flex flex-col gap-2 bg-black/40 p-3.5 rounded-2xl border border-emerald-500/20">
            <label className="text-xs font-bold uppercase tracking-wider text-emerald-400/80">
              Sconto Applicato (%)
            </label>
            <div className="flex items-center gap-2">
              {[0, 5, 10, 15, 20, 50].map((pct) => (
                <button
                  key={pct}
                  onClick={() => setDiscountPercent(pct)}
                  className={`flex-1 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                    discountPercent === pct
                      ? "bg-emerald-500 text-black border-emerald-400 font-black"
                      : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white"
                  }`}
                >
                  {pct}%
                </button>
              ))}
            </div>
          </div>

          {/* Divisione Conto (Split) */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold uppercase tracking-wider text-emerald-400/80">
              Dividi in parti uguali
            </label>
            <div className="flex items-center justify-between bg-black p-3.5 rounded-2xl border border-emerald-500/20 shadow-inner">
              <span className="text-sm text-zinc-300">Numero persone:</span>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setSplitCount(Math.max(1, splitCount - 1))}
                  className="w-8 h-8 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-200 hover:bg-rose-500/20 font-bold transition-all active:scale-90"
                >
                  -
                </button>
                <span className="text-base font-extrabold w-6 text-center text-emerald-300">{splitCount}</span>
                <button
                  onClick={() => setSplitCount(splitCount + 1)}
                  className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 hover:bg-emerald-500/30 font-bold transition-all active:scale-90"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          {/* Metodo di Pagamento */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold uppercase tracking-wider text-emerald-400/80">
              Metodo di Pagamento
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              {(["carta", "contanti", "altro"] as const).map((method) => (
                <button
                  key={method}
                  onClick={() => setPaymentMethod(method)}
                  className={`py-2.5 rounded-xl text-xs font-bold capitalize transition-all border duration-300 ${
                    paymentMethod === method
                      ? "bg-emerald-500/25 text-emerald-300 border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.35)]"
                      : "bg-black text-zinc-400 border-zinc-800 hover:bg-zinc-900 hover:text-zinc-200"
                  }`}
                >
                  {method}
                </button>
              ))}
            </div>
          </div>

          {/* Box Riepilogo Totale */}
          <div className="bg-emerald-950/30 border border-emerald-500/40 p-4 rounded-2xl flex flex-col gap-1">
            <div className="flex justify-between text-xs text-zinc-300">
              <span>Subtotale (Prodotti + Coperti):</span>
              <span>€ {subtotalBeforeDiscount.toFixed(2)}</span>
            </div>
            {discountPercent > 0 && (
              <div className="flex justify-between text-xs text-rose-400">
                <span>Sconto ({discountPercent}%):</span>
                <span>- € {discountAmount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-black text-emerald-400 pt-2 border-t border-emerald-500/20">
              <span>TOTALE FINALE:</span>
              <span className="text-lg">€ {finalTotal.toFixed(2)}</span>
            </div>
            {splitCount > 1 && (
              <div className="text-xs text-emerald-300 text-right mt-1 font-semibold">
                Quota a persona ({splitCount}): € {amountPerPerson.toFixed(2)}
              </div>
            )}
          </div>

        </div>

        <button
          onClick={handleCompletePayment}
          className="w-full rounded-2xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/60 py-3.5 text-sm font-bold text-emerald-300 shadow-[0_0_25px_rgba(16,185,129,0.3)] transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
        >
          <span>💳 Conferma Pagamento e Libera Tavolo</span>
        </button>
      </div>
    </div>
  );
};
