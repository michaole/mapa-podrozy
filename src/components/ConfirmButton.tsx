import { useEffect, useState } from "react";
import { Trash } from "@phosphor-icons/react";

/** Two-step delete: first click arms it, second confirms. Disarms after 4 s. */
export default function ConfirmButton({ onConfirm, label = "Usuń", confirmLabel = "Na pewno usunąć?", disabled }: {
  onConfirm: () => void;
  label?: string;
  confirmLabel?: string;
  disabled?: boolean;
}) {
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const t = window.setTimeout(() => setArmed(false), 4000);
    return () => window.clearTimeout(t);
  }, [armed]);

  return (
    <button
      type="button"
      className={`btn btn--quiet btn--danger${armed ? " is-armed" : ""}`}
      disabled={disabled}
      onClick={() => (armed ? (setArmed(false), onConfirm()) : setArmed(true))}
      onBlur={() => setArmed(false)}
    >
      <Trash size={16} weight={armed ? "fill" : "regular"} aria-hidden="true" />
      {armed ? confirmLabel : label}
    </button>
  );
}
