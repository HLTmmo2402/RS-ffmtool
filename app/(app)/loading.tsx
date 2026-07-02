export default function Loading() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-6 w-44 rounded bg-slate-200" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 rounded-lg bg-slate-200/70" />
        ))}
      </div>
      <div className="h-72 rounded-lg bg-slate-200/50" />
    </div>
  );
}
