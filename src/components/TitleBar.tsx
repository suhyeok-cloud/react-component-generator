export function TitleBar({ title }: { title: string }) {
  return (
    <div className="titlebar">
      <span className="titlebar-title">{title}</span>
      <span className="titlebar-ctrl" aria-hidden="true">
        <i />
        <i />
      </span>
    </div>
  );
}
