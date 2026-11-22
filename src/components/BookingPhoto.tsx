import { useEffect, useState } from 'react';
import { getBookingPhotoUrl, isStoragePath } from '../lib/supabase';

/** One booking photo.
 *
 *  The stored value is either a legacy https URL (the demo rows) or a path in
 *  the private `booking-photos` bucket. A path has to be exchanged for a
 *  short-lived signed URL first, which is an async round trip — so this renders
 *  a placeholder of the same size until the URL arrives, rather than collapsing
 *  the row and making the whole list jump.
 */
export default function BookingPhoto({
  value,
  alt,
  className = '',
}: {
  value: string;
  alt?: string;
  className?: string;
}) {
  const [url, setUrl] = useState<string | null>(isStoragePath(value) ? null : value);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!isStoragePath(value)) {
      setUrl(value);
      setFailed(false);
      return;
    }

    let cancelled = false;
    setUrl(null);
    setFailed(false);

    (async () => {
      const { url: signed } = await getBookingPhotoUrl(value);
      if (cancelled) return;
      if (signed) setUrl(signed);
      else setFailed(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [value]);

  if (failed) {
    return (
      <div className={`${className} flex items-center justify-center bg-navy-700 text-cream-300/50 text-[10px] text-center`}>
        Photo unavailable
      </div>
    );
  }

  if (!url) {
    return <div className={`${className} bg-navy-700 animate-pulse`} aria-hidden="true" />;
  }

  return <img src={url} alt={alt || 'Booking photo'} className={className} />;
}
