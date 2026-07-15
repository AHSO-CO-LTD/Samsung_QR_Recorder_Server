import type { Locale } from "@/lib/i18n";
import type { NotificationEvent, NotificationTemplate } from "@/features/shared/types";

export function getNotificationTitle(item: NotificationEvent, locale: Locale) {
  return locale === "vi" ? item.title_vi || item.title : item.title_en || item.title;
}

export function getNotificationMessage(item: NotificationEvent, locale: Locale) {
  return locale === "vi" ? item.message_vi || item.message : item.message_en || item.message;
}

export function getNotificationTemplateTitle(item: NotificationTemplate, locale: Locale) {
  return locale === "vi" ? item.title_template_vi || item.title_template : item.title_template_en || item.title_template;
}

export function getNotificationTemplateMessage(item: NotificationTemplate, locale: Locale) {
  return locale === "vi" ? item.message_template_vi || item.message_template : item.message_template_en || item.message_template;
}
