export default function Marquee({ items }: { items: string[] }) {
  // Rendered twice so the -50% keyframe lands on a seam nobody can see.
  const run = [...items, ...items];
  return (
    <div className="marquee">
      <div className="marquee-track">
        {run.map((t, i) => (
          <span key={i} className="micro dim">
            {t} <span className="faint">/</span>
          </span>
        ))}
      </div>
    </div>
  );
}
