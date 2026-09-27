"use client";

/**
 * A naira input that reads like money while you type — 100000 shows as
 * "100,000".
 *
 * <input type="number"> cannot display separators, so this is a text input that
 * formats what the user sees and posts the raw digits in a hidden field under
 * the real `name`. Server actions therefore receive a plain integer and need no
 * special handling.
 *
 * Controlled on purpose: the deposit form has quick-amount chips that set the
 * value from outside, which an input holding its own state could not reflect.
 */
export function MoneyInput({
  name,
  id,
  value,
  onChange,
  min,
  max,
  required,
  placeholder,
  className,
}: {
  name: string;
  id?: string;
  /** The raw amount, or null when empty. */
  value: number | null;
  onChange: (value: number | null) => void;
  min?: number;
  max?: number;
  required?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const display = value === null ? "" : value.toLocaleString("en-NG");

  function handle(next: string) {
    // Digits only — a thousands separator is presentation, not input.
    const digits = next.replace(/[^\d]/g, "").replace(/^0+(?=\d)/, "");
    onChange(digits ? Number(digits) : null);
  }

  return (
    <>
      <input type="hidden" name={name} value={value === null ? "" : String(value)} />
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        required={required}
        value={display}
        onChange={(e) => handle(e.target.value)}
        placeholder={placeholder}
        className={className}
        aria-describedby={min !== undefined || max !== undefined ? `${id}-range` : undefined}
      />
      {(min !== undefined || max !== undefined) && (
        <span id={`${id}-range`} className="sr-only">
          {min !== undefined && `Minimum ${min.toLocaleString("en-NG")} naira. `}
          {max !== undefined && `Maximum ${max.toLocaleString("en-NG")} naira.`}
        </span>
      )}
    </>
  );
}
