import { Pressable, Text, View } from 'react-native';

import { notificationStyles } from '@/screens/notifications/styles';
import type { NotificationFilter } from '@/utils/notificationDisplay';

type NotificationFilterTabsProps = {
  activeFilter: NotificationFilter;
  counts: Record<NotificationFilter, number>;
  onChange: (filter: NotificationFilter) => void;
};

const FILTERS: Array<{ key: NotificationFilter; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'important', label: 'Important' },
];

export function NotificationFilterTabs({
  activeFilter,
  counts,
  onChange,
}: NotificationFilterTabsProps) {
  return (
    <View style={notificationStyles.filterContainer}>
      {FILTERS.map((filter) => {
        const isActive = activeFilter === filter.key;

        return (
          <Pressable
            key={filter.key}
            accessibilityLabel={`${filter.label}, ${counts[filter.key]}`}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
            style={[notificationStyles.filterTab, isActive ? notificationStyles.filterTabActive : null]}
            onPress={() => onChange(filter.key)}
          >
            <Text
              numberOfLines={1}
              style={[
                notificationStyles.filterTabLabel,
                isActive ? notificationStyles.filterTabLabelActive : null,
              ]}
            >
              {filter.label}
            </Text>
            <Text
              style={[
                notificationStyles.filterCount,
                isActive ? notificationStyles.filterCountActive : null,
              ]}
            >
              {counts[filter.key]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
