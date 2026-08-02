import { useEffect } from "react";
import { supabase } from "../lib/supabase";

export function useRealtime(tables: string[], onChange: () => void) {
  useEffect(() => {
    const channel = supabase.channel(`rt-${tables.join("-")}-${Math.random()}`);
    tables.forEach((t) => {
      channel.on(
        "postgres_changes" as any,
        { event: "*", schema: "public", table: t },
        () => onChange(),
      );
    });
    channel.subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tables.join("|")]);
}
