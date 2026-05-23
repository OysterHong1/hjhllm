import { notFound } from "next/navigation";
import AdminClient from "@/features/admin/AdminClient";

export const dynamic = "force-dynamic";

export default function AdminPage() {
  const enabled =
    process.env.NODE_ENV !== "production" ||
    process.env.ENABLE_ADMIN_UI === "true" ||
    process.env.NEXT_PUBLIC_ENABLE_ADMIN_UI === "true";

  if (!enabled) notFound();

  return <AdminClient />;
}
