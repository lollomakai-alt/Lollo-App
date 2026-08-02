import { createServerFn } from "@tanstack/react-start";

export const config = {
  maxDuration: 60,
};

export type ScannedDish = {
  name: string;
  description: string;
  price: string;
  destination: "Cucina" | "Bar";
  isComposable: boolean;
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
  "Estrai TUTTI i piatti, i panini (shokupan), i sushi, i fritti o le bevande presenti, cioè le voci che hanno un proprio nome e un proprio prezzo. " +
  "Se l'immagine contiene ANCHE una sezione dove il cliente compone il proprio piatto scegliendo tra gruppi di ingredienti " +
  "(es. \"Proteina\", \"Side\", \"Topping\", \"Sauce\", tipico di poke bar/bowl), NON elencare i singoli ingredienti di quei gruppi come piatti a sé: " +
  "estrai invece UNA SOLA voce per l'intera sezione componibile (es. nome \"Poke\" o il nome scritto sopra la sezione, col prezzo base indicato, " +
  "es. \"14.00\" se scritto \"Your Poké 14\"), impostando \"isComposable\" a true per quella voce. Gli ingredienti dettagliati di quella sezione " +
  "verranno gestiti a parte con uno scanner dedicato, non includerli come piatti separati né nella descrizione. " +
  "Restituisci ESCLUSIVAMENTE un array JSON valido, senza testo aggiuntivo e senza blocchi markdown. " +
  'Ogni oggetto deve avere: ' +
  '"name" (string, il nome esatto del piatto, es. "Piña Rice", "Tornado", "Big Kahuna"), ' +
  '"description" (string, SEMPRE l\'elenco degli ingredienti così come scritti sotto il nome del piatto, es. "Pomodoro, mozzarella, basilico"; stringa vuota se il menu non elenca ingredienti per quel piatto -- non scrivere qui la categoria/sezione del menu), ' +
  '"price" (string con due decimali, es. "16.00", "12.00", stringa vuota se assente), ' +
  '"destination" ("Bar" per bevande, cocktail, caffè; altrimenti "Cucina" per qualsiasi tipo di cibo), ' +
  '"isComposable" (boolean, true SOLO per la voce che rappresenta un\'intera sezione "componi il tuo piatto", false per tutti gli altri piatti normali).';

export type ScannedAllergen = {
  name: string;
  code: string;
};

const ALLERGENS_PROMPT =
  "Sei un assistente esperto nell'estrazione di elenchi di allergeni da foto di menu, tabelle o cartelli " +
  "informativi di ristoranti (secondo il Regolamento UE 1169/2011, es. Glutine, Crostacei, Uova, Pesce, " +
  "Arachidi, Soia, Latte, Frutta a guscio, Sedano, Senape, Semi di sesamo, Anidride solforosa e solfiti, " +
  "Lupini, Molluschi). Estrai SOLO la legenda ufficiale degli allergeni: di solito è una lista numerata con " +
  "un numero/codice seguito dal nome dell'allergene (es. \"1 Glutine\", \"6 Pesce\"). " +
  "L'immagine può contenere ANCHE un elenco di piatti con accanto i numeri degli allergeni che contengono " +
  "(es. \"gamberi in tempura - 1, 4, 5\"): IGNORA COMPLETAMENTE quella parte, non è la legenda e non va estratta " +
  "come se i nomi dei piatti fossero allergeni. " +
  "Restituisci ESCLUSIVAMENTE un array JSON valido, senza testo aggiuntivo e senza blocchi markdown. " +
  'Ogni oggetto deve avere: "name" (string, il nome esatto dell\'allergene, es. "Glutine", "Crostacei"), ' +
  '"code" (string, il numero o codice ufficiale della legenda accanto al nome, es. "1", "14"; stringa vuota se assente).';

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
  category: string;
  price: string;
};

const INGREDIENTS_PROMPT =
  "Sei un assistente esperto nell'estrazione di ingredienti componibili da foto di menu (es. poke bar, bowl, insalatone). " +
  "L'immagine può contenere ANCHE piatti finiti già pronti con un loro prezzo (es. antipasti, involtini, ravioli): IGNORALI COMPLETAMENTE, " +
  "non sono ingredienti componibili. Concentrati SOLO sulla sezione dove il cliente compone il proprio piatto scegliendo tra gruppi di " +
  "ingredienti organizzati per categoria (es. una sezione tipo \"Componi il tuo poke\" con sottogruppi come Proteina, Side, Topping, Salsa/Sauce). " +
  "Estrai TUTTI gli ingredienti di quella sezione, indipendentemente da font o grafica. " +
  'Ogni oggetto deve avere: "name" (string, nome esatto dell\'ingrediente, es. "Salmone", "Edamame"), ' +
  '"category" (string, il nome ESATTO della categoria/sottogruppo così come scritto nella foto, es. "Proteina", "Side", "Topping", "Sauce" -- NON tradurlo e NON forzarlo su una lista fissa, scrivilo verbatim), ' +
  '"price" (string con due decimali, es. "1.00"; "0.00" se l\'ingrediente è incluso nel prezzo base senza sovrapprezzo, come spesso accade in queste sezioni). ' +
  "Restituisci ESCLUSIVAMENTE un array JSON valido, senza testo aggiuntivo e senza blocchi markdown.";

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

    const seenNames = new Set<string>();

    return list
      .filter((d) => d && typeof d.name === "string" && d.name.trim() !== "")
      .map((d) => {
        const rawPrice = String(d.price ?? "").replace(/[^\d.,]/g, "").replace(",", ".");
        const num = Number.parseFloat(rawPrice);
        const category = formatText(String(d.category ?? "").trim()) || "Altro";
        return {
          name: formatText(String(d.name)),
          category,
          price: Number.isFinite(num) ? num.toFixed(2) : "0.00",
        };
      })
      .filter((ing) => {
        const key = `${ing.category.toLowerCase()}:${ing.name.toLowerCase()}`;
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
          isComposable: d.isComposable === true,
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
