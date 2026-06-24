"use client";

import { Select, type SelectOption } from "@/components/ui/Select";

type Props<V extends string> = {
  label: string;
  value: V | undefined;
  options: SelectOption<V>[];
  onChange: (v: V | undefined) => void;
  allOptionLabel?: string; // "Toàn quốc", "Tất cả vùng"...
  disabled?: boolean;
  width?: number | string;
  searchable?: boolean;
  maxVisible?: number;
};

// Wraps Select with a synthetic "(all)" option that clears the filter.
export function DimensionSelect<V extends string>({
  label,
  value,
  options,
  onChange,
  allOptionLabel = "Tất cả",
  disabled,
  width = 180,
  searchable,
  maxVisible,
}: Props<V>) {
  const ALL = "__all__" as const;
  type Opt = SelectOption<V | typeof ALL>;
  const fullOptions: Opt[] = [
    { value: ALL as V | typeof ALL, label: allOptionLabel },
    ...options,
  ];

  return (
    <Select<V | typeof ALL>
      label={label}
      value={(value ?? ALL) as V | typeof ALL}
      options={fullOptions}
      onChange={(v) => onChange(v === ALL ? undefined : (v as V))}
      disabled={disabled}
      width={width}
      searchable={searchable}
      maxVisible={maxVisible}
      size="md"
    />
  );
}
