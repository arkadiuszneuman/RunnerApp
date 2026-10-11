'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { movingTimes, type ActivityStreams } from '@runner/core';
import type * as Leaflet from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { chartColors } from '@/app/charts/chartSetup';
import SegmentedControl, { type SegmentedControlOption } from '../../base/SegmentedControl';
import { formatDuration } from '../format';
import {
  formatMetric,
  metricRamp,
  metricValues,
  rampGradient,
  routePoints,
  routeRuns,
  routeScale,
  stepColor,
  type RouteMetric,
} from './routeSegments';

type L = typeof Leaflet;

const METRIC_OPTIONS: readonly SegmentedControlOption<RouteMetric>[] = [
  { value: 'pace', label: 'Pace', color: chartColors.pace },
  { value: 'hr', label: 'HR', color: chartColors.hr },
  { value: 'alt', label: 'Elevation', color: chartColors.elevation },
  { value: 'cad', label: 'Cadence', color: chartColors.cadence },
];

// OpenStreetMap's own tiles: no API key, used lightly (one user's own activities), attributed.
// They're light; the tile pane is filtered into the app's dark look (see the sx below).
const TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

/** How often a hidden map checks whether its page has gone for good (see PersistentChart). */
const ORPHAN_CHECK_MS = 10_000;
/** The hover readout snaps to the nearest route sample within this many pixels. */
const HOVER_RADIUS_PX = 24;

let leafletPromise: Promise<L> | undefined;
/** Leaflet touches `window` on import, so it's only loaded in the browser. */
function loadLeaflet(): Promise<L> {
  leafletPromise ??= import('leaflet').then((m) => (m.default ?? m) as L);
  return leafletPromise;
}

/**
 * The route of a watch activity on a map, coloured along a sequential ramp by the chosen metric
 * (brighter = faster / higher). Like PersistentChart, the map outlives its page being hidden
 * (cacheComponents keeps recent routes mounted) and is only torn down once it has left the
 * document.
 */
export default function RouteMap({ streams }: Readonly<{ streams: ActivityStreams }>) {
  const options = useMemo(
    () => METRIC_OPTIONS.filter((o) => metricValues(streams, o.value).some((v) => v !== null)),
    [streams]
  );
  const [metric, setMetric] = useState<RouteMetric>(options[0]?.value ?? 'pace');
  const values = useMemo(() => metricValues(streams, metric), [streams, metric]);
  const scale = useMemo(() => routeScale(values), [values]);
  const runs = useMemo(() => routeRuns(streams, metric), [streams, metric]);
  const ramp = useMemo(() => metricRamp(metric), [metric]);
  // The readout shows moving time, like the charts below.
  const moving = useMemo(() => movingTimes(streams.t), [streams]);

  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Leaflet.Map | null>(null);
  const orphanCheckRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const [leaflet, setLeaflet] = useState<L | null>(null);

  // The map itself: created once, kept while the page is only hidden.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    clearInterval(orphanCheckRef.current);
    let cancelled = false;
    if (mapRef.current) {
      // Shown again: the container may have been resized while it was hidden.
      mapRef.current.invalidateSize();
    } else {
      void loadLeaflet().then((L) => {
        if (cancelled || mapRef.current) return;
        const map = L.map(container, {
          preferCanvas: true,
          zoomControl: false,
          // The wheel scrolls the page; one finger pans the map and two zoom it (the page still
          // scrolls beside the map, which doesn't fill the screen).
          scrollWheelZoom: false,
          attributionControl: false,
        });
        L.control.attribution({ prefix: false }).addAttribution(ATTRIBUTION).addTo(map);
        L.tileLayer(TILES, { maxZoom: 19 }).addTo(map);
        const points = routePoints(streams);
        if (points.length > 0) map.fitBounds(L.latLngBounds(points), { padding: [16, 16] });
        mapRef.current = map;
        setLeaflet(L);
      });
    }
    return () => {
      cancelled = true;
      const destroy = () => {
        mapRef.current?.remove();
        mapRef.current = null;
      };
      if (!container.isConnected) return destroy();
      orphanCheckRef.current = setInterval(() => {
        if (!container.isConnected) {
          clearInterval(orphanCheckRef.current);
          destroy();
        }
      }, ORPHAN_CHECK_MS);
    };
    // The route is fitted once; a new activity mounts a new page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The coloured route, redrawn when the metric changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!leaflet || !map) return;
    const L = leaflet;
    const layer = L.layerGroup();
    const all = runs.map((r) => r.points);
    // A dark casing under the line keeps every step of the ramp readable on the basemap.
    L.polyline(all, { color: '#05070b', weight: 7, opacity: 0.7, interactive: false }).addTo(layer);
    for (const run of runs) {
      L.polyline(run.points, {
        color: stepColor(run.step, ramp),
        weight: 4,
        lineCap: 'round',
        lineJoin: 'round',
        interactive: false,
      }).addTo(layer);
    }
    const points = routePoints(streams);
    if (points.length > 0) {
      const dot = (at: Leaflet.LatLngExpression, fill: string) =>
        L.circleMarker(at, {
          radius: 6,
          color: '#05070b',
          weight: 2,
          fillColor: fill,
          fillOpacity: 1,
          interactive: false,
        }).addTo(layer);
      dot(points[0], '#ffffff');
      dot(points[points.length - 1], '#05070b').setStyle({ color: '#ffffff' });
    }
    layer.addTo(map);

    // Hover (or tap) readout: the nearest route sample's time and value.
    const tooltip = L.tooltip({ direction: 'auto', offset: [0, 0], className: 'route-tooltip' });
    const onMove = (e: Leaflet.LeafletMouseEvent) => {
      const { lat, lng, t } = streams;
      if (!lat || !lng) return;
      let best = -1;
      let bestDist = HOVER_RADIUS_PX;
      for (let i = 0; i < t.length; i++) {
        const la = lat[i];
        const lo = lng[i];
        if (la === null || lo === null) continue;
        const dist = map.latLngToContainerPoint([la, lo]).distanceTo(e.containerPoint);
        if (dist < bestDist) {
          bestDist = dist;
          best = i;
        }
      }
      if (best < 0) {
        map.closeTooltip(tooltip);
        return;
      }
      const value = values[best];
      tooltip
        .setLatLng([lat[best]!, lng[best]!])
        .setContent(
          `${formatDuration(moving[best])} · ${value === null ? '—' : formatMetric(metric, value)}`
        );
      if (!map.hasLayer(tooltip)) tooltip.addTo(map);
    };
    const onLeave = () => map.closeTooltip(tooltip);
    map.on('mousemove', onMove);
    map.on('click', onMove);
    map.on('mouseout', onLeave);
    return () => {
      map.off('mousemove', onMove);
      map.off('click', onMove);
      map.off('mouseout', onLeave);
      map.closeTooltip(tooltip);
      layer.remove();
    };
  }, [leaflet, runs, ramp, streams, values, metric, moving]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, height: '100%' }}>
      {options.length > 1 && (
        <SegmentedControl
          value={metric}
          onChange={setMetric}
          options={options}
          aria-label="Colour the route by"
        />
      )}
      <Box
        ref={containerRef}
        role="img"
        aria-label="Map of the route"
        sx={{
          flex: 1,
          minHeight: 0,
          borderRadius: 2,
          overflow: 'hidden',
          bgcolor: '#0e131d',
          '& .leaflet-tile-pane': {
            filter: 'invert(1) hue-rotate(180deg) brightness(0.85) contrast(0.85) saturate(0.4)',
          },
          '& .leaflet-control-attribution': {
            bgcolor: 'rgba(14, 19, 29, 0.7)',
            color: 'text.secondary',
            fontSize: '0.65rem',
            '& a': { color: 'text.secondary' },
          },
          '& .route-tooltip': {
            bgcolor: 'rgba(14, 19, 29, 0.92)',
            color: 'text.primary',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: 1,
            boxShadow: 'none',
            fontVariantNumeric: 'tabular-nums',
            '&::before': { display: 'none' },
          },
        }}
      />
      {scale && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
            {formatMetric(metric, scale.low)}
          </Typography>
          <Box sx={{ flex: 1, height: 6, borderRadius: 3, background: rampGradient(ramp) }} />
          <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
            {formatMetric(metric, scale.high)}
          </Typography>
        </Box>
      )}
    </Box>
  );
}
