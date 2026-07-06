// Component UI tái dùng — chốt 1 radius/shadow/spacing, thay các mẫu inline lặp khắp app.
import { statusMeta } from "@/lib/status";

export function Card({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return <div className={"rounded-xl border border-slate-200 bg-white shadow-sm " + className}>{children}</div>;
}

const TONE: Record<string, string> = {
  slate: "bg-slate-100 text-slate-600",
  blue: "bg-blue-100 text-blue-700",
  red: "bg-red-100 text-red-700",
  amber: "bg-amber-100 text-amber-700",
  emerald: "bg-emerald-100 text-emerald-700",
  orange: "bg-orange-100 text-orange-700",
};

export function Badge({ tone = "slate", className = "", children }: { tone?: keyof typeof TONE | string; className?: string; children: React.ReactNode }) {
  return <span className={"inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium " + (TONE[tone] ?? TONE.slate) + " " + className}>{children}</span>;
}

// Badge trạng thái — đọc nhãn + màu từ lib/status (1 nguồn duy nhất)
export function StatusBadge({ status, dot = true }: { status?: string; dot?: boolean }) {
  const m = statusMeta(status);
  return (
    <span className={"inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium " + m.badge}>
      {dot && <span className={"h-1.5 w-1.5 rounded-full " + m.dot} />}
      {m.label}
    </span>
  );
}

const BTN: Record<string, string> = {
  primary: "bg-slate-900 text-white hover:bg-slate-700",
  secondary: "border border-slate-300 text-slate-700 hover:bg-slate-100",
  ghost: "text-slate-600 hover:bg-slate-100",
  danger: "bg-red-600 text-white hover:bg-red-700",
};

export function Button({
  variant = "primary", size = "md", className = "", ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof BTN; size?: "sm" | "md" }) {
  const sz = size === "sm" ? "px-3 py-1.5" : "px-4 py-2";
  return (
    <button
      className={`inline-flex items-center justify-center gap-1.5 rounded-md text-sm font-medium transition disabled:opacity-50 ${BTN[variant]} ${sz} ${className}`}
      {...props}
    />
  );
}

export function PageHeader({ title, sub, actions }: { title: string; sub?: string; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div>
        <h1 className="text-lg font-semibold">{title}</h1>
        {sub && <p className="text-sm text-slate-500">{sub}</p>}
      </div>
      {actions}
    </div>
  );
}
