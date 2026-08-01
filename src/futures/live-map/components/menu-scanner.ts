import {
  scanMenuWithAI,
  scanIngredientsWithAI,
  scanAllergensWithAI,
  type ScannedDish,
  type ScannedIngredient,
  type ScannedAllergen,
} from "@/lib/menu-scan.functions";

export type { ScannedDish, ScannedIngredient, ScannedAllergen };

function fileToBase64(file: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const base64 = result.split(",")[1] || "";
      resolve({ base64, mimeType: file.type || "image/jpeg" });
    };
    reader.onerror = () => reject(new Error("Impossibile leggere il file"));
    reader.readAsDataURL(file);
  });
}

/** Scatta/carica una foto del menu ed estrae i piatti tramite IA (chiave API lato server). */
export async function scanMenuImage(file: File): Promise<ScannedDish[]> {
  const { base64, mimeType } = await fileToBase64(file);
  return await scanMenuWithAI({ data: { imageBase64: base64, mimeType } });
}

/** Scatta/carica una foto di ingredienti componibili (poke, bowl...) ed estrae nome/categoria/prezzo tramite IA. */
export async function scanIngredientsImage(file: File): Promise<ScannedIngredient[]> {
  const { base64, mimeType } = await fileToBase64(file);
  return await scanIngredientsWithAI({ data: { imageBase64: base64, mimeType } });
}

/** Scatta/carica una foto dell'elenco allergeni ed estrae nome/codice tramite IA. */
export async function scanAllergensImage(file: File): Promise<ScannedAllergen[]> {
  const { base64, mimeType } = await fileToBase64(file);
  return await scanAllergensWithAI({ data: { imageBase64: base64, mimeType } });
}
