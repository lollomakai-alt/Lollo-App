import { createServerFn } from "@tanstack/react-start";

export const config = {
  maxDuration: 60,
};

export type ScannedDish = {
  name: string;
  description: string;
  price: string;
  destination: "Cucina" | "Bar";
};

/** Funzione per formattare il testo: prima lettera maiuscola, il resto minuscolo */
function formatText(str: string): string {
  if (!str) return "";
  const trimmed = str.trim();
  if (trimmed.length === 0) return "";
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
}

const PROMPT =
  "Sei un assistente esperto nell'estrazione di dati da menu di ristoranti complessi, volantini o grafiche in stile social media (IG Stories). " +
  "Analizza l'immagine indipendentemente dai font utilizzati, dai colori di sfondo o dai box grafici. " +
  "Estrai TUTTI i piatti, i panini (shokupan), i sushi, i fritti o le bevande presenti. " +
  "Restituisci ESCLUSIVAMENTE un array JSON valido, senza testo aggiuntivo e senza blocchi markdown. " +
  'Ogni oggetto deve avere: ' +
  '"name" (string, il nome esatto del piatto, es. "Piña Rice", "Tornado", "Big Kahuna"), ' +
  '"description" (string, l\'elenco degli ingredienti o la descrizione testuale sotto il nome, oppure la categoria di appartenenza), ' +
  '"price" (string con due decimali, es. "16.00", "12.00", stringa vuota se assente), ' +
  '"destination" ("Bar" per bevande, cocktail, caffè; altrimenti "Cucina" per qualsiasi tipo di cibo).';

export type ScannedAllergen = {
  name: string;
  code: string;
};

const ALLERGENS_PROMPT =
  "Sei un assistente esperto nell'estrazione di elenchi di allergeni da foto di menu, tabelle o cartelli " +
  "informativi di ristoranti (secondo il Regolamento UE 1169/2011, es. Glutine, Crostacei, Uova, Pesce, " +
  "Arachidi, Soia, Latte, Frutta a guscio, Sedano, Senape, Semi di sesamo, Anidride solforosa e solfiti, " +
  "Lupini, Molluschi). Analizza l'immagine ed estrai TUTTI gli allergeni elencati, indipendentemente da font " +
  "o grafica, comprese eventuali numerazioni. " +
  "Restituisci ESCLUSIVAMENTE un array JSON valido, senza testo aggiuntivo e senza blocchi markdown. " +
  'Ogni oggetto deve avere: "name" (string, il nome esatto dell\'allergene, es. "Glutine", "Crostacei"), ' +
  '"code" (string, il numero o codice ufficiale se presente accanto al nome, es. "1", "14"; stringa vuota se assente).';

/** Scansione IA di una foto con l'elenco allergeni: gira solo sul server. */
export const scanAllergensWithAI = createServerFn({ method: "POST" })
  .inputValidator((input: { imageBase64: string; mimeType: string }) => {
    if (!input?.imageBase64) throw new Error("Immagine mancante");
    return { imageBase64: input.imageBase64, mimeType: input.mimeType || "image/jpeg" };
  })
  .handler(async ({ data }): Promise<ScannedAllergen[]> => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY non configurata");

    const res = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                { text: ALLERGENS_PROMPT },
                { inlineData: { mimeType: data.mimeType, data: data.imageBase64 } },
              ],
            },
          ],
          generationConfig: { temperature: 0, responseMimeType: "application/json" },
        }),
      },
    );

    const body = await res.text();
    if (!res.ok) {
      console.error(`[Gemini] Errore ${res.status}: ${body}`);
      throw new Error(`Gemini ha risposto ${res.status}: ${body.slice(0, 300)}`);
    }

    let text = "";
    try {
      const json = JSON.parse(body);
      text = json?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text ?? "").join("") ?? "";
    } catch {
      throw new Error("Risposta IA non leggibile");
    }

    let clean = text.replace(/```json/gi, "").replace(/```/g, "").trim();
    const start = clean.indexOf("[");
    const end = clean.lastIndexOf("]");
    const slice = start >= 0 && end > start ? clean.slice(start, end + 1) : clean;

    let parsed: any;
    try {
      parsed = JSON.parse(slice);
    } catch {
      console.error("Errore di parsing JSON grezzo:", clean);
      throw new Error("L'IA ha letto l'immagine ma la risposta non è formattata correttamente. Riprova con una foto più nitida.");
    }
    const list: any[] = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.allergens) ? parsed.allergens : [];

    const seenNames = new Set<string>();

    return list
      .filter((d) => d && typeof d.name === "string" && d.name.trim() !== "")
      .map((d) => ({
        name: formatText(String(d.name)),
        code: String(d.code ?? "").trim(),
      }))
      .filter((a) => {
        const key = a.name.toLowerCase();
        if (seenNames.has(key)) return false;
        seenNames.add(key);
        return true;
      });
  });
export type ScannedIngredient = {
  name: string;
  category: "Proteina" | "Salsa" | "Topping" | "Side";
  price: string;
};

const INGREDIENTS_PROMPT =
  "Sei un assistente esperto nell'estrazione di ingredienti componibili da foto di menu (es. poke bar, bowl, insalatone). " +
  "Analizza l'immagine ed estrai TUTTI gli ingredienti disponibili per comporre il piatto, indipendentemente da font o grafica. " +
  "Classifica ogni ingrediente in una di queste categorie ESATTE: " +
  '"Proteina" (es. salmone, tonno, pollo, tofu), ' +
  '"Salsa" (es. teriyaki, agrodolce, maionese, soia), ' +
  '"Topping" (es. mandorle, mais, sesamo, cipolla croccante), ' +
  '"Side" (es. mango, edamame, avocado, alga wakame). ' +
  "Restituisci ESCLUSIVAMENTE un array JSON valido, senza testo aggiuntivo e senza blocchi markdown. " +
  'Ogni oggetto deve avere: "name" (string, nome esatto dell\'ingrediente), ' +
  '"category" (string, una delle quattro categorie sopra elencate, esattamente come scritte), ' +
  '"price" (string con due decimali, es. "1.00", "0.00" se l\'ingrediente è incluso senza sovrapprezzo).';

/** Scansione IA di una foto di ingredienti componibili (poke, bowl...): gira solo sul server. */
export const scanIngredientsWithAI = createServerFn({ method: "POST" })
  .inputValidator((input: { imageBase64: string; mimeType: string }) => {
    if (!input?.imageBase64) throw new Error("Immagine mancante");
    return { imageBase64: input.imageBase64, mimeType: input.mimeType || "image/jpeg" };
  })
  .handler(async ({ data }): Promise<ScannedIngredient[]> => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY non configurata");

    const res = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                { text: INGREDIENTS_PROMPT },
                { inlineData: { mimeType: data.mimeType, data: data.imageBase64 } },
              ],
            },
          ],
          generationConfig: { temperature: 0, responseMimeType: "application/json" },
        }),
      },
    );

    const body = await res.text();
    if (!res.ok) {
      console.error(`[Gemini] Errore ${res.status}: ${body}`);
      throw new Error(`Gemini ha risposto ${res.status}: ${body.slice(0, 300)}`);
    }

    let text = "";
    try {
      const json = JSON.parse(body);
      text = json?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text ?? "").join("") ?? "";
    } catch {
      throw new Error("Risposta IA non leggibile");
    }

    let clean = text.replace(/```json/gi, "").replace(/```/g, "").trim();
    const start = clean.indexOf("[");
    const end = clean.lastIndexOf("]");
    const slice = start >= 0 && end > start ? clean.slice(start, end + 1) : clean;

    let parsed: any;
    try {
      parsed = JSON.parse(slice);
    } catch {
      console.error("Errore di parsing JSON grezzo:", clean);
      throw new Error("L'IA ha letto l'immagine ma la risposta non è formattata correttamente. Riprova con una foto più nitida.");
    }
    const list: any[] = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.ingredients) ? parsed.ingredients : [];

    const validCategories = new Set(["Proteina", "Salsa", "Topping", "Side"]);
    const seenNames = new Set<string>();

    return list
      .filter((d) => d && typeof d.name === "string" && d.name.trim() !== "")
      .map((d) => {
        const rawPrice = String(d.price ?? "").replace(/[^\d.,]/g, "").replace(",", ".");
        const num = Number.parseFloat(rawPrice);
        const category = validCategories.has(String(d.category)) ? String(d.category) : "Topping";
        return {
          name: formatText(String(d.name)),
          category: category as ScannedIngredient["category"],
          price: Number.isFinite(num) ? num.toFixed(2) : "0.00",
        };
      })
      .filter((ing) => {
        const key = `${ing.category}:${ing.name.toLowerCase()}`;
        if (seenNames.has(key)) return false;
        seenNames.add(key);
        return true;
      });
  });
export const scanMenuWithAI = createServerFn({ method: "POST" })
  .inputValidator((input: { imageBase64: string; mimeType: string }) => {
    if (!input?.imageBase64) throw new Error("Immagine mancante");
    return { imageBase64: input.imageBase64, mimeType: input.mimeType || "image/jpeg" };
  })
  .handler(async ({ data }): Promise<ScannedDish[]> => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY non configurata");

    const res = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                { text: PROMPT },
                { inlineData: { mimeType: data.mimeType, data: data.imageBase64 } },
              ],
            },
          ],
          generationConfig: { temperature: 0, responseMimeType: "application/json" },
        }),
      },
    );

    const body = await res.text();
    if (!res.ok) {
      console.error(`[Gemini] Errore ${res.status}: ${body}`);
      throw new Error(`Gemini ha risposto ${res.status}: ${body.slice(0, 300)}`);
    }

    let text = "";
    try {
      const json = JSON.parse(body);
      text = json?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text ?? "").join("") ?? "";
    } catch {
      throw new Error("Risposta IA non leggibile");
    }

    let clean = text.replace(/```json/gi, "").replace(/```/g, "").trim();
    const start = clean.indexOf("[");
    const end = clean.lastIndexOf("]");
    const slice = start >= 0 && end > start ? clean.slice(start, end + 1) : clean;

    let parsed: any;
    try {
      parsed = JSON.parse(slice);
    } catch {
      console.error("Errore di parsing JSON grezzo:", clean);
      throw new Error("L'IA ha letto l'immagine ma la risposta non è formattata correttamente. Riprova con una foto più nitida.");
    }
    const list: any[] = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.dishes) ? parsed.dishes : [];

    // Set per tracciare i nomi ed evitare duplicati nella stessa scansione
    const seenNames = new Set<string>();

    return list
      .filter((d) => d && typeof d.name === "string" && d.name.trim() !== "")
      .map((d) => {
        const rawPrice = String(d.price ?? "").replace(/[^\d.,]/g, "").replace(",", ".");
        const num = Number.parseFloat(rawPrice);
        return {
          name: formatText(String(d.name)),
          description: formatText(String(d.description ?? "")),
          price: Number.isFinite(num) ? num.toFixed(2) : "0.00",
          destination: String(d.destination).toLowerCase() === "bar" ? "Bar" : "Cucina",
        } as ScannedDish;
      })
      .filter((dish) => {
        const key = dish.name.toLowerCase();
        if (seenNames.has(key)) {
          return false;
        }
        seenNames.add(key);
        return true;
      });
  });
