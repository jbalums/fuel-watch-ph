import { useEffect, useMemo, useState } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapPin } from "lucide-react";
import { CARTO_LIGHT_TILE_URL, MANILA_CENTER, OSM_ATTRIBUTION } from "@/lib/leaflet";

type CoordinateStrings = {
  lat: string;
  lng: string;
};

type ExistingStationLocation = {
  lat: number;
  lng: number;
};

interface StationLocationPickerProps {
  value: CoordinateStrings;
  onChange: (coords: CoordinateStrings) => void;
  existingStations?: ExistingStationLocation[];
}

function parseCoordinates(value: CoordinateStrings): [number, number] | null {
  const lat = Number.parseFloat(value.lat);
  const lng = Number.parseFloat(value.lng);

  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;

  return [lat, lng];
}

function formatCoordinate(value: number) {
  return value.toFixed(6);
}

function deriveExistingCenter(stations: ExistingStationLocation[]) {
  if (stations.length === 0) return null;

  const bounds = L.latLngBounds(stations.map((station) => [station.lat, station.lng]));
  const center = bounds.getCenter();
  return [center.lat, center.lng] as [number, number];
}

function MapViewportController({ center }: { center: [number, number] }) {
  const map = useMap();

  useEffect(() => {
    map.setView(center, map.getZoom(), { animate: false });
  }, [center, map]);

  return null;
}

function PickerEvents({
  onPick,
}: {
  onPick: (coords: [number, number]) => void;
}) {
  useMapEvents({
    click(event) {
      onPick([event.latlng.lat, event.latlng.lng]);
    },
  });

  return null;
}

export function StationLocationPicker({
  value,
  onChange,
  existingStations = [],
}: StationLocationPickerProps) {
  const selectedPosition = useMemo(() => parseCoordinates(value), [value]);
  const existingCenter = useMemo(() => deriveExistingCenter(existingStations), [existingStations]);
  const [viewportCenter, setViewportCenter] = useState<[number, number]>(
    selectedPosition ?? existingCenter ?? MANILA_CENTER,
  );

  useEffect(() => {
    if (selectedPosition) {
      setViewportCenter(selectedPosition);
    }
  }, [selectedPosition]);

  useEffect(() => {
    if (!selectedPosition && existingCenter) {
      setViewportCenter(existingCenter);
    }
  }, [existingCenter, selectedPosition]);

  useEffect(() => {
    if (selectedPosition || existingCenter || !navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setViewportCenter([position.coords.latitude, position.coords.longitude]);
      },
      () => {
        setViewportCenter(MANILA_CENTER);
      },
    );
  }, [existingCenter, selectedPosition]);

  const handlePick = ([lat, lng]: [number, number]) => {
    onChange({
      lat: formatCoordinate(lat),
      lng: formatCoordinate(lng),
    });
  };

  return (
    <div className="rounded-xl border border-border bg-background p-3 md:col-span-2">
      <div className="mb-3 flex items-start gap-2">
        <MapPin className="mt-0.5 h-4 w-4 text-accent" />
        <div>
          <p className="text-sm font-medium text-foreground">Location Picker</p>
          <p className="text-xs text-muted-foreground">
            Click the map or drag the marker to update latitude and longitude.
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border">
        <MapContainer
          center={viewportCenter}
          zoom={13}
          scrollWheelZoom
          className="h-64 w-full"
          style={{ background: "hsl(222 47% 11%)" }}
        >
          <TileLayer attribution={OSM_ATTRIBUTION} url={CARTO_LIGHT_TILE_URL} />
          <MapViewportController center={selectedPosition ?? viewportCenter} />
          <PickerEvents onPick={handlePick} />

          {selectedPosition && (
            <Marker
              position={selectedPosition}
              draggable
              eventHandlers={{
                dragend: (event) => {
                  const marker = event.target as L.Marker;
                  const markerPosition = marker.getLatLng();
                  handlePick([markerPosition.lat, markerPosition.lng]);
                },
              }}
            >
              <Popup>
                <div className="text-sm">
                  <p className="font-medium">Selected coordinates</p>
                  <p>
                    {selectedPosition[0].toFixed(6)}, {selectedPosition[1].toFixed(6)}
                  </p>
                </div>
              </Popup>
            </Marker>
          )}
        </MapContainer>
      </div>

      <p className="mt-2 text-xs text-muted-foreground">
        {selectedPosition
          ? `Selected: ${selectedPosition[0].toFixed(6)}, ${selectedPosition[1].toFixed(6)}`
          : "No valid coordinates selected yet."}
      </p>
    </div>
  );
}
