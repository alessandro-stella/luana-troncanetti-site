"use client";

type Option<T extends string> = { value: T; label: string };

type Props<T extends string> = {
  legend: string;
  name: string;
  value: T;
  options: Option<T>[];
  onChange: (value: T) => void;
};

export default function RadioRow<T extends string>({
  legend,
  name,
  value,
  options,
  onChange,
}: Props<T>) {
  return (
    <fieldset className="flex flex-wrap items-center gap-x-4 gap-y-1">
      <legend className="sr-only">{legend}</legend>
      <span aria-hidden className="text-xs text-gray-500">
        {legend}:
      </span>
      {options.map((o) => (
        <label key={o.value} className="flex items-center gap-1 text-sm">
          <input
            type="radio"
            name={name}
            value={o.value}
            checked={value === o.value}
            onChange={() => onChange(o.value)}
          />
          {o.label}
        </label>
      ))}
    </fieldset>
  );
}
