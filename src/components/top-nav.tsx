import { Link } from "@tanstack/react-router";
import { Globe, LogOut } from "lucide-react";

const navItems: { label: string; to: string }[] = [
  { label: "Dashboard", to: "/dashboard" },
  { label: "Mappa Live", to: "/" },
  { label: "Storico", to: "/storico" },
  { label: "Menu", to: "/menu" },
  { label: "Impostazioni", to: "/settings" },
];

export function TopNav({
  active,
}: {
  active?: "Dashboard" | "Mappa Live" | "Storico" | "Menu" | "Impostazioni";
}) {
  return (
    <header className="relative z-20 flex h-14 sm:h-16 shrink-0 items-center border-b border-emerald-500/20 bg-slate-950/80 px-2 sm:px-6 backdrop-blur-xl select-none">
      <div className="hidden w-24 sm:block" />
      <nav className="flex flex-1 items-center gap-3 sm:justify-center sm:gap-6 overflow-x-auto scrollbar-none">
        {navItems.map((item) => {
          const isActive = item.label === active;
          return (
            <Link
              key={item.label}
              to={item.to}
              className={`relative shrink-0 whitespace-nowrap py-2 text-xs sm:text-sm font-bold transition-all duration-300 flex items-center justify-center ${
                isActive
                  ? "text-emerald-300 drop-shadow-[0_0_10px_rgba(16,185,129,0.5)]"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {item.label}
              {isActive && (
                <span
                  className="absolute -bottom-[15px] sm:-bottom-[17px] left-0 right-0 h-[3px] rounded-full bg-emerald-400"
                  style={{
                    boxShadow: "0 0 12px #10b981, 0 0 25px #10b981",
                  }}
                />
              )}
            </Link>
          );
        })}
      </nav>
      <div className="flex shrink-0 items-center gap-1.5 sm:gap-3 pl-2">
        <span className="hidden sm:inline-flex min-h-[40px] items-center gap-2 rounded-xl px-3 text-xs text-slate-400 bg-slate-900/60 border border-slate-800/80">
          <span className="relative inline-flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.9)]" />
          </span>
          <span className="font-bold text-slate-300">Online</span>
        </span>
        {/* Su telefono resta solo il puntino online, per non affollare la barra */}
        <span className="relative inline-flex h-2 w-2 shrink-0 sm:hidden">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.9)]" />
        </span>
        <button
          type="button"
          aria-label="Lingua"
          className="inline-flex min-h-[36px] min-w-[36px] sm:min-h-[40px] sm:min-w-[40px] items-center justify-center rounded-xl bg-slate-900/60 border border-slate-800/80 text-slate-400 hover:bg-slate-800 hover:text-slate-200 active:scale-95 transition-all"
        >
          <Globe className="h-4 w-4" />
          <span className="ml-1 text-xs font-bold hidden sm:inline">IT</span>
        </button>
        <button
          type="button"
          aria-label="Esci"
          className="inline-flex min-h-[36px] sm:min-h-[40px] items-center gap-2 rounded-xl border border-slate-800/80 bg-slate-900/60 px-2.5 sm:px-3.5 text-xs font-bold text-slate-300 hover:bg-rose-500/10 hover:text-rose-400 hover:border-rose-500/30 active:scale-95 transition-all"
        >
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline">Esci</span>
        </button>
      </div>
    </header>
  );
}
