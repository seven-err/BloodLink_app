import { Building2, ChevronRight, MapPin, PenLine, RefreshCw, Search, X } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { SwipeableBottomSheetModal } from '@/components/common/SwipeableBottomSheetModal';
import {
  BLOOD_REQUEST_FACILITY_DIRECTORY,
  type BloodRequestFacility,
} from '@/constants/bloodRequestFacilities';
import { colors, radii } from '@/constants/theme';
import { listVerifiedBloodbankFacilities } from '@/services/supabase/bloodbankFacilities';

type Props = {
  error?: string;
  onChooseManual: () => void;
  onSelect: (facility: BloodRequestFacility) => void;
  selectedAddress?: string;
  selectedName?: string;
};

const getFacilityLocation = (facility: BloodRequestFacility) =>
  facility.address.trim() || facility.branchLocation?.trim() || 'Location not provided';

const normalizeFacilityName = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]/g, '');

const mergeFacilities = (
  directory: BloodRequestFacility[],
  connected: BloodRequestFacility[],
) => {
  const connectedByName = new Map(
    connected.map((facility) => [normalizeFacilityName(facility.displayName), facility]),
  );
  const matchedConnectedIds = new Set<string>();

  const mergedDirectory = directory.map((facility) => {
    const connectedFacility = connectedByName.get(normalizeFacilityName(facility.displayName));

    if (connectedFacility) {
      matchedConnectedIds.add(connectedFacility.id);
      return connectedFacility;
    }

    return facility;
  });

  return [
    ...mergedDirectory,
    ...connected.filter((facility) => !matchedConnectedIds.has(facility.id)),
  ];
};

export function BloodbankFacilityPicker({
  error,
  onChooseManual,
  onSelect,
  selectedAddress,
  selectedName,
}: Props) {
  const [visible, setVisible] = useState(false);
  const [query, setQuery] = useState('');
  const [facilities, setFacilities] = useState<BloodRequestFacility[]>(
    BLOOD_REQUEST_FACILITY_DIRECTORY,
  );
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [hasLoadedConnected, setHasLoadedConnected] = useState(false);

  const loadFacilities = async () => {
    setLoading(true);
    setLoadError(null);

    try {
      const { data, error: requestError } = await listVerifiedBloodbankFacilities();

      if (requestError) {
        setLoadError('Showing directory listings. BloodLink facilities could not be refreshed.');
      } else {
        setFacilities(mergeFacilities(BLOOD_REQUEST_FACILITY_DIRECTORY, data ?? []));
        setHasLoadedConnected(true);
      }
    } catch {
      setLoadError('Showing directory listings. BloodLink facilities could not be refreshed.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible && !hasLoadedConnected && !loading && !loadError) {
      void loadFacilities();
    }
  }, [hasLoadedConnected, loadError, loading, visible]);

  const filteredFacilities = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    if (!normalized) {
      return facilities;
    }

    return facilities.filter((facility) =>
      [facility.displayName, facility.branchLocation, facility.address]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(normalized)),
    );
  }, [facilities, query]);

  const chooseFacility = (facility: BloodRequestFacility) => {
    onSelect(facility);
    setVisible(false);
    setQuery('');
  };

  const chooseManual = () => {
    onChooseManual();
    setVisible(false);
    setQuery('');
  };

  return (
    <View style={styles.field}>
      <Text style={styles.label}>Hospital / Blood Bank</Text>
      <Pressable
        accessibilityLabel={selectedName ? `Selected facility: ${selectedName}. Change facility` : 'Select hospital or blood bank'}
        accessibilityRole="button"
        style={({ pressed }) => [styles.selector, error ? styles.selectorError : null, pressed ? styles.pressed : null]}
        onPress={() => setVisible(true)}
      >
        <View style={styles.selectorIcon}>
          <Building2 color={selectedName ? colors.primary : colors.muted} size={18} />
        </View>
        <View style={styles.selectorCopy}>
          <Text numberOfLines={1} style={selectedName ? styles.selectedName : styles.placeholder}>
            {selectedName || 'Select hospital or blood bank'}
          </Text>
          {selectedName && selectedAddress ? (
            <Text numberOfLines={1} style={styles.selectedAddress}>{selectedAddress}</Text>
          ) : null}
        </View>
        <ChevronRight color={colors.muted} size={19} />
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <SwipeableBottomSheetModal
        maxHeight="88%"
        visible={visible}
        onDismiss={() => {
          setVisible(false);
          setQuery('');
        }}
      >
        <View style={styles.sheetHeader}>
          <View style={styles.sheetTitleRow}>
            <View style={styles.sheetTitleCopy}>
              <Text style={styles.sheetTitle}>Select Hospital / Blood Bank</Text>
              <Text style={styles.sheetSubtitle}>Choose a listed facility or enter one manually.</Text>
            </View>
            <Pressable accessibilityLabel="Close facility picker" hitSlop={8} onPress={() => setVisible(false)}>
              <X color={colors.muted} size={22} />
            </Pressable>
          </View>
          <View style={styles.searchShell}>
            <Search color={colors.muted} size={18} />
            <TextInput
              autoCapitalize="none"
              placeholder="Search hospitals or locations"
              placeholderTextColor={colors.mutedLight}
              returnKeyType="search"
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
            />
            {query ? (
              <Pressable accessibilityLabel="Clear search" hitSlop={8} onPress={() => setQuery('')}>
                <X color={colors.muted} size={18} />
              </Pressable>
            ) : null}
          </View>
        </View>

        {loading || loadError ? (
          <View style={styles.statusBanner}>
            {loading ? <ActivityIndicator color={colors.primary} size="small" /> : null}
            <Text style={styles.statusText}>
              {loading ? 'Checking for BloodLink-connected facilities…' : loadError}
            </Text>
            {loadError ? (
              <Pressable accessibilityLabel="Retry connected facility refresh" hitSlop={8} onPress={() => void loadFacilities()}>
                <RefreshCw color={colors.primary} size={17} />
              </Pressable>
            ) : null}
          </View>
        ) : null}

          <FlatList
            contentContainerStyle={styles.listContent}
            data={filteredFacilities}
            keyboardShouldPersistTaps="handled"
            keyExtractor={(item) => item.id}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={styles.stateText}>No facilities match your search.</Text>
              </View>
            }
            renderItem={({ item }) => (
              <Pressable
                accessibilityRole="button"
                style={({ pressed }) => [styles.facilityRow, pressed ? styles.pressed : null]}
                onPress={() => chooseFacility(item)}
              >
                <View style={styles.rowIcon}>
                  <MapPin color={colors.primary} size={17} />
                </View>
                <View style={styles.rowCopy}>
                  <Text style={styles.rowTitle}>{item.displayName}</Text>
                  <Text numberOfLines={2} style={styles.rowSubtitle}>{getFacilityLocation(item)}</Text>
                  <View style={[styles.sourcePill, item.source === 'bloodlink' ? styles.connectedPill : null]}>
                    <Text style={[styles.sourceText, item.source === 'bloodlink' ? styles.connectedText : null]}>
                      {item.source === 'bloodlink' ? 'BloodLink facility' : 'Directory listing'}
                    </Text>
                  </View>
                </View>
                <ChevronRight color={colors.mutedLight} size={18} />
              </Pressable>
            )}
          />

        <View style={styles.manualFooter}>
          <Pressable accessibilityRole="button" style={({ pressed }) => [styles.manualButton, pressed ? styles.pressed : null]} onPress={chooseManual}>
            <PenLine color={colors.foreground} size={18} />
            <View style={styles.rowCopy}>
              <Text style={styles.rowTitle}>Other hospital / blood bank</Text>
              <Text style={styles.rowSubtitle}>Enter the facility and location manually</Text>
            </View>
            <ChevronRight color={colors.mutedLight} size={18} />
          </Pressable>
        </View>
      </SwipeableBottomSheetModal>
    </View>
  );
}

const styles = StyleSheet.create({
  emptyState: { paddingHorizontal: 20, paddingVertical: 28 },
  error: { color: colors.primary, fontSize: 13, lineHeight: 18 },
  facilityRow: { alignItems: 'center', borderBottomColor: colors.border, borderBottomWidth: 1, flexDirection: 'row', gap: 12, minHeight: 72, paddingHorizontal: 20, paddingVertical: 12 },
  field: { gap: 8 },
  label: { color: colors.foreground, fontSize: 14, fontWeight: '700' },
  listContent: { flexGrow: 1 },
  manualButton: { alignItems: 'center', backgroundColor: colors.background, borderRadius: 14, flexDirection: 'row', gap: 12, minHeight: 66, padding: 14 },
  manualFooter: { borderTopColor: colors.border, borderTopWidth: 1, padding: 16 },
  placeholder: { color: colors.muted, fontSize: 15 },
  pressed: { opacity: 0.72 },
  rowCopy: { flex: 1, gap: 3 },
  rowIcon: { alignItems: 'center', backgroundColor: colors.primarySoft, borderRadius: 12, height: 38, justifyContent: 'center', width: 38 },
  rowSubtitle: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  rowTitle: { color: colors.foreground, fontSize: 15, fontWeight: '700' },
  searchInput: { color: colors.foreground, flex: 1, fontSize: 15, paddingVertical: 11 },
  searchShell: { alignItems: 'center', backgroundColor: colors.background, borderColor: colors.border, borderRadius: 13, borderWidth: 1, flexDirection: 'row', gap: 9, paddingHorizontal: 13 },
  selectedAddress: { color: colors.muted, fontSize: 12, lineHeight: 16 },
  selectedName: { color: colors.foreground, fontSize: 15, fontWeight: '700' },
  selector: { alignItems: 'center', backgroundColor: colors.background, borderColor: colors.border, borderRadius: 13, borderWidth: 1, flexDirection: 'row', gap: 11, minHeight: 58, paddingHorizontal: 13, paddingVertical: 9 },
  selectorCopy: { flex: 1, gap: 2 },
  selectorError: { borderColor: colors.primary },
  selectorIcon: { alignItems: 'center', backgroundColor: colors.card, borderRadius: 10, height: 34, justifyContent: 'center', width: 34 },
  sheetHeader: { gap: 14, paddingBottom: 12, paddingHorizontal: 20 },
  sheetSubtitle: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  sheetTitle: { color: colors.foreground, fontSize: 19, fontWeight: '800' },
  sheetTitleCopy: { flex: 1, gap: 4 },
  sheetTitleRow: { alignItems: 'flex-start', flexDirection: 'row', gap: 12 },
  sourcePill: { alignSelf: 'flex-start', backgroundColor: colors.background, borderColor: colors.border, borderRadius: radii.pill, borderWidth: 1, marginTop: 3, paddingHorizontal: 8, paddingVertical: 3 },
  sourceText: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  connectedPill: { backgroundColor: colors.primarySoft, borderColor: colors.primarySoft },
  connectedText: { color: colors.primary },
  stateText: { color: colors.muted, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  statusBanner: { alignItems: 'center', backgroundColor: colors.card, borderBottomColor: colors.border, borderBottomWidth: 1, flexDirection: 'row', gap: 9, paddingHorizontal: 20, paddingVertical: 10 },
  statusText: { color: colors.muted, flex: 1, fontSize: 12, lineHeight: 17 },
});
