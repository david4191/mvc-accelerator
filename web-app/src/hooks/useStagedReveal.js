import { useState, useEffect, useRef } from 'react';

const STEP_MS = 420;

// Reveals `totalStages` items one at a time while `enabled`, so a freshly
// generated response can "unlock" piece by piece instead of appearing all
// at once. When `enabled` is false (loaded-from-history / already-revealed
// entries), everything is visible immediately.
export default function useStagedReveal(totalStages, enabled, onDone) {
  const [visibleCount, setVisibleCount] = useState(enabled ? 0 : totalStages);
  const doneRef = useRef(false);

  useEffect(() => {
    if (!enabled) {
      setVisibleCount(totalStages);
      return;
    }

    doneRef.current = false;
    setVisibleCount(0);

    if (totalStages <= 0) {
      if (!doneRef.current) {
        doneRef.current = true;
        onDone && onDone();
      }
      return;
    }

    let cancelled = false;
    let count = 0;

    const tick = () => {
      if (cancelled) return;
      count += 1;
      setVisibleCount(count);
      if (count >= totalStages) {
        if (!doneRef.current) {
          doneRef.current = true;
          onDone && onDone();
        }
        return;
      }
      timer = setTimeout(tick, STEP_MS);
    };

    let timer = setTimeout(tick, STEP_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, totalStages]);

  return visibleCount;
}
