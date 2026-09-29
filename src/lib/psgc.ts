/**
 * PSGC (Philippine Standard Geographic Code) API client.
 * Free, no API key: https://psgc.gitlab.io/api
 * Regions → Provinces → Cities/Municipalities → Barangays, with in-memory
 * caching and soft failures (empty arrays) so forms can fall back to
 * free-text inputs when offline.
 */

const BASE = 'https://psgc.gitlab.io/api';

export interface PsgcRegion {
  code: string;
  name: string;
  regionName: string;
}

export interface PsgcProvince {
  code: string;
  name: string;
  regionCode: string;
}

export interface PsgcCity {
  code: string;
  name: string;
  regionCode: string;
}

export interface PsgcBarangay {
  code: string;
  name: string;
}

const cache = new Map<string, unknown[]>();

async function get<T>(path: string): Promise<T[]> {
  if (cache.has(path)) return cache.get(path) as T[];
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`PSGC ${res.status}`);
  const data = (await res.json()) as T[];
  cache.set(path, data);
  return data;
}

/** All regions, sorted NCR first (primary service area) then alphabetically. */
export async function getRegions(): Promise<PsgcRegion[]> {
  const regions = await get<PsgcRegion>('/regions/');
  return [...regions].sort((a, b) => {
    if (a.code === '130000000') return -1;
    if (b.code === '130000000') return 1;
    return a.name.localeCompare(b.name);
  });
}

/** Provinces of a region. Empty for NCR (cities sit directly under the region). */
export async function getProvinces(regionCode: string): Promise<PsgcProvince[]> {
  if (!regionCode) return [];
  try {
    const provinces = await get<PsgcProvince>(`/regions/${regionCode}/provinces/`);
    return [...provinces].sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

/** Cities/municipalities of a province — or directly of a region (NCR). */
export async function getCities(args: { regionCode: string; provinceCode?: string }): Promise<PsgcCity[]> {
  const { regionCode, provinceCode } = args;
  if (!regionCode) return [];
  try {
    const path = provinceCode
      ? `/provinces/${provinceCode}/cities-municipalities/`
      : `/regions/${regionCode}/cities-municipalities/`;
    const cities = await get<PsgcCity>(path);
    return [...cities].sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

/** Barangays of a city/municipality. */
export async function getBarangays(cityCode: string): Promise<PsgcBarangay[]> {
  if (!cityCode) return [];
  try {
    const barangays = await get<PsgcBarangay>(`/cities-municipalities/${cityCode}/barangays/`);
    return [...barangays].sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}
