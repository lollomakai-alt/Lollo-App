import { supabase } from "@/lib/supabase";

export interface Allergen {
  id: string;
  name: string;
  /** Numero/codice ufficiale se presente (es. "1", "14"), facoltativo. */
  code?: string;
}

const SETTINGS_KEY = "allergeni_list";

export async function fetchAllergens(): Promise<Allergen[]> {
  const { data, error } = await supabase.from("settings").select("*").eq("key", SETTINGS_KEY).maybeSingle();
  if (error) {
    console.error("[Supabase] Errore recupero allergeni:", error.message);
    return [];
  }
  if (!data?.value) return [];
  try {
    const parsed = JSON.parse(data.value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveAllergens(list: Allergen[]): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("settings")
      .upsert({ key: SETTINGS_KEY, value: JSON.stringify(list) }, { onConflict: "key" });
    if (error) throw error;
    return true;
  } catch (err) {
    console.error("[Supabase] Errore salvataggio allergeni:", err);
    return false;
  }
}
