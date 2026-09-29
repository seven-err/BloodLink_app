import type { LucideIcon } from 'lucide-react-native';
import {
  AlertCircle,
  Bell,
  Calendar,
  Heart,
  Megaphone,
  MessageCircle,
} from 'lucide-react-native';

import { colors } from '@/constants/theme';
import type { AppNotification } from '@/services/supabase/notifications';
import { parseNotificationData } from '@/utils/notificationData';

export type NotificationFilter = 'all' | 'unread' | 'important';

export type NotificationVisual = {
  Icon: LucideIcon;
  iconBackground: string;
  iconColor: string;
  isHighPriority: boolean;
  label: string;
};

export type NotificationDateGroup = 'today' | 'yesterday' | 'this_week' | 'earlier';

export type NotificationSection = {
  data: AppNotification[];
  key: NotificationDateGroup;
  title: string;
};

const readPriority = (notification: AppNotification) => {
  if (!notification.data || typeof notification.data !== 'object' || Array.isArray(notification.data)) {
    return undefined;
  }

  const priority = (notification.data as Record<string, unknown>).priority;
  return typeof priority === 'string' ? priority.toLowerCase() : undefined;
};

export const getNotificationVisual = (notification: AppNotification): NotificationVisual => {
  const priority = readPriority(notification);
  const isCritical =
    priority === 'critical' ||
    priority === 'high' ||
    priority === 'urgent' ||
    notification.title.toLowerCase().includes('critical');

  switch (notification.type) {
    case 'blood_request':
      return {
        Icon: AlertCircle,
        iconBackground: colors.primarySoft,
        iconColor: colors.primary,
        isHighPriority: true,
        label: 'Blood request',
      };
    case 'donor_match':
      return {
        Icon: Heart,
        iconBackground: colors.primarySoft,
        iconColor: colors.primary,
        isHighPriority: true,
        label: 'Match',
      };
    case 'donation':
      return {
        Icon: Calendar,
        iconBackground: colors.successSoft,
        iconColor: colors.success,
        isHighPriority: isCritical,
        label: 'Donation',
      };
    case 'verification':
      return {
        Icon: Calendar,
        iconBackground: colors.successSoft,
        iconColor: colors.success,
        isHighPriority: false,
        label: 'Verification',
      };
    case 'system':
      if (
        notification.title.toLowerCase().includes('message') ||
        notification.body.toLowerCase().includes('message')
      ) {
        return {
          Icon: MessageCircle,
          iconBackground: colors.infoSoft,
          iconColor: colors.info,
          isHighPriority: false,
          label: 'Message',
        };
      }

      if (
        notification.title.toLowerCase().includes('status') ||
        notification.title.toLowerCase().includes('update')
      ) {
        return {
          Icon: Bell,
          iconBackground: colors.orangeSoft,
          iconColor: colors.orangeText,
          isHighPriority: false,
          label: 'Update',
        };
      }

      return {
        Icon: Megaphone,
        iconBackground: colors.infoSoft,
        iconColor: colors.info,
        isHighPriority: false,
        label: 'System',
      };
    default:
      return {
        Icon: Bell,
        iconBackground: colors.background,
        iconColor: colors.muted,
        isHighPriority: false,
        label: 'Update',
      };
  }
};

export const isImportantNotification = (notification: AppNotification) => {
  const visual = getNotificationVisual(notification);
  const related = parseNotificationData(notification.data);

  return (
    visual.isHighPriority ||
    notification.type === 'blood_request' ||
    notification.type === 'donor_match' ||
    Boolean(related.relatedRequestId)
  );
};

export const filterNotifications = (
  notifications: AppNotification[],
  filter: NotificationFilter,
) => {
  switch (filter) {
    case 'unread':
      return notifications.filter((notification) => notification.read_at === null);
    case 'important':
      return notifications.filter((notification) => isImportantNotification(notification));
    default:
      return notifications;
  }
};

const startOfLocalDay = (date: Date) => {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy.getTime();
};

const SECTION_TITLES: Record<NotificationDateGroup, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  this_week: 'This week',
  earlier: 'Earlier',
};

export const groupNotificationsByDate = (
  notifications: AppNotification[],
  now = new Date(),
): NotificationSection[] => {
  const today = startOfLocalDay(now);
  const dayMs = 24 * 60 * 60 * 1000;
  const buckets: Record<NotificationDateGroup, AppNotification[]> = {
    today: [],
    yesterday: [],
    this_week: [],
    earlier: [],
  };

  for (const notification of notifications) {
    const created = new Date(notification.created_at);
    const day = Number.isNaN(created.getTime()) ? today : startOfLocalDay(created);

    if (day >= today) {
      buckets.today.push(notification);
    } else if (day >= today - dayMs) {
      buckets.yesterday.push(notification);
    } else if (day >= today - 6 * dayMs) {
      buckets.this_week.push(notification);
    } else {
      buckets.earlier.push(notification);
    }
  }

  return (Object.keys(buckets) as NotificationDateGroup[])
    .filter((key) => buckets[key].length > 0)
    .map((key) => ({
      data: buckets[key],
      key,
      title: SECTION_TITLES[key],
    }));
};
