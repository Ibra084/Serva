const steps = [
  { label: "Scan", description: "Guest scans the code at the table" },
  { label: "Browse", description: "Full menu, no app download" },
  { label: "Ask", description: "Questions about dishes, answered instantly" },
  { label: "Order", description: "Sent straight to the kitchen" },
];

export function CustomerJourneyTimeline() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {steps.map((step, index) => (
        <div key={step.label} className="glass-tile flex flex-col gap-3 rounded-2xl p-5">
          <span className="font-serif text-lg text-muted-foreground/50">
            0{index + 1}
          </span>
          <p className="text-sm font-medium text-foreground">{step.label}</p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {step.description}
          </p>
        </div>
      ))}
    </div>
  );
}
