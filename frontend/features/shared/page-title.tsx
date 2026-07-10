export function PageTitle({ title, description }: { title: string; description: string }) {
  return (
    <div className="space-y-1">
      <h1 className="truncate text-xl font-semibold tracking-normal">{title}</h1>
      <p className="max-w-3xl text-sm leading-6 text-muted-foreground">{description}</p>
    </div>
  );
}
