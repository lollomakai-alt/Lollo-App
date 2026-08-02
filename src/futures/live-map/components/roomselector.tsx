import React, { useState } from "react";
import { Plus, Check, X, Pencil, Trash2 } from "lucide-react";
import type { PosRoom } from "@/lib/rooms-store";

interface RoomSelectorProps {
  rooms: PosRoom[];
  activeRoomId: string;
  onRoomChange: (id: string) => void;
  onAddRoom: (name: string) => void;
  onRenameRoom?: (id: string, name: string) => void;
  onDeleteRoom?: (id: string) => void;
}

/** Barra sale: selettori + "+" per aggiungere, matita/cestino per rinominare/cancellare la sala attiva. */
export const RoomSelector: React.FC<RoomSelectorProps> = ({
  rooms,
  activeRoomId,
  onRoomChange,
  onAddRoom,
  onRenameRoom,
  onDeleteRoom,
}) => {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const confirmAdd = () => {
    if (name.trim()) onAddRoom(name.trim());
    setName("");
    setAdding(false);
  };

  const startRename = (room: PosRoom) => {
    setRenamingId(room.id);
    setRenameValue(room.name);
  };

  const confirmRename = () => {
    if (renamingId && renameValue.trim() && onRenameRoom) {
      onRenameRoom(renamingId, renameValue.trim());
    }
    setRenamingId(null);
  };

  const handleDelete = (room: PosRoom) => {
    if (!onDeleteRoom) return;
    if (rooms.length <= 1) {
      window.alert("Deve restare almeno una sala.");
      return;
    }
    if (window.confirm(`Cancellare la sala "${room.name}"? I tavoli al suo interno non vengono eliminati, ma andranno riassegnati a un'altra sala.`)) {
      onDeleteRoom(room.id);
    }
  };

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto">
      {rooms.map((room) => {
        const isActive = String(room.id) === String(activeRoomId);
        const isRenaming = renamingId === room.id;

        if (isRenaming) {
          return (
            <div key={room.id} className="flex items-center gap-1" data-keep-open>
              <input
                autoFocus
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") confirmRename();
                  if (e.key === "Escape") setRenamingId(null);
                }}
                className="w-28 rounded-lg bg-slate-900 border border-emerald-500/40 px-2 py-1.5 text-[11px] text-white focus:outline-none"
              />
              <button onClick={confirmRename} className="p-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-emerald-400">
                <Check className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => setRenamingId(null)} className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        }

        return (
          <div key={room.id} className="flex items-center shrink-0">
            <button
              onClick={() => onRoomChange(room.id)}
              className={`px-3 py-1.5 whitespace-nowrap text-[11px] font-semibold transition-colors ${
                isActive
                  ? "bg-emerald-500 text-black rounded-l-lg"
                  : "bg-slate-900/70 border border-slate-800 text-slate-400 hover:text-white rounded-lg"
              }`}
              style={isActive ? { borderTopRightRadius: 0, borderBottomRightRadius: 0 } : undefined}
            >
              {room.name}
            </button>
            {isActive && (onRenameRoom || onDeleteRoom) && (
              <div className="flex items-center bg-emerald-500 rounded-r-lg pr-1 gap-0.5">
                {onRenameRoom && (
                  <button onClick={() => startRename(room)} className="p-1 text-black/70 hover:text-black" title="Rinomina sala">
                    <Pencil className="w-3 h-3" />
                  </button>
                )}
                {onDeleteRoom && (
                  <button onClick={() => handleDelete(room)} className="p-1 text-black/70 hover:text-rose-900" title="Cancella sala">
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}

      {adding ? (
        <div className="flex items-center gap-1" data-keep-open>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") confirmAdd();
              if (e.key === "Escape") setAdding(false);
            }}
            placeholder="Nuova sala"
            className="w-28 rounded-lg bg-slate-900 border border-emerald-500/40 px-2 py-1.5 text-[11px] text-white placeholder-slate-600 focus:outline-none"
          />
          <button
            onClick={confirmAdd}
            className="p-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-emerald-400"
          >
            <Check className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setAdding(false)}
            className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          title="Aggiungi sala"
          className="p-1.5 rounded-lg bg-slate-900/70 border border-slate-800 text-slate-400 hover:text-emerald-400 hover:border-emerald-500/40 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};
