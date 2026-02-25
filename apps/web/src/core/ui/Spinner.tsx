type SpinnerProps = {
  text?: string;
};

export function Spinner({ text = "Yükleniyor..." }: SpinnerProps) {
  return (
    <div className="spinner-container">
      <div className="spinner" />
      {text && <span className="spinner-text">{text}</span>}
    </div>
  );
}
