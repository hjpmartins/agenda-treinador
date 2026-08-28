import { habilidadeGroups } from "../../data";
import { inputCls } from "../../ui";

function HabilidadeSelect({ value, onChange, className, placeholderOption }) {
  const groups = habilidadeGroups();
  return (
    <select value={value} onChange={onChange} className={className || inputCls}>
      {placeholderOption && <option value="">{placeholderOption}</option>}
      {groups.map((g) => (
        <optgroup key={g.label} label={g.label}>
          {g.items.map((h) => (
            <option key={h.id} value={h.id}>{h.nome}</option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

export { HabilidadeSelect };

