import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  CheckCircle2,
  Crosshair,
  Droplets,
  Map as MapIcon,
  MapPin,
  Minus,
  Navigation,
  Plus,
  RefreshCw,
  Satellite,
  Search,
  SlidersHorizontal,
  UserRound,
  Users,
  X,
} from 'lucide-react-native';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NearbyDonorCard } from '@/components/donor/NearbyDonorCard';
import { Skeleton } from '@/components/common/Skeleton';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { SwipeableBottomSheetModal } from '@/components/common/SwipeableBottomSheetModal';
import {
  OpenStreetMapView,
  type OpenStreetMapViewHandle,
} from '@/components/map/OpenStreetMapView';
import type { MapViewMode } from '@/constants/mapTiles';
import { colors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useUserMode, type UserMode } from '@/context/UserModeContext';
import { useForegroundLocation } from '@/hooks/useForegroundLocation';
import type { AppTabParamList } from '@/navigation/AppTabNavigator';
import type { AppStackParamList } from '@/navigation/types';
import { nearbyDonorsMapStyles } from '@/screens/donor/nearbyDonorsMapStyles';
import {
  getNearbyMapDonors,
  type NearbyMapDonorItem,
} from '@/services/supabase/nearbyMapDonors';
import { setDonorMapVisibility } from '@/services/supabase/profiles';
import type { BloodType } from '@/types/database';
import { getValidCoordinates, regionFromCoordinates } from '@/utils/coordinates';
import { formatDistance } from '@/utils/travelMetrics';
import { sanitizeProfileError } from '@/utils/profileErrors';
import { openMapDirections } from '@/utils/mapDirections';
import { appCache } from '@/utils/appCache';

type Props = CompositeScreenProps<
  BottomTabScreenProps<AppTabParamList, 'Map'>,
  NativeStackScreenProps<AppStackParamList>
>;

const BLOOD_TYPES: BloodType[] = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const RADIUS_OPTIONS = [5, 10, 25, 50] as const;

type RadiusOption = (typeof RADIUS_OPTIONS)[number];
type CategoryChip = 'all' | 'available' | RadiusOption;

type MapScreenCopy = {
  emptyNoLocation: string;
  emptyNoResults: (radiusKm: number) => string;
  filterModalTitle: string;
  listTitle: string;
  loadingLabel: string;
  searchPlaceholder: string;
  summaryTitle: (count: number) => string;
  visibilityHelper: string;
};

const MAP_SCREEN_COPY: Record<UserMode, MapScreenCopy> = {
  donate: {
    searchPlaceholder: 'Search blood types...',
    listTitle: 'Donors in Area',
    filterModalTitle: 'Filter nearby donors',
    loadingLabel: 'Loading nearby donors...',
    summaryTitle: (count) =>
      count === 1 ? '1 donor nearby' : `${count} donors nearby`,
    emptyNoLocation:
      'Turn on location to explore donors near you and see distances from your GPS position.',
    emptyNoResults: (radiusKm) =>
      `No donors match your filters within ${radiusKm} km. Try widening the radius or adjusting filters.`,
    visibilityHelper:
      'Opt in to appear as a precise GPS pin for others browsing nearby.',
  },
  request: {
    searchPlaceholder: 'Search blood types...',
    listTitle: 'Available Donors',
    filterModalTitle: 'Filter donors',
    loadingLabel: 'Loading nearby donors...',
    summaryTitle: (count) =>
      count === 1 ? '1 donor nearby' : `${count} donors nearby`,
    emptyNoLocation:
      'Turn on location to load nearby donors and distances from your position.',
    emptyNoResults: (radiusKm) =>
      `No donors match your filters within ${radiusKm} km. Try widening the radius or turning off the Available filter.`,
    visibilityHelper:
      'Verified donors can opt in to appear as a precise GPS pin nearby.',
  },
};

/** ~1° latitude ≈ 111 km — used so radius chips change map zoom. */
const KM_PER_DEGREE = 111;

function NearbyDonorsMapSkeleton({ topInset }: { topInset: number }) {
  return (
    <View style={nearbyDonorsMapStyles.screen}>
      <View style={[nearbyDonorsMapStyles.topOverlay, { paddingTop: topInset + 8 }]}>
        <Skeleton borderRadius={24} height={50} style={{ marginHorizontal: 16 }} width="auto" />
        <Skeleton borderRadius={999} height={38} style={{ marginHorizontal: 16 }} width="70%" />
      </View>
      <View style={nearbyDonorsMapStyles.mapFill}>
        <Skeleton borderRadius={0} height="100%" width="100%" />
      </View>
      <View style={[nearbyDonorsMapStyles.bottomOverlay, { bottom: 24 }]}>
        <Skeleton borderRadius={24} height={120} width="100%" />
      </View>
    </View>
  );
}

const getOriginCoordinates = (
  gpsCoordinates: { latitude: number; longitude: number } | null,
  profileLatitude: number | null | undefined,
  profileLongitude: number | null | undefined,
) => {
  if (gpsCoordinates) {
    return gpsCoordinates;
  }

  if (
    profileLatitude != null &&
    profileLongitude != null &&
    Number.isFinite(profileLatitude) &&
    Number.isFinite(profileLongitude)
  ) {
    return {
      latitude: profileLatitude,
      longitude: profileLongitude,
    };
  }

  return null;
};

export function NearbyDonorsMapScreen({ navigation }: Props) {
  const { bottom: bottomInset, top: topInset } = useSafeAreaInsets();
  const { profile, refreshProfile, session } = useAuth();
  const { mode } = useUserMode();
  const copy = MAP_SCREEN_COPY[mode];
  const cachedDonors = appCache.getSync<NearbyMapDonorItem[]>('map:all_donors');
  const [donors, setDonors] = useState<NearbyMapDonorItem[]>(() => cachedDonors ?? []);
  const [loading, setLoading] = useState(() => !cachedDonors);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [bloodTypeFilter, setBloodTypeFilter] = useState<BloodType | null>(null);
  const [availableOnly, setAvailableOnly] = useState(false);
  const [radiusKm, setRadiusKm] = useState<RadiusOption>(25);

  const [selectedDonorId, setSelectedDonorId] = useState<string | null>(null);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [listModalVisible, setListModalVisible] = useState(false);
  const [mapVisibilityLoading, setMapVisibilityLoading] = useState(false);
  const [mapVisibilityError, setMapVisibilityError] = useState<string | null>(null);
  const [regionNonce, setRegionNonce] = useState(0);
  const [mapMode, setMapMode] = useState<MapViewMode>('standard');
  const mapRef = useRef<OpenStreetMapViewHandle>(null);

  const {
    coordinates: gpsCoordinates,
    status: locationStatus,
    message: locationMessage,
    requestLocation,
  } = useForegroundLocation();

  const originCoordinates = useMemo(
    () => getOriginCoordinates(gpsCoordinates, profile?.latitude, profile?.longitude),
    [gpsCoordinates, profile?.latitude, profile?.longitude],
  );

  const requestSeq = useRef(0);

  const loadDonors = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!originCoordinates) {
        if (!appCache.getSync('map:all_donors')) {
          setDonors([]);
        }
        setLoading(false);
        return;
      }

      const currentSeq = ++requestSeq.current;

      if (!options?.silent && !appCache.getSync('map:all_donors')) {
        setLoading(true);
      }
      setError(null);

      const { data, error: fetchError } = await getNearbyMapDonors({
        originLatitude: originCoordinates.latitude,
        originLongitude: originCoordinates.longitude,
        radiusKm,
        bloodType: bloodTypeFilter,
        availableOnly,
      });

      // Avoid race conditions or duplicate state sets if a newer request was made
      if (currentSeq !== requestSeq.current) {
        return;
      }

      if (fetchError) {
        setError(fetchError.message);
        if (!appCache.getSync('map:all_donors')) {
          setDonors([]);
        }
      } else {
        const fresh = data ?? [];
        setDonors(fresh);
        appCache.setSync('map:all_donors', fresh);
      }

      setLoading(false);
    },
    [availableOnly, bloodTypeFilter, originCoordinates, radiusKm],
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    await requestLocation();
    await loadDonors({ silent: true });
    setRegionNonce((current) => current + 1);
    setRefreshing(false);
  }, [loadDonors, requestLocation]);

  const handleRecenter = useCallback(async () => {
    await requestLocation();
    setRegionNonce((current) => current + 1);
  }, [requestLocation]);

  useFocusEffect(
    useCallback(() => {
      void requestLocation();
    }, [requestLocation]),
  );

  useEffect(() => {
    if (originCoordinates) {
      void loadDonors();
      return;
    }

    if (locationStatus !== 'requesting' && locationStatus !== 'idle') {
      setLoading(false);
    }
  }, [loadDonors, locationStatus, originCoordinates]);

  const visibleDonors = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return donors
      .filter((donor) => {
        if (!normalizedQuery) {
          return true;
        }

        const haystack = [donor.fullName, donor.bloodType].join(' ').toLowerCase();
        return haystack.includes(normalizedQuery);
      })
      .sort((left, right) => left.distanceMeters - right.distanceMeters);
  }, [donors, searchQuery]);

  const mapRegion = useMemo(() => {
    const points = visibleDonors.flatMap((donor) => {
      const coordinates = getValidCoordinates(donor.latitude, donor.longitude);
      return coordinates ? [coordinates] : [];
    });

    if (originCoordinates) {
      points.push(originCoordinates);
    }

    const fitted = regionFromCoordinates(points);
    const radiusDelta = Math.max((radiusKm / KM_PER_DEGREE) * 1.5, 0.02);

    return {
      ...fitted,
      latitude: originCoordinates?.latitude ?? fitted.latitude,
      longitude: originCoordinates?.longitude ?? fitted.longitude,
      latitudeDelta: originCoordinates ? radiusDelta : fitted.latitudeDelta,
      longitudeDelta: originCoordinates ? radiusDelta : fitted.longitudeDelta,
    };
  }, [originCoordinates, radiusKm, visibleDonors]);

  const mapMarkers = useMemo(
    () =>
      visibleDonors.flatMap((donor) => {
        const coordinates = getValidCoordinates(donor.latitude, donor.longitude);

        if (!coordinates) {
          return [];
        }

        return [
          {
            id: donor.donorId,
            coordinates,
            title: donor.fullName,
            description: `${donor.bloodType} · ${donor.isAvailable ? 'Available' : 'Unavailable'}`,
            bloodType: donor.bloodType,
            pinColor: donor.isAvailable ? colors.success : colors.muted,
            selectedPinColor: colors.primaryDark,
          },
        ];
      }),
    [visibleDonors],
  );

  const availableCount = useMemo(
    () => visibleDonors.filter((donor) => donor.isAvailable).length,
    [visibleDonors],
  );

  const selectedDonor = useMemo(
    () => visibleDonors.find((donor) => donor.donorId === selectedDonorId) ?? null,
    [selectedDonorId, visibleDonors],
  );

  const openDonorDetail = (donor: NearbyMapDonorItem) => {
    setListModalVisible(false);
    navigation.getParent()?.navigate('NearbyDonorDetail', { donor });
  };

  const handleCategoryPress = (chip: CategoryChip) => {
    if (chip === 'all') {
      setBloodTypeFilter(null);
      setAvailableOnly(false);
      return;
    }

    if (chip === 'available') {
      setAvailableOnly((current) => !current);
      return;
    }

    setRadiusKm(chip);
  };

  const handleMapVisibilityToggle = async (visibleOnMap: boolean) => {
    if (!session?.user.id || mapVisibilityLoading) {
      return;
    }

    setMapVisibilityLoading(true);
    setMapVisibilityError(null);

    let latitude = profile?.latitude ?? null;
    let longitude = profile?.longitude ?? null;

    if (visibleOnMap) {
      if (gpsCoordinates) {
        latitude = gpsCoordinates.latitude;
        longitude = gpsCoordinates.longitude;
      }

      if (
        latitude == null ||
        longitude == null ||
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude)
      ) {
        setMapVisibilityError(
          'Turn on location first so BloodLink can place your GPS pin on the map.',
        );
        setMapVisibilityLoading(false);
        return;
      }
    }

    const { error: updateError } = await setDonorMapVisibility({
      userId: session.user.id,
      visibleOnMap,
      latitude,
      longitude,
    });

    if (updateError) {
      setMapVisibilityError(
        sanitizeProfileError(updateError, 'Unable to update map visibility. Please try again.'),
      );
    } else {
      await refreshProfile();
      if (visibleOnMap) {
        void loadDonors({ silent: true });
      }
    }

    setMapVisibilityLoading(false);
  };

  const isDonor = profile?.role === 'donor';
  const showMapVisibilityCard = isDonor && mode === 'donate';
  const isMapBusy = loading || refreshing;
  const locationBlocked =
    locationStatus === 'denied' ||
    locationStatus === 'services_disabled' ||
    locationStatus === 'error';
  const showInitialSkeleton = loading && !originCoordinates && locationStatus === 'requesting';
  const hasActiveFilters = bloodTypeFilter != null || availableOnly || radiusKm !== 25;

  if (showInitialSkeleton) {
    return <NearbyDonorsMapSkeleton topInset={topInset} />;
  }

  const renderCategoryChip = (
    chip: CategoryChip,
    label: string,
    icon: ReactNode,
    isActive: boolean,
  ) => (
    <Pressable
      key={String(chip)}
      style={[nearbyDonorsMapStyles.chip, isActive ? nearbyDonorsMapStyles.chipActive : null]}
      onPress={() => handleCategoryPress(chip)}
    >
      {icon}
      <Text
        style={[
          nearbyDonorsMapStyles.chipLabel,
          isActive ? nearbyDonorsMapStyles.chipLabelActive : null,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );

  return (
    <View style={nearbyDonorsMapStyles.screen}>
      <View pointerEvents="box-none" style={nearbyDonorsMapStyles.mapFill}>
        {originCoordinates ? (
          <OpenStreetMapView
            ref={mapRef}
            fillContainer
            focusToken={regionNonce}
            fullBleed
            mapMode={mapMode}
            markers={mapMarkers}
            region={mapRegion}
            selectedMarkerId={selectedDonorId}
            showAttribution={false}
            showStyleToggle={false}
            showsUserLocation={locationStatus === 'granted'}
            userCoordinates={gpsCoordinates}
            onMapModeChange={setMapMode}
            onMapPress={() => setSelectedDonorId(null)}
            onMarkerPress={setSelectedDonorId}
          />
        ) : (
          <View style={nearbyDonorsMapStyles.emptyOverlay}>
            <View style={nearbyDonorsMapStyles.emptyCard}>
              <Text style={nearbyDonorsMapStyles.emptyText}>{copy.emptyNoLocation}</Text>
              <PrimaryButton title="Enable location" onPress={() => void requestLocation()} />
            </View>
          </View>
        )}
      </View>

      <View
        pointerEvents="box-none"
        style={[nearbyDonorsMapStyles.topOverlay, { paddingTop: topInset + 8 }]}
      >
        <View style={nearbyDonorsMapStyles.searchShell}>
          <Search color={colors.muted} size={18} strokeWidth={2} />
          <TextInput
            placeholder={copy.searchPlaceholder}
            placeholderTextColor={colors.mutedLight}
            style={nearbyDonorsMapStyles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          <Pressable
            accessibilityLabel="Open map filters"
            accessibilityRole="button"
            style={nearbyDonorsMapStyles.filterButton}
            onPress={() => setFilterModalVisible(true)}
          >
            <SlidersHorizontal
              color={hasActiveFilters ? colors.foreground : colors.muted}
              size={18}
              strokeWidth={2.25}
            />
          </Pressable>
        </View>

        <ScrollView
          horizontal
          contentContainerStyle={nearbyDonorsMapStyles.chipRow}
          showsHorizontalScrollIndicator={false}
          style={nearbyDonorsMapStyles.chipScroll}
        >
          {renderCategoryChip(
            'all',
            'All',
            <MapPin
              color={
                bloodTypeFilter === null && !availableOnly
                  ? colors.primaryForeground
                  : colors.muted
              }
              size={15}
              strokeWidth={2.25}
            />,
            bloodTypeFilter === null && !availableOnly,
          )}
          {renderCategoryChip(
            'available',
            'Available',
            <CheckCircle2
              color={availableOnly ? colors.primaryForeground : colors.muted}
              size={15}
              strokeWidth={2.25}
            />,
            availableOnly,
          )}
          {RADIUS_OPTIONS.map((option) =>
            renderCategoryChip(
              option,
              `${option} km`,
              <Droplets
                color={radiusKm === option ? colors.primaryForeground : colors.muted}
                size={15}
                strokeWidth={2.25}
              />,
              radiusKm === option,
            ),
          )}
        </ScrollView>

        {loading && !refreshing && originCoordinates ? (
          <View style={nearbyDonorsMapStyles.mapLoadingBadge}>
            <ActivityIndicator color={colors.muted} size="small" />
            <Text style={nearbyDonorsMapStyles.mapLoadingText}>{copy.loadingLabel}</Text>
          </View>
        ) : null}
      </View>

      {originCoordinates ? (
        <>
          <View
            pointerEvents="box-none"
            style={[
              nearbyDonorsMapStyles.zoomControls,
              { bottom: (selectedDonor ? 210 : 150) + Math.max(bottomInset, 8) },
            ]}
          >
            <Pressable
              accessibilityLabel="Zoom in"
              accessibilityRole="button"
              style={({ pressed }) => [
                nearbyDonorsMapStyles.mapControlButton,
                pressed ? nearbyDonorsMapStyles.mapControlButtonPressed : null,
              ]}
              onPress={() => mapRef.current?.zoomIn()}
            >
              <Plus color={colors.foreground} size={20} strokeWidth={2.25} />
            </Pressable>
            <Pressable
              accessibilityLabel="Zoom out"
              accessibilityRole="button"
              style={({ pressed }) => [
                nearbyDonorsMapStyles.mapControlButton,
                pressed ? nearbyDonorsMapStyles.mapControlButtonPressed : null,
              ]}
              onPress={() => mapRef.current?.zoomOut()}
            >
              <Minus color={colors.foreground} size={20} strokeWidth={2.25} />
            </Pressable>
          </View>

          <View
            pointerEvents="box-none"
            style={[
              nearbyDonorsMapStyles.mapControls,
              { bottom: (selectedDonor ? 210 : 150) + Math.max(bottomInset, 8) },
            ]}
          >
            <Pressable
              accessibilityLabel="Refresh map and donor list"
              accessibilityRole="button"
              disabled={isMapBusy}
              style={({ pressed }) => [
                nearbyDonorsMapStyles.mapControlButton,
                pressed || isMapBusy ? nearbyDonorsMapStyles.mapControlButtonPressed : null,
              ]}
              onPress={() => void handleRefresh()}
            >
              {refreshing ? (
                <ActivityIndicator color={colors.muted} size="small" />
              ) : (
                <RefreshCw color={colors.foreground} size={20} strokeWidth={2.25} />
              )}
            </Pressable>

            <Pressable
              accessibilityLabel="Recenter map on my location"
              accessibilityRole="button"
              style={({ pressed }) => [
                nearbyDonorsMapStyles.mapControlButton,
                pressed ? nearbyDonorsMapStyles.mapControlButtonPressed : null,
              ]}
              onPress={() => void handleRecenter()}
            >
              <Crosshair color={colors.foreground} size={20} strokeWidth={2.25} />
            </Pressable>

            <Pressable
              accessibilityLabel={
                mapMode === 'satellite' ? 'Switch to street map' : 'Switch to satellite map'
              }
              accessibilityRole="button"
              style={({ pressed }) => [
                nearbyDonorsMapStyles.mapControlButton,
                pressed ? nearbyDonorsMapStyles.mapControlButtonPressed : null,
              ]}
              onPress={() =>
                setMapMode((current) => (current === 'satellite' ? 'standard' : 'satellite'))
              }
            >
              {mapMode === 'satellite' ? (
                <MapIcon color={colors.foreground} size={20} strokeWidth={2.25} />
              ) : (
                <Satellite color={colors.foreground} size={20} strokeWidth={2.25} />
              )}
            </Pressable>
          </View>
        </>
      ) : null}

      <View
        pointerEvents="box-none"
        style={[
          nearbyDonorsMapStyles.bottomOverlay,
          { bottom: 12 + Math.max(bottomInset, 4) },
        ]}
      >
          {locationBlocked ? (
            <View style={nearbyDonorsMapStyles.permissionBanner}>
              <Text style={nearbyDonorsMapStyles.permissionText}>{locationMessage}</Text>
              <PrimaryButton
                title="Enable location"
                variant="secondary"
                onPress={() => void requestLocation()}
              />
            </View>
          ) : null}

          {error ? (
            <View style={nearbyDonorsMapStyles.permissionBanner}>
              <Text style={nearbyDonorsMapStyles.errorText}>{error}</Text>
              <PrimaryButton title="Try again" onPress={() => void handleRefresh()} />
            </View>
          ) : null}

          {selectedDonor ? (
            <View style={nearbyDonorsMapStyles.detailCard}>
              <Pressable
                accessibilityLabel="Dismiss selected donor"
                accessibilityRole="button"
                style={nearbyDonorsMapStyles.detailClose}
                onPress={() => setSelectedDonorId(null)}
              >
                <X color={colors.muted} size={18} strokeWidth={2.25} />
              </Pressable>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <View
                  style={{
                    backgroundColor: colors.primary,
                    borderRadius: 999,
                    paddingHorizontal: 10,
                    paddingVertical: 3,
                  }}
                >
                  <Text
                    style={{
                      color: colors.primaryForeground,
                      fontSize: 13,
                      fontWeight: '800',
                    }}
                  >
                    {selectedDonor.bloodType}
                  </Text>
                </View>

                <Text style={nearbyDonorsMapStyles.detailEyebrow}>
                  {selectedDonor.isAvailable ? 'Available donor' : 'Nearby donor'}
                </Text>
              </View>

              <Text numberOfLines={2} style={nearbyDonorsMapStyles.detailTitle}>
                {selectedDonor.fullName}
              </Text>
              <Text style={nearbyDonorsMapStyles.detailMeta}>
                {formatDistance(selectedDonor.distanceMeters)} away
                {selectedDonor.isVerified ? ' · Verified' : ''}
              </Text>

              <View style={nearbyDonorsMapStyles.detailActions}>
                <Pressable
                  accessibilityRole="button"
                  style={nearbyDonorsMapStyles.detailPrimaryButton}
                  onPress={() =>
                    openMapDirections({
                      latitude: selectedDonor.latitude,
                      longitude: selectedDonor.longitude,
                      label: selectedDonor.fullName,
                    })
                  }
                >
                  <Navigation color={colors.primaryForeground} size={18} strokeWidth={2.25} />
                  <Text style={nearbyDonorsMapStyles.detailPrimaryLabel}>Get directions</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  style={nearbyDonorsMapStyles.detailSecondaryButton}
                  onPress={() => openDonorDetail(selectedDonor)}
                >
                  <UserRound color={colors.foreground} size={18} strokeWidth={2.25} />
                  <Text style={nearbyDonorsMapStyles.detailSecondaryLabel}>View profile</Text>
                </Pressable>
              </View>
            </View>
          ) : originCoordinates ? (
            <Pressable
              accessibilityRole="button"
              style={nearbyDonorsMapStyles.summaryCard}
              onPress={() => setListModalVisible(true)}
            >
              <View style={nearbyDonorsMapStyles.summaryRow}>
                <Users color={colors.muted} size={22} strokeWidth={2.25} />
                <View style={nearbyDonorsMapStyles.summaryTextBlock}>
                  <Text style={nearbyDonorsMapStyles.summaryTitle}>
                    {copy.summaryTitle(visibleDonors.length)}
                  </Text>
                  <Text style={nearbyDonorsMapStyles.summaryMeta}>
                    Within {radiusKm} km
                    {bloodTypeFilter ? ` · ${bloodTypeFilter}` : ''}
                  </Text>
                </View>
                <Text
                  style={
                    availableCount > 0
                      ? nearbyDonorsMapStyles.summaryStat
                      : nearbyDonorsMapStyles.summaryStatMuted
                  }
                >
                  {availableCount} available
                </Text>
              </View>
              {visibleDonors.length === 0 && !loading ? (
                <Text style={nearbyDonorsMapStyles.summaryMeta}>
                  {copy.emptyNoResults(radiusKm)}
                </Text>
              ) : (
                <Text style={nearbyDonorsMapStyles.filterLink}>Tap to browse donors</Text>
              )}
            </Pressable>
          ) : null}
        </View>

      <SwipeableBottomSheetModal
        maxHeight="82%"
        visible={listModalVisible}
        onDismiss={() => setListModalVisible(false)}
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 28, gap: 16 }}
      >
        <View style={nearbyDonorsMapStyles.donorSectionHeader}>
          <Text style={nearbyDonorsMapStyles.donorSectionTitle}>{copy.listTitle}</Text>
          <Pressable accessibilityRole="button" onPress={() => setFilterModalVisible(true)}>
            <Text style={nearbyDonorsMapStyles.filterLink}>Filter</Text>
          </Pressable>
        </View>

        {loading && donors.length === 0 ? (
          <Skeleton borderRadius={16} height={160} width="100%" />
        ) : visibleDonors.length === 0 ? (
          <View style={nearbyDonorsMapStyles.emptyCard}>
            <Text style={nearbyDonorsMapStyles.emptyText}>
              {copy.emptyNoResults(radiusKm)}
            </Text>
            <PrimaryButton title="Refresh map" onPress={() => void handleRefresh()} />
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={nearbyDonorsMapStyles.donorList}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {visibleDonors.map((donor) => (
              <NearbyDonorCard
                key={donor.donorId}
                donor={donor}
                selected={selectedDonorId === donor.donorId}
                onPress={() => {
                  setSelectedDonorId(donor.donorId);
                  openDonorDetail(donor);
                }}
                onDirections={() =>
                  openMapDirections({
                    latitude: donor.latitude,
                    longitude: donor.longitude,
                    label: donor.fullName,
                  })
                }
              />
            ))}
          </ScrollView>
        )}
      </SwipeableBottomSheetModal>

      <SwipeableBottomSheetModal
        maxHeight="82%"
        visible={filterModalVisible}
        onDismiss={() => setFilterModalVisible(false)}
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 28, gap: 16 }}
      >
        <Text style={nearbyDonorsMapStyles.donorSectionTitle}>{copy.filterModalTitle}</Text>

        <Text style={nearbyDonorsMapStyles.visibilityCopy}>Blood type</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Pressable
            style={[
              nearbyDonorsMapStyles.chip,
              bloodTypeFilter === null ? nearbyDonorsMapStyles.chipActive : null,
            ]}
            onPress={() => setBloodTypeFilter(null)}
          >
            <Text
              style={[
                nearbyDonorsMapStyles.chipLabel,
                bloodTypeFilter === null ? nearbyDonorsMapStyles.chipLabelActive : null,
              ]}
            >
              All Types
            </Text>
          </Pressable>
          {BLOOD_TYPES.map((bloodType) => (
            <Pressable
              key={bloodType}
              style={[
                nearbyDonorsMapStyles.chip,
                bloodTypeFilter === bloodType ? nearbyDonorsMapStyles.chipActive : null,
              ]}
              onPress={() => setBloodTypeFilter(bloodType)}
            >
              <Text
                style={[
                  nearbyDonorsMapStyles.chipLabel,
                  bloodTypeFilter === bloodType
                    ? nearbyDonorsMapStyles.chipLabelActive
                    : null,
                ]}
              >
                {bloodType}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={nearbyDonorsMapStyles.visibilityRow}>
          <Text style={nearbyDonorsMapStyles.visibilityTitle}>Available only</Text>
          <Switch
            thumbColor={colors.card}
            trackColor={{ false: colors.border, true: colors.success }}
            value={availableOnly}
            onValueChange={setAvailableOnly}
          />
        </View>

        <Text style={nearbyDonorsMapStyles.visibilityCopy}>Search radius</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {RADIUS_OPTIONS.map((option) => (
            <Pressable
              key={option}
              style={[
                nearbyDonorsMapStyles.chip,
                radiusKm === option ? nearbyDonorsMapStyles.chipActive : null,
              ]}
              onPress={() => setRadiusKm(option)}
            >
              <Text
                style={[
                  nearbyDonorsMapStyles.chipLabel,
                  radiusKm === option ? nearbyDonorsMapStyles.chipLabelActive : null,
                ]}
              >
                {option} km
              </Text>
            </Pressable>
          ))}
        </View>

        {showMapVisibilityCard ? (
          <View style={{ gap: 8 }}>
            <View style={nearbyDonorsMapStyles.visibilityRow}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={nearbyDonorsMapStyles.visibilityTitle}>Show me on the map</Text>
                <Text style={nearbyDonorsMapStyles.visibilityCopy}>
                  {copy.visibilityHelper}
                </Text>
              </View>
              <Switch
                disabled={mapVisibilityLoading}
                thumbColor={colors.card}
                trackColor={{ false: colors.border, true: colors.success }}
                value={profile?.visible_on_map ?? false}
                onValueChange={(value) => void handleMapVisibilityToggle(value)}
              />
            </View>
            {mapVisibilityError ? (
              <Text style={nearbyDonorsMapStyles.errorText}>{mapVisibilityError}</Text>
            ) : null}
          </View>
        ) : null}

        <PrimaryButton
          title="Apply filters"
          onPress={() => {
            setFilterModalVisible(false);
          }}
        />
      </SwipeableBottomSheetModal>
    </View>
  );
}
