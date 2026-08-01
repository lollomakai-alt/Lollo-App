import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Save,
  Trash2,
  PencilLine,
  UtensilsCrossed,
  Upload,
  Loader2,
  Camera,
  Search,
  Filter,
  Layers,
  AlertTriangle,
  Zap,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import {
  MenuDestination,
  MenuDish,
  DishIngredient,
  CategoryRule,
  CATEGORY_SUGGESTIONS,
  DEFAULT_CATEGORY_RULE,
  useMenuDishes,
} from "../lib/menu-data";
import { TopNav } from "../components/top-nav";
import { fetchMenuDishesFromSupabase, saveDishToSupabase, deleteDishFromSupabase } from "../lib/supabase-service";
import { fetchAllergens, saveAllergens, type Allergen } from "../lib/allergens-api";
import { fetchCourses, saveCourses } from "../lib/courses-api";
import { scanMenuImage, scanIngredientsImage, scanAllergensImage } from "../futures/live-map/components/menu-scanner";
import type { ScannedDish, ScannedIngredient, ScannedAllergen } from "../futures/live-map/components/menu-scanner";

export const Route = createFileRoute("/menu")({
  component: MenuManagementPage,
});

function MenuManagementPage() {
  const [dishes, setDishes] = useMenuDishes();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState("Tutti");

  useEffect(() => {
    fetchMenuDishesFromSupabase().then((supaDishes) => {
      if (supaDishes && supaDishes.length > 0) {
        setDishes(supaDishes);
      }
    });
  }, []);

  // Elenco allergeni: caricato da Supabase (tabella settings, chiave "allergeni_list")
  const [allergens, setAllergens] = useState<Allergen[]>([]);
  const [allergenName, setAllergenName] = useState("");
  const [allergenCode, setAllergenCode] = useState("");
  const [showAllergenScanner, setShowAllergenScanner] = useState(false);
  const [allergenImage, setAllergenImage] = useState<string | null>(null);
  const [allergenScanLoading, setAllergenScanLoading] = useState(false);
  const [allergenScanReview, setAllergenScanReview] = useState<
    (ScannedAllergen & { tempId: string; include: boolean })[] | null
  >(null);

  useEffect(() => {
    fetchAllergens().then(setAllergens);
  }, []);

  // Elenco Portate: caricato da Supabase (tabella settings, chiave "portate_list")
  const [courses, setCourses] = useState<string[]>([]);
  const [newCourseName, setNewCourseName] = useState("");

  useEffect(() => {
    fetchCourses().then(setCourses);
  }, []);

  const [draft, setDraft] = useState<MenuDish>({
    id: "",
    name: "",
    description: "",
    price: "",
    destination: "Cucina",
    isComposable: false,
    ingredients: [],
    categoryRules: {},
  });
  const [editingId, setEditingId] = useState<string | null>(null);

  // Stati per l'aggiunta manuale ingrediente componibile
  const [ingName, setIngName] = useState("");
  const [ingCategory, setIngCategory] = useState<string>("Proteina");
  const [ingPrice, setIngPrice] = useState("0.00");

  // Stati per lo scanner foto ingredienti componibili + revisione risultati
  const [showIngredientScanner, setShowIngredientScanner] = useState(false);
  const [ingredientImage, setIngredientImage] = useState<string | null>(null);
  const [ingredientScanLoading, setIngredientScanLoading] = useState(false);
  const [ingredientScanReview, setIngredientScanReview] = useState<
    (ScannedIngredient & { tempId: string; include: boolean })[] | null
  >(null);

  // Stati per la scansione foto menu + revisione risultati
  const [showScannerModal, setShowScannerModal] = useState(false);
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [scanReview, setScanReview] = useState<(ScannedDish & { tempId: string; include: boolean })[] | null>(
    null,
  );

  // Categorie ingredienti presenti nel piatto in modifica (dinamiche, non fisse)
  const draftCategories = useMemo(() => {
    const cats = new Set<string>();
    (draft.ingredients || []).forEach((i) => cats.add(i.category));
    return Array.from(cats);
  }, [draft.ingredients]);

  const getCategoryRule = (category: string): CategoryRule =>
    draft.categoryRules?.[category] ?? CATEGORY_SUGGESTIONS[category] ?? DEFAULT_CATEGORY_RULE;

  const updateCategoryRule = (category: string, patch: Partial<CategoryRule>) => {
    setDraft((prev) => {
      const current = prev.categoryRules?.[category] ?? CATEGORY_SUGGESTIONS[category] ?? DEFAULT_CATEGORY_RULE;
      const nextRule = { ...current, ...patch };
      // il minimo non può superare il massimo, garantisce coerenza mentre l'utente digita
      if (nextRule.min > nextRule.max) nextRule.max = nextRule.min;
      return { ...prev, categoryRules: { ...prev.categoryRules, [category]: nextRule } };
    });
  };

  // Estrazione categorie uniche dinamiche (filtrando descrizioni lunghe/ingredienti)
  const categories = useMemo(() => {
    const cats = new Set<string>();
    dishes.forEach((d) => {
      if (d.description && d.description.trim() !== "") {
        const desc = d.description.trim();
        // Considera come categoria solo stringhe brevi e senza virgole (evita elenchi di ingredienti)
        if (desc.length < 20 && !desc.includes(",")) {
          cats.add(desc);
        }
      }
    });
    return ["Tutti", ...Array.from(cats)];
  }, [dishes]);

  // Filtraggio piatti per ricerca e categoria
  const filteredDishes = useMemo(() => {
    return dishes.filter((dish) => {
      const matchesSearch =
        dish.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (dish.description && dish.description.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesCategory =
        selectedCategoryFilter === "Tutti" ||
        (dish.description && dish.description.trim().toLowerCase() === selectedCategoryFilter.toLowerCase());
      return matchesSearch && matchesCategory;
    });
  }, [dishes, searchQuery, selectedCategoryFilter]);

  const resetDraft = () => {
    setDraft({
      id: "",
      name: "",
      description: "",
      price: "",
      destination: "Cucina",
      isComposable: false,
      ingredients: [],
      categoryRules: {},
    });
    setEditingId(null);
  };

  const handleSaveDish = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.name.trim()) return;

    if (editingId) {
      const updated = { ...draft, id: editingId };
      setDishes(dishes.map((d) => (d.id === editingId ? updated : d)));
      saveDishToSupabase(updated);
    } else {
      const newDish = { ...draft, id: Date.now().toString() };
      setDishes([...dishes, newDish]);
      saveDishToSupabase(newDish);
    }
    resetDraft();
  };

  const handleEdit = (dish: MenuDish) => {
    setDraft(dish);
    setEditingId(dish.id);
  };

  const handleDelete = (id: string) => {
    setDishes(dishes.filter((d) => d.id !== id));
    deleteDishFromSupabase(id);
    if (editingId === id) resetDraft();
  };

  const addIngredient = () => {
    const name = ingName.trim();
    const category = ingCategory.trim();
    const price = Number(ingPrice.replace(",", "."));
    if (!name || !category || !Number.isFinite(price) || price < 0) return;
    const newIng: DishIngredient = {
      id: `ing-${Date.now()}`,
      name,
      category,
      price,
    };
    setDraft((prev) => {
      const hasRule = !!prev.categoryRules?.[category];
      const categoryRules = hasRule
        ? prev.categoryRules
        : { ...prev.categoryRules, [category]: CATEGORY_SUGGESTIONS[category] ?? DEFAULT_CATEGORY_RULE };
      return { ...prev, ingredients: [...(prev.ingredients || []), newIng], categoryRules };
    });
    setIngName("");
    setIngPrice("0.00");
  };

  const removeIngredient = (id: string) => {
    setDraft((prev) => ({ ...prev, ingredients: (prev.ingredients || []).filter((i) => i.id !== id) }));
  };

  const handleIngredientImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => setIngredientImage(reader.result as string);
    reader.readAsDataURL(file);

    setIngredientScanLoading(true);
    try {
      const scanned = await scanIngredientsImage(file);
      setIngredientScanReview(
        scanned.map((item, index) => ({ ...item, tempId: `scan-ing-${Date.now()}-${index}`, include: true })),
      );
    } catch (error) {
      console.error("Errore durante la scansione ingredienti:", error);
      alert("Impossibile leggere gli ingredienti dalla foto. Riprova o correggi manualmente qui sotto.");
      setIngredientScanReview([]);
    } finally {
      setIngredientScanLoading(false);
    }
  };

  const updateIngredientReviewRow = (tempId: string, patch: Partial<ScannedIngredient & { include: boolean }>) => {
    setIngredientScanReview((prev) => (prev ? prev.map((r) => (r.tempId === tempId ? { ...r, ...patch } : r)) : prev));
  };

  const removeIngredientReviewRow = (tempId: string) => {
    setIngredientScanReview((prev) => (prev ? prev.filter((r) => r.tempId !== tempId) : prev));
  };

  const confirmIngredientScan = () => {
    if (!ingredientScanReview) return;
    const toAdd = ingredientScanReview.filter((r) => r.include && r.name.trim());
    const prepared: DishIngredient[] = toAdd.map((item, index) => ({
      id: `ing-${Date.now()}-${index}`,
      name: item.name.trim(),
      category: item.category.trim() || "Altro",
      price: Number(item.price) || 0,
    }));
    setDraft((prev) => {
      const rules = { ...prev.categoryRules };
      prepared.forEach((ing) => {
        if (!rules[ing.category]) rules[ing.category] = CATEGORY_SUGGESTIONS[ing.category] ?? DEFAULT_CATEGORY_RULE;
      });
      return { ...prev, ingredients: [...(prev.ingredients || []), ...prepared], categoryRules: rules };
    });
    setShowIngredientScanner(false);
    setIngredientImage(null);
    setIngredientScanReview(null);
  };

  const cancelIngredientScan = () => {
    setShowIngredientScanner(false);
    setIngredientImage(null);
    setIngredientScanReview(null);
  };

  /* ---------------- Elenco Allergeni ---------------- */

  const addAllergen = () => {
    const name = allergenName.trim();
    if (!name) return;
    const newAllergen: Allergen = { id: `all-${Date.now()}`, name, code: allergenCode.trim() || undefined };
    const next = [...allergens, newAllergen];
    setAllergens(next);
    saveAllergens(next);
    setAllergenName("");
    setAllergenCode("");
  };

  const removeAllergen = (id: string) => {
    const next = allergens.filter((a) => a.id !== id);
    setAllergens(next);
    saveAllergens(next);
  };

  const handleAllergenImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => setAllergenImage(reader.result as string);
    reader.readAsDataURL(file);

    setAllergenScanLoading(true);
    try {
      const scanned = await scanAllergensImage(file);
      setAllergenScanReview(
        scanned.map((item, index) => ({ ...item, tempId: `scan-all-${Date.now()}-${index}`, include: true })),
      );
    } catch (error) {
      console.error("Errore durante la scansione allergeni:", error);
      alert("Impossibile leggere gli allergeni dalla foto. Riprova o correggi manualmente qui sotto.");
      setAllergenScanReview([]);
    } finally {
      setAllergenScanLoading(false);
    }
  };

  const updateAllergenReviewRow = (tempId: string, patch: Partial<ScannedAllergen & { include: boolean }>) => {
    setAllergenScanReview((prev) => (prev ? prev.map((r) => (r.tempId === tempId ? { ...r, ...patch } : r)) : prev));
  };

  const removeAllergenReviewRow = (tempId: string) => {
    setAllergenScanReview((prev) => (prev ? prev.filter((r) => r.tempId !== tempId) : prev));
  };

  const confirmAllergenScan = () => {
    if (!allergenScanReview) return;
    const toAdd = allergenScanReview.filter((r) => r.include && r.name.trim());
    const prepared: Allergen[] = toAdd.map((item, index) => ({
      id: `all-${Date.now()}-${index}`,
      name: item.name.trim(),
      code: item.code.trim() || undefined,
    }));
    const next = [...allergens, ...prepared];
    setAllergens(next);
    saveAllergens(next);
    setShowAllergenScanner(false);
    setAllergenImage(null);
    setAllergenScanReview(null);
  };

  const cancelAllergenScan = () => {
    setShowAllergenScanner(false);
    setAllergenImage(null);
    setAllergenScanReview(null);
  };

  /* ---------------- Elenco Portate ---------------- */

  const addCourse = () => {
    const name = newCourseName.trim();
    if (!name || courses.includes(name)) return;
    const next = [...courses, name];
    setCourses(next);
    saveCourses(next);
    setNewCourseName("");
  };

  const removeCourse = (name: string) => {
    const next = courses.filter((c) => c !== name);
    setCourses(next);
    saveCourses(next);
  };

  const moveCourse = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= courses.length) return;
    const next = [...courses];
    [next[index], next[target]] = [next[target], next[index]];
    setCourses(next);
    saveCourses(next);
  };

  // Gestione caricamento foto: la scansione ora apre una revisione editabile prima di salvare
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setImage(reader.result as string);
    };
    reader.readAsDataURL(file);

    setLoading(true);
    try {
      const scannedItems = await scanMenuImage(file);
      setScanReview(
        scannedItems.map((item, index) => ({ ...item, tempId: `scan-dish-${Date.now()}-${index}`, include: true })),
      );
    } catch (error) {
      console.error("Errore durante la scansione IA:", error);
      alert("Impossibile leggere i piatti dalla foto. Riprova o correggi manualmente qui sotto.");
      setScanReview([]);
    } finally {
      setLoading(false);
    }
  };

  const updateScanReviewRow = (tempId: string, patch: Partial<ScannedDish & { include: boolean }>) => {
    setScanReview((prev) => (prev ? prev.map((r) => (r.tempId === tempId ? { ...r, ...patch } : r)) : prev));
  };

  const removeScanReviewRow = (tempId: string) => {
    setScanReview((prev) => (prev ? prev.filter((r) => r.tempId !== tempId) : prev));
  };

  const confirmMenuScan = async () => {
    if (!scanReview) return;
    const toAdd = scanReview.filter((r) => r.include && r.name.trim());
    const preparedItems: MenuDish[] = toAdd.map((item, index) => ({
      id: (Date.now() + index).toString(),
      name: item.name.trim(),
      description: item.description || "",
      price: item.price || "0.00",
      destination: item.destination === "Bar" ? "Bar" : "Cucina",
    }));

    setDishes([...dishes, ...preparedItems]);
    await Promise.all(preparedItems.map((dish) => saveDishToSupabase(dish)));

    setShowScannerModal(false);
    setImage(null);
    setScanReview(null);
  };

  const cancelMenuScan = () => {
    setShowScannerModal(false);
    setImage(null);
    setScanReview(null);
  };

  return (
    <div className="flex min-h-screen w-full flex-col bg-[#030712] text-slate-100">
      <TopNav active="Menu" />
      <div className="p-4 lg:p-6 max-w-7xl w-full mx-auto space-y-6 flex-1">
        {/* Header Neon Avanzato */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-950/80 p-4 rounded-2xl border border-cyan-500/30 backdrop-blur-xl shadow-[0_0_25px_rgba(6,182,212,0.15)]">
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-cyan-500/50 text-slate-300 hover:text-white transition-all"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-xl font-black tracking-tight text-white flex items-center gap-2">
                <UtensilsCrossed className="w-6 h-6 text-cyan-400" /> Gestione Menu e Listino
              </h1>
              <p className="text-xs text-slate-400">Configurazione piatti, categorie e destinazioni comande</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowScannerModal(true)}
            className="neon-btn-cyan px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 uppercase tracking-wide text-xs shadow-lg"
          >
            <Camera className="w-4 h-4" /> Scansiona Menu da Foto
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Form inserimento/modifica manuale ottimizzato */}
          <div className="bg-slate-950/80 p-5 rounded-2xl border border-slate-800 shadow-xl h-fit space-y-4">
            <h2 className="font-extrabold text-sm text-white border-b pb-3 border-slate-800 flex items-center gap-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              {editingId ? "Modifica Piatto" : "Aggiungi Nuovo Piatto"}
            </h2>
            <form onSubmit={handleSaveDish} className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Nome Piatto</label>
                <input
                  type="text"
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  placeholder="es. Pizza Margherita"
                  className="w-full mt-1.5 p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white placeholder:text-slate-600 text-sm focus:outline-none focus:border-cyan-500 transition-colors"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Categoria / Descrizione
                </label>
                <input
                  type="text"
                  value={draft.description}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  placeholder="es. Primi, Pizze, Bevande"
                  className="w-full mt-1.5 p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white placeholder:text-slate-600 text-sm focus:outline-none focus:border-cyan-500 transition-colors"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Prezzo (€)</label>
                <input
                  type="text"
                  value={draft.price}
                  onChange={(e) => setDraft({ ...draft, price: e.target.value })}
                  placeholder="0.00"
                  className="w-full mt-1.5 p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white placeholder:text-slate-600 text-sm font-mono focus:outline-none focus:border-cyan-500 transition-colors"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Destinazione Comanda</label>
                <select
                  value={draft.destination}
                  onChange={(e) =>
                    setDraft({ ...draft, destination: e.target.value as MenuDestination })
                  }
                  className="w-full mt-1.5 p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white text-sm focus:outline-none focus:border-cyan-500 transition-colors"
                >
                  <option value="Cucina">Cucina</option>
                  <option value="Bar">Bar</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Portata (sequenza cucina)
                </label>
                <select
                  value={draft.course || ""}
                  onChange={(e) => setDraft({ ...draft, course: e.target.value || undefined })}
                  className="w-full mt-1.5 p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white text-sm focus:outline-none focus:border-cyan-500 transition-colors"
                >
                  <option value="">Nessuna</option>
                  {courses.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <label className="flex items-center gap-2 cursor-pointer rounded-xl border border-emerald-500/25 bg-emerald-950/10 p-3">
                <input
                  type="checkbox"
                  checked={!!draft.isQuickItem}
                  onChange={(e) => setDraft({ ...draft, isQuickItem: e.target.checked })}
                  className="h-4 w-4 accent-emerald-500"
                />
                <span className="text-xs font-bold text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5" /> Quick Item (alta rotazione)
                </span>
              </label>

              <div className="rounded-xl border border-fuchsia-500/25 bg-fuchsia-950/10 p-3 space-y-2.5">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!draft.isComposable}
                    onChange={(e) => setDraft({ ...draft, isComposable: e.target.checked })}
                    className="h-4 w-4 accent-fuchsia-500"
                  />
                  <span className="text-xs font-bold text-fuchsia-300 uppercase tracking-wider">
                    Piatto componibile (es. poke)
                  </span>
                </label>

                {draft.isComposable && (
                  <div className="space-y-2.5 pt-1">
                    <p className="text-[10px] text-slate-400 leading-relaxed">
                      Aggiungi gli ingredienti per categoria e imposta quante scelte sono richieste per
                      ciascuna (es. 1 Proteina, 2 Side). Le categorie sono libere: scrivi il nome che vuoi.
                    </p>

                    <button
                      type="button"
                      onClick={() => setShowIngredientScanner(true)}
                      className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-fuchsia-500/40 bg-fuchsia-500/10 py-2 text-[11px] font-bold text-fuchsia-300 hover:bg-fuchsia-500/20 transition-all"
                    >
                      <Camera className="w-3.5 h-3.5" /> Scansiona ingredienti da foto
                    </button>

                    {draftCategories.length > 0 && (
                      <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                        {draftCategories.map((cat) => {
                          const items = (draft.ingredients || []).filter((i) => i.category === cat);
                          const rule = getCategoryRule(cat);
                          return (
                            <div key={cat} className="rounded-lg border border-slate-800 bg-slate-950/60 p-2">
                              <div className="flex items-center justify-between gap-2 mb-1.5">
                                <span className="text-[10px] font-black uppercase text-slate-300">{cat}</span>
                                <div className="flex items-center gap-1 text-[10px] text-slate-500">
                                  <span>min</span>
                                  <input
                                    type="number"
                                    min={0}
                                    max={9}
                                    value={rule.min}
                                    onChange={(e) => updateCategoryRule(cat, { min: Math.max(0, Number(e.target.value) || 0) })}
                                    className="w-10 rounded-md bg-slate-900 border border-slate-700 px-1 py-0.5 text-center text-white font-mono"
                                  />
                                  <span>max</span>
                                  <input
                                    type="number"
                                    min={1}
                                    max={9}
                                    value={rule.max}
                                    onChange={(e) => updateCategoryRule(cat, { max: Math.max(1, Number(e.target.value) || 1) })}
                                    className="w-10 rounded-md bg-slate-900 border border-slate-700 px-1 py-0.5 text-center text-white font-mono"
                                  />
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {items.map((ing) => (
                                  <span
                                    key={ing.id}
                                    className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 border border-slate-800 px-2 py-1 text-[10px] text-slate-200"
                                  >
                                    {ing.name} {ing.price > 0 ? `(+€${ing.price.toFixed(2)})` : ""}
                                    <button
                                      type="button"
                                      onClick={() => removeIngredient(ing.id)}
                                      className="text-slate-500 hover:text-rose-400"
                                    >
                                      ×
                                    </button>
                                  </span>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <div className="flex gap-1.5">
                      <input
                        value={ingName}
                        onChange={(e) => setIngName(e.target.value)}
                        placeholder="Ingrediente"
                        className="flex-1 min-w-0 rounded-lg bg-slate-900 border border-slate-800 px-2 py-1.5 text-[11px] text-white placeholder:text-slate-600 focus:outline-none focus:border-fuchsia-500"
                      />
                      <input
                        list="category-suggestions"
                        value={ingCategory}
                        onChange={(e) => setIngCategory(e.target.value)}
                        placeholder="Categoria"
                        className="w-28 rounded-lg bg-slate-900 border border-slate-800 px-2 py-1.5 text-[11px] text-white placeholder:text-slate-600 focus:outline-none focus:border-fuchsia-500"
                      />
                      <datalist id="category-suggestions">
                        {Object.keys(CATEGORY_SUGGESTIONS).map((c) => (
                          <option key={c} value={c} />
                        ))}
                        {draftCategories.map((c) => (
                          <option key={c} value={c} />
                        ))}
                      </datalist>
                      <input
                        value={ingPrice}
                        onChange={(e) => setIngPrice(e.target.value)}
                        placeholder="+€"
                        className="w-14 rounded-lg bg-slate-900 border border-slate-800 px-2 py-1.5 text-[11px] text-white font-mono focus:outline-none focus:border-fuchsia-500"
                      />
                      <button
                        type="button"
                        onClick={addIngredient}
                        className="rounded-lg bg-fuchsia-500 hover:bg-fuchsia-400 px-2.5 text-slate-950 font-black text-xs transition-all"
                      >
                        +
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 neon-btn-cyan py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 text-xs uppercase tracking-wider shadow"
                >
                  <Save className="w-4 h-4" /> {editingId ? "Aggiorna Piatto" : "Salva Piatto"}
                </button>
                {editingId && (
                  <button
                    type="button"
                    onClick={resetDraft}
                    className="px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white text-xs font-bold transition-colors"
                  >
                    Annulla
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Sezione elenco piatti con ricerca e filtri categorie */}
          <div className="lg:col-span-2 bg-slate-950/80 p-5 rounded-2xl border border-slate-800 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b pb-4 border-slate-800">
              <div>
                <h2 className="font-extrabold text-base text-white">
                  Piatti in Menu ({filteredDishes.length} di {dishes.length})
                </h2>
                <span className="text-xs text-slate-400">
                  Elenco completo dei piatti e bevande disponibili
                </span>
              </div>

              {/* Barra di Ricerca Veloce */}
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cerca piatto o categoria..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            {/* Filtri per Categoria Dinamici */}
            {categories.length > 1 && (
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
                <Filter className="w-3.5 h-3.5 text-cyan-400 shrink-0 mr-1" />
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategoryFilter(cat)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                      selectedCategoryFilter === cat
                        ? "bg-cyan-500 text-slate-950 shadow-[0_0_10px_rgba(6,182,212,0.4)] font-black"
                        : "bg-slate-900 text-slate-400 border border-slate-800 hover:text-white"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}

            {/* Elenco Piatti */}
            <div className="space-y-2.5 max-h-[480px] overflow-y-auto pr-1">
              {filteredDishes.length === 0 ? (
                <div className="text-center py-12 space-y-2 border border-dashed border-slate-800 rounded-2xl">
                  <UtensilsCrossed className="w-8 h-8 text-slate-600 mx-auto" />
                  <p className="text-sm font-bold text-slate-400">Nessun piatto trovato</p>
                  <p className="text-xs text-slate-600">Prova a modificare i filtri di ricerca o ad aggiungere un nuovo piatto.</p>
                </div>
              ) : (
                filteredDishes.map((dish) => (
                  <div
                    key={dish.id}
                    className="flex items-center justify-between p-3.5 border rounded-xl border-cyan-500/20 bg-slate-900/60 hover:border-cyan-400 hover:bg-slate-900 hover:shadow-[0_0_12px_rgba(0,255,255,0.15)] transition-all"
                  >
                    <div>
                      <h3 className="font-extrabold text-sm text-white flex items-center gap-2 flex-wrap">
                        {dish.name}
                        {dish.isComposable && (
                          <span className="rounded-md bg-fuchsia-500/15 border border-fuchsia-500/40 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-fuchsia-300">
                            Componibile
                          </span>
                        )}
                        {dish.isQuickItem && (
                          <span className="rounded-md bg-emerald-500/15 border border-emerald-500/40 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-300 flex items-center gap-0.5">
                            <Zap className="w-2.5 h-2.5" /> Quick
                          </span>
                        )}
                        {dish.course && (
                          <span className="rounded-md bg-cyan-500/15 border border-cyan-500/40 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-cyan-300">
                            {dish.course}
                          </span>
                        )}
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        <span className="text-slate-300 font-semibold">{dish.description || "Generale"}</span> •{" "}
                        <span className={`font-bold ${dish.destination === "Bar" ? "text-emerald-400" : "text-cyan-400"}`}>
                          {dish.destination}
                        </span>
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-black text-sm text-white font-mono bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 whitespace-nowrap">
                        € {Number(dish.price || 0).toFixed(2)}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleEdit(dish)}
                          className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-cyan-300 transition-colors"
                          title="Modifica"
                        >
                          <PencilLine className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(dish.id)}
                          className="p-2 hover:bg-red-950/50 rounded-lg text-red-400 transition-colors"
                          title="Elimina"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Sezione Elenco Allergeni */}
        <div className="bg-slate-950/80 p-5 rounded-2xl border border-amber-500/30 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b pb-4 border-slate-800">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div>
                <h2 className="font-extrabold text-base text-white">Elenco Allergeni ({allergens.length})</h2>
                <span className="text-xs text-slate-400">
                  Legenda allergeni del locale (Reg. UE 1169/2011), consultabile e stampabile a parte
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowAllergenScanner(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-amber-500/50 bg-amber-500/10 px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-amber-300 hover:bg-amber-500/20 transition-all shrink-0"
            >
              <Camera className="w-4 h-4" /> Scansiona Allergeni da Foto
            </button>
          </div>

          {/* Aggiunta manuale */}
          <div className="flex gap-2">
            <input
              value={allergenName}
              onChange={(e) => setAllergenName(e.target.value)}
              placeholder="Nome allergene (es. Glutine)"
              className="flex-1 min-w-0 rounded-xl bg-slate-900 border border-slate-800 px-3 py-2.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500"
            />
            <input
              value={allergenCode}
              onChange={(e) => setAllergenCode(e.target.value)}
              placeholder="N°"
              className="w-16 rounded-xl bg-slate-900 border border-slate-800 px-2 py-2.5 text-xs text-white placeholder:text-slate-600 font-mono text-center focus:outline-none focus:border-amber-500"
            />
            <button
              type="button"
              onClick={addAllergen}
              className="rounded-xl bg-amber-500 hover:bg-amber-400 px-4 text-slate-950 font-black text-xs uppercase tracking-wide transition-all"
            >
              Aggiungi
            </button>
          </div>

          {/* Elenco scorrevole */}
          <div className="max-h-72 overflow-y-auto pr-1 space-y-2">
            {allergens.length === 0 ? (
              <div className="text-center py-8 space-y-1.5 border border-dashed border-slate-800 rounded-2xl">
                <AlertTriangle className="w-6 h-6 text-slate-600 mx-auto" />
                <p className="text-xs font-bold text-slate-400">Nessun allergene registrato</p>
                <p className="text-[11px] text-slate-600">
                  Scansiona una foto della legenda allergeni o aggiungili manualmente qui sopra.
                </p>
              </div>
            ) : (
              allergens
                .slice()
                .sort((a, b) => (Number(a.code) || 999) - (Number(b.code) || 999) || a.name.localeCompare(b.name))
                .map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between gap-3 p-2.5 border rounded-xl border-amber-500/20 bg-slate-900/60"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {a.code && (
                        <span className="shrink-0 flex h-6 w-6 items-center justify-center rounded-lg bg-amber-500/15 border border-amber-500/40 text-[10px] font-black text-amber-300 font-mono">
                          {a.code}
                        </span>
                      )}
                      <span className="text-sm font-bold text-white truncate">{a.name}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeAllergen(a.id)}
                      className="p-1.5 hover:bg-red-950/50 rounded-lg text-red-400 transition-colors shrink-0"
                      title="Rimuovi"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
            )}
          </div>
        </div>

        {/* Sezione Gestione Portate */}
        <div className="bg-slate-950/80 p-5 rounded-2xl border border-cyan-500/30 shadow-xl space-y-4">
          <div className="flex items-center gap-3 border-b pb-4 border-slate-800">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-extrabold text-base text-white">Portate ({courses.length})</h2>
              <span className="text-xs text-slate-400">
                Sequenza di uscita in cucina: l'ordine qui sotto è l'ordine con cui usciranno i piatti
              </span>
            </div>
          </div>

          <div className="flex gap-2">
            <input
              value={newCourseName}
              onChange={(e) => setNewCourseName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addCourse()}
              placeholder="Nome portata (es. Antipasti)"
              className="flex-1 min-w-0 rounded-xl bg-slate-900 border border-slate-800 px-3 py-2.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500"
            />
            <button
              type="button"
              onClick={addCourse}
              className="rounded-xl bg-cyan-500 hover:bg-cyan-400 px-4 text-slate-950 font-black text-xs uppercase tracking-wide transition-all"
            >
              Aggiungi
            </button>
          </div>

          <div className="max-h-64 overflow-y-auto pr-1 space-y-1.5">
            {courses.length === 0 ? (
              <div className="text-center py-8 space-y-1.5 border border-dashed border-slate-800 rounded-2xl">
                <Layers className="w-6 h-6 text-slate-600 mx-auto" />
                <p className="text-xs font-bold text-slate-400">Nessuna portata configurata</p>
              </div>
            ) : (
              courses.map((c, index) => (
                <div
                  key={c}
                  className="flex items-center justify-between gap-2 p-2.5 border rounded-xl border-cyan-500/20 bg-slate-900/60"
                >
                  <span className="text-sm font-bold text-white">{c}</span>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => moveCourse(index, -1)}
                      disabled={index === 0}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-300 hover:bg-slate-800 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                      title="Sposta su"
                    >
                      <ChevronUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveCourse(index, 1)}
                      disabled={index === courses.length - 1}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-300 hover:bg-slate-800 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                      title="Sposta giù"
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeCourse(c)}
                      className="p-1.5 rounded-lg text-red-400 hover:bg-red-950/50 transition-colors"
                      title="Rimuovi"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Modale Scanner Foto */}
        {showScannerModal && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 z-50">
            <div
              className={`bg-slate-950 p-6 rounded-2xl w-full space-y-4 shadow-2xl border border-cyan-500/40 ${
                scanReview ? "max-w-2xl max-h-[85vh] flex flex-col" : "max-w-lg"
              }`}
            >
              <div className="flex justify-between items-center border-b pb-3 border-slate-800 shrink-0">
                <h3 className="font-black text-base text-white flex items-center gap-2">
                  <Camera className="w-5 h-5 text-cyan-400" />
                  {scanReview ? "Controlla i piatti prima di salvare" : "Scansiona Menu da Foto"}
                </h3>
                <button
                  onClick={cancelMenuScan}
                  className="text-slate-400 hover:text-white font-bold text-xl"
                >
                  ×
                </button>
              </div>

              {!image ? (
                <label className="border-2 border-dashed border-slate-800 rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer hover:border-cyan-500/50 hover:bg-slate-900/50 transition-all">
                  <Upload className="w-10 h-10 text-cyan-400 mb-3 animate-bounce" />
                  <p className="text-sm font-bold text-white">Scatta o carica la foto del menu</p>
                  <p className="text-xs text-slate-400 mt-1">Compatibile con fotocamera e galleria</p>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </label>
              ) : loading ? (
                <div className="space-y-4 text-center">
                  <img
                    src={image}
                    alt="Menu preview"
                    className="w-full h-48 object-cover rounded-xl border border-slate-800"
                  />
                  <div className="flex flex-col items-center justify-center py-4 space-y-2">
                    <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
                    <p className="text-xs font-bold text-cyan-400">
                      Estrazione automatica dei piatti in corso tramite IA...
                    </p>
                  </div>
                </div>
              ) : scanReview ? (
                <>
                  <p className="text-xs text-slate-400 shrink-0">
                    {scanReview.length === 0
                      ? "L'IA non ha letto nessun piatto dalla foto. Puoi chiudere e riprovare con una foto più nitida, oppure aggiungerli manualmente dal form."
                      : "Correggi eventuali errori di lettura, deseleziona ciò che non vuoi importare, poi conferma."}
                  </p>
                  <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                    {scanReview.map((row) => (
                      <div
                        key={row.tempId}
                        className={`rounded-xl border p-2.5 space-y-1.5 transition-all ${
                          row.include ? "border-cyan-500/30 bg-slate-900/60" : "border-slate-800 bg-slate-900/20 opacity-50"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={row.include}
                            onChange={(e) => updateScanReviewRow(row.tempId, { include: e.target.checked })}
                            className="h-4 w-4 accent-cyan-500 shrink-0"
                          />
                          <input
                            value={row.name}
                            onChange={(e) => updateScanReviewRow(row.tempId, { name: e.target.value })}
                            placeholder="Nome piatto"
                            className="flex-1 min-w-0 rounded-lg bg-slate-950 border border-slate-800 px-2 py-1.5 text-xs font-bold text-white focus:outline-none focus:border-cyan-500"
                          />
                          <button
                            type="button"
                            onClick={() => removeScanReviewRow(row.tempId)}
                            className="text-slate-500 hover:text-rose-400 shrink-0"
                            title="Rimuovi riga"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="flex gap-1.5 pl-6">
                          <input
                            value={row.description}
                            onChange={(e) => updateScanReviewRow(row.tempId, { description: e.target.value })}
                            placeholder="Categoria / descrizione"
                            className="flex-1 min-w-0 rounded-lg bg-slate-950 border border-slate-800 px-2 py-1.5 text-[11px] text-slate-300 focus:outline-none focus:border-cyan-500"
                          />
                          <input
                            value={row.price}
                            onChange={(e) => updateScanReviewRow(row.tempId, { price: e.target.value })}
                            placeholder="Prezzo"
                            className="w-20 rounded-lg bg-slate-950 border border-slate-800 px-2 py-1.5 text-[11px] font-mono text-white focus:outline-none focus:border-cyan-500"
                          />
                          <select
                            value={row.destination}
                            onChange={(e) => updateScanReviewRow(row.tempId, { destination: e.target.value as "Cucina" | "Bar" })}
                            className="rounded-lg bg-slate-950 border border-slate-800 px-2 py-1.5 text-[11px] text-white focus:outline-none focus:border-cyan-500"
                          >
                            <option value="Cucina">Cucina</option>
                            <option value="Bar">Bar</option>
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2 pt-2 border-t border-slate-800 shrink-0">
                    <button
                      type="button"
                      onClick={cancelMenuScan}
                      className="px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white text-xs font-bold transition-colors"
                    >
                      Annulla
                    </button>
                    <button
                      type="button"
                      onClick={confirmMenuScan}
                      disabled={scanReview.filter((r) => r.include).length === 0}
                      className="flex-1 neon-btn-cyan py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 text-xs uppercase tracking-wider shadow disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <Save className="w-4 h-4" />
                      Salva {scanReview.filter((r) => r.include).length} piatt{scanReview.filter((r) => r.include).length === 1 ? "o" : "i"}
                    </button>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        )}

        {/* Modale Scanner Foto Ingredienti Componibili (poke, bowl...) */}
        {showIngredientScanner && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 z-50">
            <div
              className={`bg-slate-950 p-6 rounded-2xl w-full space-y-4 shadow-2xl border border-fuchsia-500/40 ${
                ingredientScanReview ? "max-w-2xl max-h-[85vh] flex flex-col" : "max-w-lg"
              }`}
            >
              <div className="flex justify-between items-center border-b pb-3 border-slate-800 shrink-0">
                <h3 className="font-black text-base text-white flex items-center gap-2">
                  <Camera className="w-5 h-5 text-fuchsia-400" />
                  {ingredientScanReview ? "Controlla gli ingredienti prima di salvare" : "Scansiona Ingredienti da Foto"}
                </h3>
                <button
                  onClick={cancelIngredientScan}
                  className="text-slate-400 hover:text-white font-bold text-xl"
                >
                  ×
                </button>
              </div>

              {!ingredientScanReview && (
                <p className="text-xs text-slate-400 shrink-0">
                  Foto del listino ingredienti: verranno letti titolo, categoria e prezzo. Potrai
                  correggerli prima di aggiungerli al piatto.
                </p>
              )}

              {!ingredientImage ? (
                <label className="border-2 border-dashed border-slate-800 rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer hover:border-fuchsia-500/50 hover:bg-slate-900/50 transition-all">
                  <Upload className="w-10 h-10 text-fuchsia-400 mb-3 animate-bounce" />
                  <p className="text-sm font-bold text-white">Scatta o carica la foto degli ingredienti</p>
                  <p className="text-xs text-slate-400 mt-1">Compatibile con fotocamera e galleria</p>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleIngredientImageUpload}
                    className="hidden"
                  />
                </label>
              ) : ingredientScanLoading ? (
                <div className="space-y-4 text-center">
                  <img
                    src={ingredientImage}
                    alt="Ingredienti preview"
                    className="w-full h-48 object-cover rounded-xl border border-slate-800"
                  />
                  <div className="flex flex-col items-center justify-center py-4 space-y-2">
                    <Loader2 className="w-6 h-6 animate-spin text-fuchsia-400" />
                    <p className="text-xs font-bold text-fuchsia-400">
                      Estrazione ingredienti in corso tramite IA...
                    </p>
                  </div>
                </div>
              ) : ingredientScanReview ? (
                <>
                  <p className="text-xs text-slate-400 shrink-0">
                    {ingredientScanReview.length === 0
                      ? "L'IA non ha letto nessun ingrediente dalla foto. Puoi chiudere e riprovare, oppure aggiungerli manualmente dal form."
                      : "Correggi eventuali errori di lettura, deseleziona ciò che non vuoi importare, poi conferma."}
                  </p>
                  <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                    {ingredientScanReview.map((row) => (
                      <div
                        key={row.tempId}
                        className={`rounded-xl border p-2.5 flex items-center gap-1.5 transition-all ${
                          row.include ? "border-fuchsia-500/30 bg-slate-900/60" : "border-slate-800 bg-slate-900/20 opacity-50"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={row.include}
                          onChange={(e) => updateIngredientReviewRow(row.tempId, { include: e.target.checked })}
                          className="h-4 w-4 accent-fuchsia-500 shrink-0"
                        />
                        <input
                          value={row.name}
                          onChange={(e) => updateIngredientReviewRow(row.tempId, { name: e.target.value })}
                          placeholder="Nome"
                          className="flex-1 min-w-0 rounded-lg bg-slate-950 border border-slate-800 px-2 py-1.5 text-xs font-bold text-white focus:outline-none focus:border-fuchsia-500"
                        />
                        <input
                          list="category-suggestions"
                          value={row.category}
                          onChange={(e) => updateIngredientReviewRow(row.tempId, { category: e.target.value })}
                          placeholder="Categoria"
                          className="w-24 rounded-lg bg-slate-950 border border-slate-800 px-2 py-1.5 text-[11px] text-slate-300 focus:outline-none focus:border-fuchsia-500"
                        />
                        <input
                          value={row.price}
                          onChange={(e) => updateIngredientReviewRow(row.tempId, { price: e.target.value })}
                          placeholder="+€"
                          className="w-16 rounded-lg bg-slate-950 border border-slate-800 px-2 py-1.5 text-[11px] font-mono text-white focus:outline-none focus:border-fuchsia-500"
                        />
                        <button
                          type="button"
                          onClick={() => removeIngredientReviewRow(row.tempId)}
                          className="text-slate-500 hover:text-rose-400 shrink-0"
                          title="Rimuovi riga"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2 pt-2 border-t border-slate-800 shrink-0">
                    <button
                      type="button"
                      onClick={cancelIngredientScan}
                      className="px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white text-xs font-bold transition-colors"
                    >
                      Annulla
                    </button>
                    <button
                      type="button"
                      onClick={confirmIngredientScan}
                      disabled={ingredientScanReview.filter((r) => r.include).length === 0}
                      className="flex-1 rounded-xl bg-fuchsia-500 hover:bg-fuchsia-400 disabled:opacity-30 disabled:cursor-not-allowed py-2.5 text-xs font-black text-slate-950 uppercase tracking-wide transition-all flex items-center justify-center gap-2"
                    >
                      <Save className="w-4 h-4" />
                      Aggiungi {ingredientScanReview.filter((r) => r.include).length} ingredient{ingredientScanReview.filter((r) => r.include).length === 1 ? "e" : "i"}
                    </button>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        )}

        {/* Modale Scanner Foto Elenco Allergeni */}
        {showAllergenScanner && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 z-50">
            <div
              className={`bg-slate-950 p-6 rounded-2xl w-full space-y-4 shadow-2xl border border-amber-500/40 ${
                allergenScanReview ? "max-w-xl max-h-[85vh] flex flex-col" : "max-w-lg"
              }`}
            >
              <div className="flex justify-between items-center border-b pb-3 border-slate-800 shrink-0">
                <h3 className="font-black text-base text-white flex items-center gap-2">
                  <Camera className="w-5 h-5 text-amber-400" />
                  {allergenScanReview ? "Controlla gli allergeni prima di salvare" : "Scansiona Allergeni da Foto"}
                </h3>
                <button
                  onClick={cancelAllergenScan}
                  className="text-slate-400 hover:text-white font-bold text-xl"
                >
                  ×
                </button>
              </div>

              {!allergenScanReview && (
                <p className="text-xs text-slate-400 shrink-0">
                  Foto della legenda allergeni del locale: verranno letti nome e numero/codice ufficiale
                  se presente. Potrai correggerli prima di aggiungerli all'elenco.
                </p>
              )}

              {!allergenImage ? (
                <label className="border-2 border-dashed border-slate-800 rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer hover:border-amber-500/50 hover:bg-slate-900/50 transition-all">
                  <Upload className="w-10 h-10 text-amber-400 mb-3 animate-bounce" />
                  <p className="text-sm font-bold text-white">Scatta o carica la foto della legenda allergeni</p>
                  <p className="text-xs text-slate-400 mt-1">Compatibile con fotocamera e galleria</p>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAllergenImageUpload}
                    className="hidden"
                  />
                </label>
              ) : allergenScanLoading ? (
                <div className="space-y-4 text-center">
                  <img
                    src={allergenImage}
                    alt="Allergeni preview"
                    className="w-full h-48 object-cover rounded-xl border border-slate-800"
                  />
                  <div className="flex flex-col items-center justify-center py-4 space-y-2">
                    <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
                    <p className="text-xs font-bold text-amber-400">
                      Estrazione allergeni in corso tramite IA...
                    </p>
                  </div>
                </div>
              ) : allergenScanReview ? (
                <>
                  <p className="text-xs text-slate-400 shrink-0">
                    {allergenScanReview.length === 0
                      ? "L'IA non ha letto nessun allergene dalla foto. Puoi chiudere e riprovare, oppure aggiungerli manualmente qui sopra."
                      : "Correggi eventuali errori di lettura, deseleziona ciò che non vuoi importare, poi conferma."}
                  </p>
                  <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                    {allergenScanReview.map((row) => (
                      <div
                        key={row.tempId}
                        className={`rounded-xl border p-2.5 flex items-center gap-1.5 transition-all ${
                          row.include ? "border-amber-500/30 bg-slate-900/60" : "border-slate-800 bg-slate-900/20 opacity-50"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={row.include}
                          onChange={(e) => updateAllergenReviewRow(row.tempId, { include: e.target.checked })}
                          className="h-4 w-4 accent-amber-500 shrink-0"
                        />
                        <input
                          value={row.code}
                          onChange={(e) => updateAllergenReviewRow(row.tempId, { code: e.target.value })}
                          placeholder="N°"
                          className="w-12 rounded-lg bg-slate-950 border border-slate-800 px-2 py-1.5 text-[11px] font-mono text-white text-center focus:outline-none focus:border-amber-500"
                        />
                        <input
                          value={row.name}
                          onChange={(e) => updateAllergenReviewRow(row.tempId, { name: e.target.value })}
                          placeholder="Nome allergene"
                          className="flex-1 min-w-0 rounded-lg bg-slate-950 border border-slate-800 px-2 py-1.5 text-xs font-bold text-white focus:outline-none focus:border-amber-500"
                        />
                        <button
                          type="button"
                          onClick={() => removeAllergenReviewRow(row.tempId)}
                          className="text-slate-500 hover:text-rose-400 shrink-0"
                          title="Rimuovi riga"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2 pt-2 border-t border-slate-800 shrink-0">
                    <button
                      type="button"
                      onClick={cancelAllergenScan}
                      className="px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white text-xs font-bold transition-colors"
                    >
                      Annulla
                    </button>
                    <button
                      type="button"
                      onClick={confirmAllergenScan}
                      disabled={allergenScanReview.filter((r) => r.include).length === 0}
                      className="flex-1 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-30 disabled:cursor-not-allowed py-2.5 text-xs font-black text-slate-950 uppercase tracking-wide transition-all flex items-center justify-center gap-2"
                    >
                      <Save className="w-4 h-4" />
                      Aggiungi {allergenScanReview.filter((r) => r.include).length} allergen{allergenScanReview.filter((r) => r.include).length === 1 ? "e" : "i"}
                    </button>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
