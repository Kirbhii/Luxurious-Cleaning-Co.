import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check, Search } from 'lucide-react';
import { getRegions, getProvinces, getCities, getBarangays } from '../lib/psgc';
import type { PsgcRegion, PsgcProvince, PsgcCity, PsgcBarangay } from '../lib/psgc';

export interface LocationValue {
  regionCode: string;
  region: string;
  provinceCode: string;
  province: string;
  cityCode: string;
  city: string;
  barangay: string;
}

export const EMPTY_LOCATION: LocationValue = {
  regionCode: '',
  region: '',
  provinceCode: '',
  province: '',
  cityCode: '',
  city: '',
  barangay: '',
};

interface LocationSelectProps {
  value: LocationValue;
  onChange: (value: LocationValue) => void;
  required?: boolean;
  /** Match the surrounding form's input background. */
  tone?: 'navy800' | 'navy700';
  /** Inline validation messages. */
  errors?: { city?: string; barangay?: string };
  showBarangay?: boolean;
}

interface Option {
  key: string;
  label: string;
}

/* ─── Searchable dropdown field ─────────────────────────────────────────────
 * Compact combobox: type to filter, panel always opens DOWNWARD (rendered in
 * a body portal so modal scroll containers never clip it), and anything not
 * in the list can still be used via "Use …" so users are never stuck. */

function SearchField({
  label,
  required,
  displayValue,
  placeholder,
  disabled,
  loading,
  options,
  onSelect,
  error,
  inputClass,
}: {
  label: string;
  required?: boolean;
  displayValue: string;
  placeholder: string;
  disabled?: boolean;
  loading?: boolean;
  options: Option[];
  onSelect: (key: string) => void;
  error?: string;
  inputClass: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [pos, setPos] = useState({ left: 0, top: 0, width: 0 });
  const anchorRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  function openPanel() {
    if (disabled || loading) return;
    const rect = anchorRef.current?.getBoundingClientRect();
    if (rect) setPos({ left: rect.left, top: rect.bottom + 4, width: rect.width });
    setQuery('');
    setOpen(true);
  }

  // Close on outside scroll/resize so the floating panel never drifts from
  // its field — but never on scrolls inside the option list itself.
  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (panelRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open ]);

  const q = query.trim().toLowerCase();
  const filtered = q ? options.filter(o => o.label.toLowerCase().includes(q)) : options;
  const exactMatch = q ? options.some(o => o.label.toLowerCase() === q) : true;

  function pick(key: string) {
    onSelect(key);
    setOpen(false);
  }

  return (
    <div>
      <label className="block text-xs text-cream-300 mb-1">
        {label} {required && '*'}
      </label>
      <div ref={anchorRef}>
        <button
          type="button"
          disabled={disabled || loading}
          onClick={openPanel}
          className={`${inputClass} ${error ? 'border-red-400/70' : ''} flex items-center justify-between gap-2 text-left disabled:opacity-50`}
        >
          <span className={`truncate ${displayValue ? 'text-cream-100' : 'text-cream-300/40'}`}>
            {loading ? 'Loading…' : displayValue || placeholder}
          </span>
          <ChevronDown size={13} className="text-cream-300/60 shrink-0" />
        </button>
      </div>
      {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
      {open &&
        createPortal(
          <>
            <div className="fixed inset-0 z-[200]" onClick={() => setOpen(false)} />
            <div
              ref={panelRef}
              className="fixed z-[201] rounded-lg border border-gold-400/25 bg-navy-900 shadow-2xl overflow-hidden"
              style={{ left: pos.left, top: pos.top, width: Math.max(pos.width, 180) }}
            >
              <div className="flex items-center gap-2 px-3 py-2 border-b border-gold-400/10">
                <Search size={13} className="text-cream-300/60 shrink-0" />
                <input
                  autoFocus
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder={`Search ${label.toLowerCase()}…`}
                  className="w-full bg-transparent text-xs text-cream-100 placeholder-cream-300/40 focus:outline-none"
                />
              </div>
              <div className="max-h-44 overflow-y-auto py-1">
                {filtered.map(o => (
                  <button
                    key={o.key}
                    type="button"
                    onClick={() => pick(o.key)}
                    className="w-full flex items-center justify-between gap-2 px-3 py-1.5 text-xs text-cream-200 hover:bg-gold-400/10 hover:text-cream-100 text-left transition-colors"
                  >
                    <span className="truncate">{o.label}</span>
                    {displayValue === o.label && <Check size={13} className="text-gold-400 shrink-0" />}
                  </button>
                ))}
                {filtered.length === 0 && !q && (
                  <div className="px-3 py-2 text-xs text-cream-300/50">Select a parent location first.</div>
                )}
                {q && !exactMatch && (
                  <button
                    type="button"
                    onClick={() => pick(`custom:${query.trim()}`)}
                    className="w-full px-3 py-1.5 text-xs text-left text-gold-400 hover:bg-gold-400/10 transition-colors"
                  >
                    Use “{query.trim()}” anyway
                  </button>
                )}
              </div>
            </div>
          </>,
          document.body
        )}
    </div>
  );
}

function pickName(list: { code: string; name: string }[], code: string): string {
  return list.find(item => item.code === code)?.name ?? '';
}

export default function LocationSelect({
  value,
  onChange,
  required = false,
  tone = 'navy800',
  errors,
  showBarangay = true,
}: LocationSelectProps) {
  const [regions, setRegions] = useState<PsgcRegion[]>([]);
  const [provinces, setProvinces] = useState<PsgcProvince[]>([]);
  const [cities, setCities] = useState<PsgcCity[]>([]);
  const [barangays, setBarangays] = useState<PsgcBarangay[]>([]);
  const [loading, setLoading] = useState({ regions: true, provinces: false, cities: false, barangays: false });
  const [apiDown, setApiDown] = useState(false);

  const bg = tone === 'navy700' ? 'bg-navy-700' : 'bg-navy-800';
  const inputClass =
    `w-full ${bg} border border-gold-400/15 rounded-lg px-3 py-2 text-xs text-cream-100 ` +
    `focus:outline-none focus:border-gold-400/40`;

  // Regions on mount — if this fails, fall back to free-text inputs.
  useEffect(() => {
    let cancelled = false;
    getRegions()
      .then(data => {
        if (!cancelled) setRegions(data);
      })
      .catch(() => {
        if (!cancelled) setApiDown(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(l => ({ ...l, regions: false }));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function handleRegion(key: string) {
    if (key.startsWith('custom:')) {
      const name = key.slice(7);
      onChange({ ...EMPTY_LOCATION, region: name });
      setProvinces([]);
      setCities([]);
      setBarangays([]);
      return;
    }
    const region = pickName(regions, key);
    onChange({ ...EMPTY_LOCATION, regionCode: key, region });
    setProvinces([]);
    setCities([]);
    setBarangays([]);
    if (!key) return;
    setLoading(l => ({ ...l, provinces: true }));
    getProvinces(key)
      .then(async provs => {
        setProvinces(provs);
        // NCR and similar have no provinces — load cities straight from the region.
        if (provs.length === 0) {
          setLoading(l => ({ ...l, cities: true }));
          try {
            setCities(await getCities({ regionCode: key }));
          } finally {
            setLoading(l => ({ ...l, cities: false }));
          }
        }
      })
      .catch(() => setApiDown(true))
      .finally(() => setLoading(l => ({ ...l, provinces: false })));
  }

  function handleProvince(key: string) {
    if (key.startsWith('custom:')) {
      const name = key.slice(7);
      onChange({ ...value, provinceCode: '', province: name, cityCode: '', city: '', barangay: '' });
      setCities([]);
      setBarangays([]);
      return;
    }
    const province = pickName(provinces, key);
    onChange({ ...value, provinceCode: key, province, cityCode: '', city: '', barangay: '' });
    setCities([]);
    setBarangays([]);
    if (!key) return;
    setLoading(l => ({ ...l, cities: true }));
    getCities({ regionCode: value.regionCode, provinceCode: key })
      .then(setCities)
      .catch(() => setApiDown(true))
      .finally(() => setLoading(l => ({ ...l, cities: false })));
  }

  function handleCity(key: string) {
    if (key.startsWith('custom:')) {
      const name = key.slice(7);
      onChange({ ...value, cityCode: '', city: name, barangay: '' });
      setBarangays([]);
      return;
    }
    const city = pickName(cities, key);
    onChange({ ...value, cityCode: key, city, barangay: '' });
    setBarangays([]);
    if (!key) return;
    setLoading(l => ({ ...l, barangays: true }));
    getBarangays(key)
      .then(setBarangays)
      .catch(() => setApiDown(true))
      .finally(() => setLoading(l => ({ ...l, barangays: false })));
  }

  function handleBarangay(key: string) {
    onChange({ ...value, barangay: key.startsWith('custom:') ? key.slice(7) : pickName(barangays, key) });
  }

  // Offline / API failure fallback — plain text inputs so forms keep working.
  if (apiDown) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-cream-300 mb-1">City {required && '*'}</label>
          <input
            required={required}
            type="text"
            value={value.city}
            onChange={e => onChange({ ...value, city: e.target.value })}
            placeholder="San Juan City"
            className={`${inputClass} ${errors?.city ? 'border-red-400/70' : ''}`}
          />
          {errors?.city && <p className="text-red-400 text-xs mt-1">{errors.city}</p>}
        </div>
        {showBarangay && (
          <div>
            <label className="block text-xs text-cream-300 mb-1">Barangay {required && '*'}</label>
            <input
              required={required}
              type="text"
              value={value.barangay}
              onChange={e => onChange({ ...value, barangay: e.target.value })}
              placeholder="Greenhills"
              className={`${inputClass} ${errors?.barangay ? 'border-red-400/70' : ''}`}
            />
            {errors?.barangay && <p className="text-red-400 text-xs mt-1">{errors.barangay}</p>}
          </div>
        )}
      </div>
    );
  }

  const showProvince = provinces.length > 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <SearchField
        label="Region"
        required={required}
        displayValue={value.region}
        placeholder="Select region"
        loading={loading.regions}
        options={regions.map(r => ({ key: r.code, label: `${r.regionName} — ${r.name}` }))}
        onSelect={handleRegion}
        inputClass={inputClass}
      />
      {showProvince && (
        <SearchField
          label="Province"
          required={required}
          displayValue={value.province}
          placeholder="Select province"
          disabled={!value.regionCode}
          loading={loading.provinces}
          options={provinces.map(p => ({ key: p.code, label: p.name }))}
          onSelect={handleProvince}
          inputClass={inputClass}
        />
      )}
      <SearchField
        label="City / Municipality"
        required={required}
        displayValue={value.city}
        placeholder="Select city / municipality"
        disabled={!value.regionCode}
        loading={loading.cities}
        options={cities.map(c => ({ key: c.code, label: c.name }))}
        onSelect={handleCity}
        error={errors?.city}
        inputClass={inputClass}
      />
      {showBarangay && (
        <SearchField
          label="Barangay"
          required={required}
          displayValue={value.barangay}
          placeholder="Select barangay"
          disabled={!value.city}
          loading={loading.barangays}
          options={barangays.map(b => ({ key: b.code, label: b.name }))}
          onSelect={handleBarangay}
          error={errors?.barangay}
          inputClass={inputClass}
        />
      )}
    </div>
  );
}
