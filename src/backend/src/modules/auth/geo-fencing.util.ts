import * as net from 'net';

export interface GeoFencingSettings {
  geo_fencing_enabled?: boolean;
  office_latitude?: number | string | null;
  office_longitude?: number | string | null;
  office_radius_meters?: number | string | null;
  allowed_ip_range?: string | null;
  trusted_network_fallback?: string | null;
}

export interface GeoFencingEvaluationResult {
  allowed: boolean;
  reason?: string;
  message?: string;
}

interface GeoFencingEvaluationInput {
  settings?: GeoFencingSettings | null;
  requestHeaders?: Record<string, string | string[] | undefined>;
  remoteIp?: string;
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function normalizeHeaderValue(headers: Record<string, string | string[] | undefined> | undefined, names: string[]): string | null {
  if (!headers) return null;

  for (const name of names) {
    const value = headers[name] ?? headers[name.toLowerCase()];
    if (Array.isArray(value)) {
      const first = value.find(Boolean);
      if (typeof first === 'string' && first.trim()) return first.trim();
      continue;
    }

    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

function extractLocation(headers?: Record<string, string | string[] | undefined>) {
  const latitude = toNumber(normalizeHeaderValue(headers, ['x-location-latitude', 'x-latitude']));
  const longitude = toNumber(normalizeHeaderValue(headers, ['x-location-longitude', 'x-longitude']));

  if (latitude === null || longitude === null) {
    return null;
  }

  return { latitude, longitude };
}

function extractRemoteIp(headers: Record<string, string | string[] | undefined> | undefined, remoteIp: string | undefined) {
  const forwarded = normalizeHeaderValue(headers, ['x-forwarded-for', 'cf-connecting-ip', 'x-real-ip', 'x-client-ip']);
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  return remoteIp?.trim() || null;
}

function haversineDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const earthRadiusMeters = 6371000;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;
  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function ipv4ToLong(ip: string) {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;

  let value = 0;
  for (const part of parts) {
    const num = Number(part);
    if (!Number.isInteger(num) || num < 0 || num > 255) {
      return null;
    }
    value = (value << 8) + num;
  }

  return value >>> 0;
}

function isIpInCidr(ip: string, cidr: string) {
  if (!net.isIP(ip) || !cidr.includes('/')) {
    return false;
  }

  const [base, prefix] = cidr.split('/');
  const prefixValue = Number(prefix);
  if (!net.isIP(base) || !Number.isInteger(prefixValue) || prefixValue < 0 || prefixValue > 32) {
    return false;
  }

  if (net.isIPv6(ip) || net.isIPv6(base)) {
    return false;
  }

  const ipLong = ipv4ToLong(ip);
  const baseLong = ipv4ToLong(base);
  if (ipLong === null || baseLong === null) {
    return false;
  }

  const mask = prefixValue === 0 ? 0 : ((0xffffffff << (32 - prefixValue)) >>> 0);
  return (ipLong & mask) === (baseLong & mask);
}

function isIpAllowed(ip: string | null, settings: GeoFencingSettings) {
  if (!ip) return false;

  const allowedRanges = [settings.allowed_ip_range, settings.trusted_network_fallback].filter(Boolean) as string[];
  return allowedRanges.some((range) => {
    if (!range) return false;
    if (range.includes('/')) {
      return isIpInCidr(ip, range);
    }

    return ip === range;
  });
}

export function evaluateGeoFencingPolicy(input: GeoFencingEvaluationInput): GeoFencingEvaluationResult {
  const settings = input.settings || {};
  const enabled = Boolean(settings.geo_fencing_enabled);

  if (!enabled) {
    return { allowed: true, reason: 'disabled' };
  }

  const officeLatitude = toNumber(settings.office_latitude);
  const officeLongitude = toNumber(settings.office_longitude);
  const officeRadiusMeters = toNumber(settings.office_radius_meters);

  if (officeLatitude === null || officeLongitude === null || officeRadiusMeters === null || officeRadiusMeters <= 0) {
    return {
      allowed: false,
      reason: 'incomplete-configuration',
      message: 'Access denied: geo fencing is enabled but the office perimeter is not fully configured.',
    };
  }

  const location = extractLocation(input.requestHeaders);
  if (location) {
    const distance = haversineDistanceMeters(officeLatitude, officeLongitude, location.latitude, location.longitude);
    if (distance <= officeRadiusMeters) {
      return { allowed: true, reason: 'location-allowed' };
    }

    return {
      allowed: false,
      reason: 'within the office perimeter',
      message: 'Access denied: you must be within the office perimeter.',
    };
  }

  const remoteIp = extractRemoteIp(input.requestHeaders, input.remoteIp);
  if (isIpAllowed(remoteIp, settings)) {
    return { allowed: true, reason: 'ip-allowed' };
  }

  return {
    allowed: false,
    reason: 'location-or-network-unverified',
    message: 'Access denied: location or network access could not be verified. Please allow location access or use an approved office network.',
  };
}
