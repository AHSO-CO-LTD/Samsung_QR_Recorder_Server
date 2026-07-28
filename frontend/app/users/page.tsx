import { UsersView } from "@/features/users/users-view";
import { PageGuideToolbar } from "@/features/guides/guide-launcher";

export default function UsersPage() {
  return (
    <div className="min-w-0 space-y-4">
      <PageGuideToolbar guideIds={["16-nguoi-dung-phan-quyen"]} />
      <UsersView />
    </div>
  );
}
