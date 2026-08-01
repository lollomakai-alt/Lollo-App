import { supabase } from "@/lib/supabase";
import { fetchTables, updateTable, writeSpan, type PosTable } from "@/lib/tables-api";

const SETTINGS_KEY = "layout_snapshot";

export type LayoutSnapshotEntry = {
  id: string;
  x: number;
  y: number;
  span: number;
  roomPrefix?: string;
};

/** Salva la disposizione attuale di tutti i tavoli (posizione, ingombro, sala) come layout definitivo. */
export async function saveLayoutSnapshot(): Promise<{ ok: boolean; count: number }> {
  try {
    const tables = await fetchTables();
    const snapshot: LayoutSnapshotEntry[] = tables.map((t) => ({
      id: t.id,
      x: t.x,
      y: t.y,
      span: t.span,
      roomPrefix: t.roomPrefix,
    }));
    const { error } = await supabase
      .from("settings")
      .upsert({ key: SETTINGS_KEY, value: JSON.stringify(snapshot) }, { onConflict: "key" });
    if (error) throw error;
    return { ok: true, count: snapshot.length };
  } catch (err) {
    console.error("[Supabase] Errore salvataggio layout definitivo:", err);
    return { ok: false, count: 0 };
  }
}

/** True se esiste già un layout definitivo salvato. */
export async function hasLayoutSnapshot(): Promise<boolean> {
  const { data } = await supabase.from("settings").select("value").eq("key", SETTINGS_KEY).maybeSingle();
  return !!data?.value;
}

/** Riporta tutti i tavoli esistenti alla posizione/ingombro/sala salvati nel layout definitivo. */
export async function restoreLayoutSnapshot(): Promise<{ ok: boolean; restored: number }> {
  try {
    const { data, error } = await supabase.from("settings").select("value").eq("key", SETTINGS_KEY).maybeSingle();
    if (error) throw error;
    if (!data?.value) return { ok: false, restored: 0 };

    const snapshot: LayoutSnapshotEntry[] = JSON.parse(data.value);
    const currentTables = await fetchTables();
    const currentIds = new Set(currentTables.map((t) => t.id));

    let restored = 0;
    for (const entry of snapshot) {
      if (!currentIds.has(entry.id)) continue; // il tavolo non esiste più (eliminato dopo lo snapshot)
      await updateTable(entry.id, { x: entry.x, y: entry.y, roomPrefix: entry.roomPrefix });
      writeSpan(entry.id, entry.span || 1);
      restored++;
    }
    return { ok: true, restored };
  } catch (err) {
    console.error("[Supabase] Errore ripristino layout definitivo:", err);
    return { ok: false, restored: 0 };
  }
}
