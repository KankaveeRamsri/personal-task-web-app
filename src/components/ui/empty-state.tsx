interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="nx-empty">
      <div className="nx-empty-icon">{icon}</div>
      <p className="nx-empty-title">{title}</p>
      {description && <p className="nx-empty-desc">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
