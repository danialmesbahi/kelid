import type { GeoPoint } from '@kelid/core';
import { API_URL } from '../auth/api';

/**
 * نقشهٔ کلید کاملاً مال خودمان است: دادهٔ آزاد OpenStreetMap در یک فایل PMTiles روی سرور خود کلید (داخل ایران).
 * هیچ سرویس بیرونی، کلید API یا CDN در کار نیست؛ با نت ملی و بی‌اینترنت (با کش دستگاه) هم کار می‌کند.
 * نشانی فایل: VITE_MAP_TILES_URL، وگرنه همان سرور برنامه، وگرنه کنار خود برنامهٔ وب (map/kelid.pmtiles).
 */
const RAW = (import.meta.env.VITE_MAP_TILES_URL as string | undefined) || '';

/** `off` نقشه را کامل خاموش می‌کند (مثلاً تست‌های بی‌WebGL). */
export const mapOff = RAW === 'off';

export function tilesUrl(): string {
  if (RAW && RAW !== 'off') return new URL(RAW, location.href).href;
  if (API_URL && API_URL !== 'demo') return `${API_URL.replace(/\/$/, '')}/map/kelid.pmtiles`;
  return new URL('map/kelid.pmtiles', location.href).href;
}

/** میدان ونک؛ وقتی هنوز نقطه‌ای نداریم نقشه از وسط تهران شروع می‌شود. */
export const DEFAULT_CENTER: GeoPoint = { lat: 35.7575, lng: 51.4098 };

export type Place = { neighborhood: string; street: string; address: string };
export type SearchHit = { title: string; detail: string; point: GeoPoint };
