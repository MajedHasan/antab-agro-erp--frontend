"use client";

export default function MultiSelect({
  options,
  selected,
  onChange,
}: {
  options: { label: string; value: string }[];
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  const toggle = (v: string) => {
    if (selected.includes(v)) onChange(selected.filter((s) => s !== v));
    else onChange([...selected, v]);
  };

  return (
    <div className="grid grid-cols-2 gap-2 max-h-48 overflow-auto p-2 border rounded">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => toggle(o.value)}
          className={`px-2 py-1 text-sm rounded text-left ${
            selected.includes(o.value)
              ? "bg-indigo-600 text-white"
              : "bg-gray-100 dark:bg-gray-700"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
