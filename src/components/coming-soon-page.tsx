interface ComingSoonPageProps {
  title: string;
  description: string;
  icon: React.ReactNode;
}

export function ComingSoonPage({ title, description, icon }: ComingSoonPageProps) {
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
        {title}
      </h1>

      <div className="mt-6 flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-300 bg-white px-6 py-16 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
          {icon}
        </div>
        <h2 className="mt-5 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Coming Soon
        </h2>
        <p className="mt-2 max-w-sm text-center text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
          {description}
        </p>
        <span className="mt-6 rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
          Under Development
        </span>
      </div>
    </div>
  );
}
