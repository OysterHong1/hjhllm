type ErrorNoticeProps = {
  message: string;
  className?: string;
};

export function ErrorNotice({ message, className = "" }: ErrorNoticeProps) {
  if (!message) return null;

  return (
    <div
      role="alert"
      className={`rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 ${className}`}
    >
      {message}
    </div>
  );
}
