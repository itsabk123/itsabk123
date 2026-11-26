"use client";
import type { ReactNode } from "react";

/**
 * Submit button that carries a value (e.g. approve / reject). Server actions don't receive the submitter's
 * name/value, so on click we mirror it into a hidden input. Without JS the native submitter value is sent instead.
 */
export function ChoiceButton({ name, value, className, children }: { name: string; value: string; className?: string; children: ReactNode }) {
  return (
    <button
      type="submit"
      name={name}
      value={value}
      className={className}
      onClick={(e) => {
        const form = e.currentTarget.form;
        if (!form) return;
        let input = form.querySelector<HTMLInputElement>(`input[type=hidden][data-choice="${name}"]`);
        if (!input) {
          input = document.createElement("input");
          input.type = "hidden";
          input.name = name;
          input.dataset.choice = name;
          form.appendChild(input);
        }
        input.value = value;
      }}
    >
      {children}
    </button>
  );
}
