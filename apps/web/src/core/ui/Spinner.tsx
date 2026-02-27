type SpinnerProps = {
  text?: string;
  variant?: "spinner" | "skeleton-table";
};

export function Spinner({ text = "Yükleniyor...", variant = "spinner" }: SpinnerProps) {
  if (variant === "skeleton-table") {
    return (
      <div className="skeleton-table" aria-busy="true" aria-label={text}>
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="skeleton-row">
            <div className="skeleton-cell" style={{ height: 18 }} />
            <div className="skeleton-cell" style={{ height: 18 }} />
            <div className="skeleton-cell" style={{ height: 18 }} />
            <div className="skeleton-cell" style={{ height: 18 }} />
            <div className="skeleton-cell" style={{ height: 18 }} />
            <div className="skeleton-cell" style={{ height: 18 }} />
            <div className="skeleton-cell" style={{ height: 18, maxWidth: 60 }} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="spinner-container">
      <div className="spinner" />
      {text && <span className="spinner-text">{text}</span>}
    </div>
  );
}
