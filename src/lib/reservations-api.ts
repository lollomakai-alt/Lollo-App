import { supabase } from "@/lib/supabase";

export type ReservationStatus = "confirmed" | "seated" | "cancelled";

export interface Reservation {
  id: string;
  clientName: string;
  phone?: string;
  date: string;
  time: string;
  covers: number;
  notes?: string;
  tableId?: string;
  status: ReservationStatus;
}

function mapRow(row: Record<string, any>): Reservation {
  return {
    id: String(row.id),
    clientName: String(row.client_name ?? ""),
    phone: row.phone || "",
    date: String(row.date ?? new Date().toISOString().slice(0, 10)),
    time: String(row.time ?? ""),
    covers: Number(row.covers ?? 2),
    notes: row.notes ?? "",
    tableId: row.table_id ?? undefined,
    status: (row.status as ReservationStatus) ?? "confirmed",
  };
}

export async function fetchReservations(): Promise<Reservation[]> {
  const { data, error } = await supabase
    .from("reservations")
    .select("*")
    .order("date", { ascending: true })
    .order("time", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(mapRow);
}

export async function createReservation(input: {
  clientName: string;
  phone?: string;
  date: string;
  time: string;
  covers: number;
  notes?: string;
}): Promise<Reservation> {
  const { data, error } = await supabase
    .from("reservations")
    .insert([
      {
        client_name: input.clientName,
        phone: input.phone || null,
        date: input.date,
        time: input.time,
        covers: input.covers,
        notes: input.notes || null,
      },
    ])
    .select()
    .single();
  if (error) throw error;
  return mapRow(data as Record<string, any>);
}

/** Assegna la prenotazione a un tavolo: farà brillare il tavolo di ciano sulla mappa. */
export async function assignReservationToTable(id: string, tableLabel: string): Promise<void> {
  const { error } = await supabase
    .from("reservations")
    .update({ table_id: tableLabel, status: "seated" })
    .eq("id", id);
  if (error) throw error;
}

/** Toglie l'assegnazione al tavolo, la prenotazione torna "da assegnare". */
export async function unassignReservation(id: string): Promise<void> {
  const { error } = await supabase
    .from("reservations")
    .update({ table_id: null, status: "confirmed" })
    .eq("id", id);
  if (error) throw error;
}

/** Cliente arrivato: la prenotazione ha esaurito il suo scopo, si rimuove. */
export async function completeReservation(id: string): Promise<void> {
  const { error } = await supabase.from("reservations").delete().eq("id", id);
  if (error) throw error;
}

export async function cancelReservation(id: string): Promise<void> {
  const { error } = await supabase.from("reservations").update({ status: "cancelled" }).eq("id", id);
  if (error) throw error;
}

/** Elimina la prenotazione, ma archivia prima nome e telefono nello storico clienti permanente. */
export async function deleteReservation(id: string): Promise<void> {
  const { data: row } = await supabase.from("reservations").select("client_name, phone").eq("id", id).maybeSingle();
  if (row?.client_name) {
    await archiveCustomer(row.client_name, row.phone || undefined);
  }
  const { error } = await supabase.from("reservations").delete().eq("id", id);
  if (error) throw error;
}

/** Registra o aggiorna un cliente nello storico permanente (usato per suggerimenti nelle nuove prenotazioni). */
export async function archiveCustomer(clientName: string, phone?: string): Promise<void> {
  try {
    const { data: existing } = await supabase
      .from("customers_history")
      .select("id, visit_count")
      .ilike("client_name", clientName.trim())
      .maybeSingle();

    if (existing) {
      await supabase
        .from("customers_history")
        .update({
          phone: phone || undefined,
          visit_count: (existing.visit_count || 1) + 1,
          last_seen: new Date().toISOString(),
        })
        .eq("id", existing.id);
    } else {
      await supabase.from("customers_history").insert([
        { client_name: clientName.trim(), phone: phone || null, visit_count: 1, last_seen: new Date().toISOString() },
      ]);
    }
  } catch (err) {
    console.error("[Supabase] Errore archiviazione cliente:", err);
  }
}

export type CustomerSuggestion = { name: string; phone: string };

/** Suggerimenti per l'autocompletamento nome/telefono quando si crea una nuova prenotazione. */
export async function searchCustomerHistory(query: string): Promise<CustomerSuggestion[]> {
  if (!query.trim()) return [];
  try {
    const { data, error } = await supabase
      .from("customers_history")
      .select("client_name, phone")
      .ilike("client_name", `%${query.trim()}%`)
      .order("last_seen", { ascending: false })
      .limit(5);
    if (error) throw error;
    return (data || []).map((r: any) => ({ name: r.client_name, phone: r.phone || "" }));
  } catch (err) {
    console.error("[Supabase] Errore ricerca storico clienti:", err);
    return [];
  }
}
