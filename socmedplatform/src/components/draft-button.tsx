"use client";
import { useState, useTransition } from "react";
import { generateDraft } from "@/app/app/assistant/actions";

/** Fills a textarea with an editable draft. Nothing is saved until the user submits the form. */
export function DraftButton({ kind, profileId, target, extra }: { kind: string; profileId?: string; target: string; extra?: Record<string, string> }) {
  const [pending, start] = useTransition();
  const [note, setNote] = useState<string | null>(null);
  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        className="btn-secondary btn-sm"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await generateDraft(kind, profileId ?? "", extra ?? {});
            const el = document.getElementById(target) as HTMLTextAreaElement | null;
            if (res.error) return setNote(res.error);
            if (el) {
              if (el.value.trim() && !confirm("Replace the current text with a draft?")) return;
              el.value = res.text;
              el.focus();
            }
            setNote(res.source === "ai" ? "AI draft — review and edit before saving." : "Template draft — fill in the brackets before saving.");
          })
        }
      >
        {pending ? "Drafting…" : "Draft with assistant"}
      </button>
      {note && <span className="text-xs text-muted">{note}</span>}
    </span>
  );
}
