import { ResourcePanel } from "@/features/resource-panel";

export default function NotificationsPage() {
  return (
    <div className="grid min-w-0 gap-4 xl:grid-cols-2">
      <ResourcePanel titleKey="notifications" descriptionKey="notificationDesc" endpoint="/notifications?take=50" />
      <ResourcePanel titleKey="notifications" descriptionKey="settingsDesc" endpoint="/notifications/templates" />
    </div>
  );
}
