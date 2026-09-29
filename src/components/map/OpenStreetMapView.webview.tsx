import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { StyleSheet, Text, View, type DimensionValue } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import { MapStyleToggle } from '@/components/map/MapStyleToggle';
import type {
  OpenStreetMapViewHandle,
  OpenStreetMapViewProps,
} from '@/components/map/types';
import { mapStyles } from '@/components/map/styles';
import { getMapAttribution, type MapViewMode } from '@/constants/mapTiles';
import { buildMapLibreMapHtml } from '@/utils/mapLibreMapHtml';

const DEFAULT_MAP_HEIGHT = 280;

type MapBridgeMessage =
  | { type: 'markerPress'; id: string }
  | { type: 'mapPress' };

/** MapLibre GL JS in a WebView — works in Expo Go without native MapLibre modules. */
export const OpenStreetMapView = forwardRef<OpenStreetMapViewHandle, OpenStreetMapViewProps>(
  function OpenStreetMapViewWebView(
    {
      region,
      markers = [],
      showsUserLocation = false,
      userCoordinates = null,
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
    const webViewRef = useRef<WebView>(null);
    const [internalMapMode, setInternalMapMode] = useState<MapViewMode>('standard');
    const mapMode = mapModeProp ?? internalMapMode;
    const mapHeight = Math.max(height, DEFAULT_MAP_HEIGHT);

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

    useImperativeHandle(ref, () => ({
      zoomIn: () => {
        webViewRef.current?.injectJavaScript('window.__bloodlinkZoom?.(1); true;');
      },
      zoomOut: () => {
        webViewRef.current?.injectJavaScript('window.__bloodlinkZoom?.(-1); true;');
      },
    }));

    const resolvedUserLocation = useMemo(() => {
      if (
        !showsUserLocation ||
        !userCoordinates ||
        !Number.isFinite(userCoordinates.latitude) ||
        !Number.isFinite(userCoordinates.longitude)
      ) {
        return null;
      }

      return {
        latitude: userCoordinates.latitude,
        longitude: userCoordinates.longitude,
      };
    }, [showsUserLocation, userCoordinates]);

    const html = useMemo(
      () =>
        buildMapLibreMapHtml(
          region,
          markers.map((marker) => ({
            id: marker.id,
            latitude: marker.coordinates.latitude,
            longitude: marker.coordinates.longitude,
            title: marker.title,
            description: marker.description,
            pinColor: marker.pinColor,
            selectedPinColor: marker.selectedPinColor,
            bloodType: marker.bloodType,
          })),
          selectedMarkerId,
          mapMode,
          resolvedUserLocation,
        ),
      [mapMode, markers, region, resolvedUserLocation, selectedMarkerId],
    );

    useEffect(() => {
      webViewRef.current?.injectJavaScript(`window.__bloodlinkSetSelectedMarker?.(${JSON.stringify(selectedMarkerId)}); true;`);
    }, [selectedMarkerId]);

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

    const onMessage = (event: WebViewMessageEvent) => {
      try {
        const payload = JSON.parse(event.nativeEvent.data) as MapBridgeMessage;
        if (payload.type === 'markerPress' && payload.id) {
          onMarkerPress?.(payload.id);
          return;
        }
        if (payload.type === 'mapPress') {
          onMapPress?.();
        }
      } catch {
        // Ignore malformed bridge messages.
      }
    };

    return (
      <View pointerEvents="box-none" style={containerStyle}>
        <WebView
          ref={webViewRef}
          key={`${mapMode}-${focusToken}`}
          originWhitelist={['*']}
          source={{ html }}
          style={fillContainer ? styles.mapFill : { height: mapHeight, width: '100%' }}
          onMessage={onMessage}
          javaScriptEnabled
          domStorageEnabled
          setSupportMultipleWindows={false}
          scrollEnabled={false}
          overScrollMode="never"
          allowsInlineMediaPlayback
        />

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
});
