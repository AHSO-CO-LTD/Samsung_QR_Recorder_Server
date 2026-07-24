import { redirect } from "next/navigation";

export default function DuplicateAuditPage() {
  redirect("/scans?tab=scheduled-duplicate-check");
}
