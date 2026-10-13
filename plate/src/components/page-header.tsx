/** Consistent title block at the top of each tab. */
export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <header className="flex items-end justify-between gap-3">
      <div className="min-w-0">
        {subtitle && <p className="text-sm text-muted-foreground" suppressHydrationWarning>{subtitle}</p>}
        <h1 className="text-2xl font-semibold tracking-tight" suppressHydrationWarning>
          {title}
        </h1>
      </div>
      {action}
    </header>
  );
}
