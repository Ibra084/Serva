"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface CategoryRow {
  name: string;
  itemCount: number;
}

export function CategorySidebar({
  categories,
  selected,
  onSelect,
  onAdd,
  onRename,
  onDelete,
  onMove,
}: {
  categories: CategoryRow[];
  selected: string | null;
  onSelect: (name: string) => void;
  onAdd: (name: string) => void;
  onRename: (oldName: string, newName: string) => void;
  onDelete: (name: string) => void;
  onMove: (name: string, direction: -1 | 1) => void;
}) {
  const [newName, setNewName] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  function submitAdd() {
    if (!newName.trim()) return;
    onAdd(newName.trim());
    setNewName("");
  }

  function startEdit(name: string) {
    setEditing(name);
    setEditValue(name);
  }

  function submitEdit() {
    if (editing && editValue.trim() && editValue.trim() !== editing) {
      onRename(editing, editValue.trim());
    }
    setEditing(null);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-2xl border border-border bg-card p-4">
        <p className="mb-2 text-xs font-medium text-muted-foreground">Categories</p>
        <div className="flex items-center gap-2">
          <Input
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && submitAdd()}
            placeholder="New category name"
            className="h-8 text-xs"
          />
          <button
            onClick={submitAdd}
            className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-colors hover:bg-[var(--accent-hover)]"
            aria-label="Add category"
          >
            <Plus className="size-4" />
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-1 rounded-2xl border border-border bg-card p-2">
        {categories.length === 0 && (
          <p className="px-2 py-3 text-center text-xs text-muted-foreground">No categories yet.</p>
        )}
        {categories.map((category, index) => (
          <div
            key={category.name}
            className={cn(
              "group flex items-center gap-1 rounded-lg px-2 py-2 text-left transition-colors",
              selected === category.name ? "bg-accent text-accent-foreground" : "hover:bg-secondary"
            )}
          >
            {editing === category.name ? (
              <div className="flex flex-1 items-center gap-1">
                <Input
                  autoFocus
                  value={editValue}
                  onChange={(event) => setEditValue(event.target.value)}
                  onKeyDown={(event) => event.key === "Enter" && submitEdit()}
                  className="h-7 text-xs"
                />
                <button onClick={submitEdit} aria-label="Save category name" className="flex size-6 items-center justify-center rounded-full hover:bg-secondary">
                  <Check className="size-3.5" />
                </button>
                <button onClick={() => setEditing(null)} aria-label="Cancel rename" className="flex size-6 items-center justify-center rounded-full hover:bg-secondary">
                  <X className="size-3.5" />
                </button>
              </div>
            ) : (
              <>
                <button onClick={() => onSelect(category.name)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                  <span className="truncate text-sm font-medium">{category.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{category.itemCount}</span>
                </button>
                <span className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    onClick={() => onMove(category.name, -1)}
                    disabled={index === 0}
                    aria-label="Move category up"
                    className="flex size-6 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary disabled:pointer-events-none disabled:opacity-30"
                  >
                    <ArrowUp className="size-3.5" />
                  </button>
                  <button
                    onClick={() => onMove(category.name, 1)}
                    disabled={index === categories.length - 1}
                    aria-label="Move category down"
                    className="flex size-6 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary disabled:pointer-events-none disabled:opacity-30"
                  >
                    <ArrowDown className="size-3.5" />
                  </button>
                  <button
                    onClick={() => startEdit(category.name)}
                    aria-label="Rename category"
                    className="flex size-6 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary"
                  >
                    <Pencil className="size-3.5" />
                  </button>
                  <button
                    onClick={() => onDelete(category.name)}
                    aria-label="Delete category"
                    className="flex size-6 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </span>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
