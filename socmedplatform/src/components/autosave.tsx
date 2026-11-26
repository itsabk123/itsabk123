"use client";
import { useEffect } from "react";

/** Saves a draft of a form to this browser so work isn't lost. Cleared on submit. Wrapped in try/catch for private modes. */
export function Autosave({ formId, storageKey }: { formId: string; storageKey: string }) {
  useEffect(() => {
    const form = document.getElementById(formId) as HTMLFormElement | null;
    if (!form) return;
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) ?? "null") as Record<string, string[]> | null;
      if (saved) {
        for (const [name, values] of Object.entries(saved)) {
          const els = form.querySelectorAll<HTMLInputElement>(`[name="${CSS.escape(name)}"]`);
          els.forEach((el) => {
            if (el.type === "checkbox" || el.type === "radio") el.checked = values.includes(el.value);
            else if (el.type !== "hidden" && el.type !== "file") el.value = values[0] ?? "";
          });
        }
      }
    } catch {}
    const save = () => {
      try {
        const data: Record<string, string[]> = {};
        new FormData(form).forEach((v, k) => {
          if (typeof v === "string") (data[k] ??= []).push(v);
        });
        localStorage.setItem(storageKey, JSON.stringify(data));
      } catch {}
    };
    const clear = () => {
      try { localStorage.removeItem(storageKey); } catch {}
    };
    form.addEventListener("input", save);
    form.addEventListener("submit", clear);
    return () => {
      form.removeEventListener("input", save);
      form.removeEventListener("submit", clear);
    };
  }, [formId, storageKey]);
  return <p className="text-xs text-muted">Draft auto-saved in this browser.</p>;
}
