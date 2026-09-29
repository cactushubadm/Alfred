"use client";

// Máscara de dinheiro estilo "calculadora": os dígitos digitados vão
// preenchendo da direita pra esquerda, os 2 últimos sempre são os centavos —
// o mesmo padrão usado em apps bancários (ex.: Nubank). `value`/`onChange`
// trafegam como string decimal com ponto ("1500.00"), pronta pra Number().

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
  autoFocus?: boolean;
};

function digitsToDecimalString(digits: string): string {
  const onlyDigits = digits.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
  if (!onlyDigits) return "";
  const padded = onlyDigits.padStart(3, "0");
  const whole = padded.slice(0, -2);
  const cents = padded.slice(-2);
  return `${whole}.${cents}`;
}

function formatDisplay(decimalString: string): string {
  if (!decimalString) return "";
  const [whole, cents] = decimalString.split(".");
  const withThousands = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${withThousands},${cents ?? "00"}`;
}

export default function MoneyInput({
  value,
  onChange,
  placeholder = "0,00",
  required,
  className,
  autoFocus,
}: Props) {
  return (
    <input
      type="text"
      inputMode="decimal"
      placeholder={placeholder}
      required={required}
      autoFocus={autoFocus}
      value={formatDisplay(value)}
      onChange={(e) => onChange(digitsToDecimalString(e.target.value))}
      className={className}
    />
  );
}
