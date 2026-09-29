export default function ToggleSwitch({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      // appearance-none + border-0/p-0 evitam que o Safari/iOS desenhe o
      // "chrome" nativo de botão por cima do estilo customizado (o efeito
      // de bolha clara sobreposta que aparecia no toggle)
      className={`relative inline-flex h-6 w-11 flex-none shrink-0 appearance-none items-center rounded-full border-0 p-0 outline-none transition-colors ${
        checked ? "bg-forest" : "bg-line-soft dark:bg-text-muted-dark/30"
      }`}
      style={{ WebkitTapHighlightColor: "transparent" }}
    >
      <span
        className={`pointer-events-none block h-5 w-5 flex-none rounded-full bg-white transition-transform ${
          checked ? "translate-x-5" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}
