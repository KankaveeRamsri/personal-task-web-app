interface ComingSoonPageProps {
  title: string;
  description: string;
  icon: React.ReactNode;
}

export function ComingSoonPage({ title, description, icon }: ComingSoonPageProps) {
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="nx-heading-lg">
        {title}
      </h1>

      <div className="mt-6 nx-empty rounded-2xl border border-dashed border-zinc-300 bg-white px-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
        <div className="nx-empty-icon">
          {icon}
        </div>
        <h2 className="mt-5 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Coming Soon
        </h2>
        <p className="mt-2 max-w-sm text-center text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
          {description}
        </p>
        <span className="mt-6 rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
          In Development
        </span>
      </div>
    </div>
  );
}
