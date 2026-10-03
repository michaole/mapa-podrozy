import type { Member, Who } from "../lib/types";
import { memberName } from "../lib/people";

/** Razem / <each member>: who was on a trip or at a place. */
export default function WhoPicker({ value, onChange, members, name, legend = "Kto był" }: {
  value: Who;
  onChange: (who: Who) => void;
  members: Member[];
  name: string;
  legend?: string;
}) {
  const options: [Who, string][] = [["both", "Razem"], ...members.map((m) => [m.user_id, memberName(m)] as [Who, string])];
  return (
    <fieldset className="who">
      <legend className="who__legend">{legend}</legend>
      <div className="who__opts">
        {options.map(([id, label]) => (
          <label key={id} className="who__opt">
            <input type="radio" name={name} checked={value === id} onChange={() => onChange(id)} />
            {label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
