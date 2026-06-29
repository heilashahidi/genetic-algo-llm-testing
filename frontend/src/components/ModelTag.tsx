/** The run's target model, shown as a crosshair-marked mono tag. */
export function ModelTag({ model }: { model: string | null }) {
  if (!model || model === "unknown") {
    return <span className="model-tag model-tag--unknown">unknown</span>;
  }
  return (
    <span className="model-tag" title={`Target model: ${model}`}>
      <svg
        className="model-tag__icon"
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="7" />
        <path d="M12 1.5V5M12 19v3.5M1.5 12H5M19 12h3.5" />
      </svg>
      {model}
    </span>
  );
}
