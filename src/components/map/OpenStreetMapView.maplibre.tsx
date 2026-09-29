import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { StyleSheet, Text, View, type DimensionValue } from 'react-native';
import {
  Camera,
  Map,
  Marker,
  UserLocation,
  type CameraRef,
  type StyleSpecification,
} from '@maplibre/maplibre-react-native';

import { MapStyleToggle } from '@/components/map/MapStyleToggle';
import type {
  OpenStreetMapViewHandle,
  OpenStreetMapViewProps,
} from '@/components/map/types';
import { mapStyles } from '@/components/map/styles';
import { colors } from '@/constants/theme';
import {
  getMapAttribution,
  getMapLibreStyle,
  regionToZoom,
  type MapViewMode,
} from '@/constants/mapTiles';

const DEFAULT_MAP_HEIGHT = 280;
const MIN_ZOOM = 4;
const MAX_ZOOM = 18;

/** Native MapLibre implementation — only load when MLRNCameraModule is available. */
export const OpenStreetMapView = forwardRef<OpenStreetMapViewHandle, OpenStreetMapViewProps>(
  function OpenStreetMapViewMapLibre(
    {
      region,
      markers = [],
      showsUserLocation = false,
      onMarkerPress,
      onMapPress,
      selectedMarkerId = null,
      height = DEFAULT_MAP_HEIGHT,
      fillContainer = false,
      fullBleed = false,
      focusToken = 0,
      mapMode: mapModeProp,
      onMapModeChange,
      showStyleToggle = true,
      showAttribution = false,
    },
    ref,
  ) {
    const cameraRef = useRef<CameraRef>(null);
    const zoomRef = useRef(regionToZoom(region.latitudeDelta));
    const [internalMapMode, setInternalMapMode] = useState<MapViewMode>('standard');
    const mapMode = mapModeProp ?? internalMapMode;
    const mapHeight = Math.max(height, DEFAULT_MAP_HEIGHT);
    const mapStyle = useMemo(
      () => getMapLibreStyle(mapMode) as string | StyleSpecification,
      [mapMode],
    );

    const setMapMode = (nextMode: MapViewMode) => {
      if (onMapModeChange) {
        onMapModeChange(nextMode);
        return;
      }

      setInternalMapMode(nextMode);
    };

    const toggleMapMode = () => {
      setMapMode(mapMode === 'satellite' ? 'standard' : 'satellite');
    };

    const zoomBy = (delta: number) => {
      const nextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoomRef.current + delta));
      zoomRef.current = nextZoom;
      cameraRef.current?.zoomTo(nextZoom, { duration: 220 });
    };

    useImperativeHandle(ref, () => ({
      zoomIn: () => zoomBy(1),
      zoomOut: () => zoomBy(-1),
    }));

    useEffect(() => {
      const nextZoom = regionToZoom(region.latitudeDelta);
      zoomRef.current = nextZoom;
      cameraRef.current?.easeTo({
        center: [region.longitude, region.latitude],
        zoom: nextZoom,
        duration: 280,
      });
    }, [focusToken, region.latitude, region.longitude, region.latitudeDelta]);

    const containerStyle = useMemo(
      () => [
        mapStyles.mapContainer,
        fullBleed ? mapStyles.mapContainerFullBleed : null,
        fillContainer
          ? StyleSheet.absoluteFill
          : { height: mapHeight, width: '100%' as DimensionValue },
      ],
      [fillContainer, fullBleed, mapHeight],
    );

    return (
      <View pointerEvents="box-none" style={containerStyle}>
        <Map
          attribution={showAttribution}
          compass={false}
          logo={false}
          mapStyle={mapStyle}
          style={fillContainer ? styles.mapFill : { height: mapHeight, width: '100%' }}
          touchPitch={false}
          touchRotate={false}
          onPress={onMapPress}
        >
          <Camera
            ref={cameraRef}
            initialViewState={{
              center: [region.longitude, region.latitude],
              zoom: regionToZoom(region.latitudeDelta),
            }}
            maxZoom={MAX_ZOOM}
            minZoom={MIN_ZOOM}
          />

          {showsUserLocation ? (
            <UserLocation accuracy animated heading minDisplacement={2} />
          ) : null}

          {markers.map((marker) => {
            const isSelected = selectedMarkerId === marker.id;
            const pinColor = isSelected
              ? (marker.selectedPinColor ?? colors.primaryDark)
              : (marker.pinColor ?? colors.muted);

            return (
              <Marker
                key={marker.id}
                id={marker.id}
                lngLat={[marker.coordinates.longitude, marker.coordinates.latitude]}
                onPress={() => onMarkerPress?.(marker.id)}
              >
                <View style={styles.markerContainer}>
                  {isSelected ? (
                    <View style={styles.popupBubble}>
                      <View style={styles.popupHeader}>
                        {marker.bloodType ? (
                          <View style={styles.popupBloodPill}>
                            <Text style={styles.popupBloodText}>{marker.bloodType}</Text>
                          </View>
                        ) : null}
                        <Text numberOfLines={1} style={styles.popupTitle}>
                          {marker.title}
                        </Text>
                      </View>
                      {marker.description ? (
                        <Text numberOfLines={1} style={styles.popupDescription}>
                          {marker.description}
                        </Text>
                      ) : null}
                    </View>
                  ) : null}

                  <View
                    style={[
                      styles.markerBadge,
                      {
                        backgroundColor: pinColor,
                        transform: [{ scale: isSelected ? 1.22 : 1 }],
                      },
                    ]}
                  >
                    <Text style={styles.markerBadgeText}>
                      {marker.bloodType ? marker.bloodType : (marker.title || '')}
                    </Text>
                  </View>
                  <View style={[styles.pinTail, { borderTopColor: pinColor }]} />
                </View>
              </Marker>
            );
          })}
        </Map>

        {showStyleToggle ? (
          <View pointerEvents="box-none" style={mapStyles.styleToggle}>
            <MapStyleToggle mapMode={mapMode} onToggle={toggleMapMode} />
          </View>
        ) : null}

        {showAttribution ? (
          <View pointerEvents="none" style={mapStyles.attributionBar}>
            <Text style={mapStyles.attributionText}>{getMapAttribution(mapMode)}</Text>
          </View>
        ) : null}
      </View>
    );
  },
);

const styles = StyleSheet.create({
  mapFill: {
    ...StyleSheet.absoluteFill,
  },
  markerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerBadge: {
    alignItems: 'center',
    borderColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 2,
    elevation: 4,
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  markerBadgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 14,
  },
  pinTail: {
    borderLeftColor: 'transparent',
    borderLeftWidth: 5,
    borderRightColor: 'transparent',
    borderRightWidth: 5,
    borderTopColor: colors.muted,
    borderTopWidth: 5,
    height: 0,
    marginTop: -1,
    width: 0,
  },
  popupBubble: {
    backgroundColor: '#ffffff',
    borderColor: 'rgba(0, 0, 0, 0.08)',
    borderRadius: 12,
    borderWidth: 1,
    elevation: 6,
    marginBottom: 6,
    maxWidth: 220,
    minWidth: 130,
    paddingHorizontal: 10,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  popupHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  popupBloodPill: {
    backgroundColor: colors.primary,
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  popupBloodText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
  },
  popupTitle: {
    color: '#0f172a',
    flexShrink: 1,
    fontSize: 13,
    fontWeight: '700',
  },
  popupDescription: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
});
