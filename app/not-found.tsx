import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex h-full items-center justify-center bg-background">
      <div className="text-center px-6">
        <h1 className="text-6xl font-light text-muted mb-4">404</h1>
        <p className="text-sm text-muted mb-6">页面不存在</p>
        <Link
          href="/chat"
          className="inline-flex items-center justify-center rounded-lg bg-foreground text-background px-4 py-2 text-sm font-medium transition-colors hover:bg-[#383838]"
        >
          返回聊天
        </Link>
      </div>
    </div>
  );
}
