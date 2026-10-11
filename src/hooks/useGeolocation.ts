import { useCallback, useEffect, useState } from "react";

export type GeoStatus =
  | "checking" // reading saved permission state
  | "prompt" // need to explain before asking
  | "asking" // native popup open
  | "granted"
  | "denied"
  | "unsupported"
  | "manual"; // user typed a city/address

export type GeoCoords = { lat: number; lng: number; label?: string };

export type GeoState = {
  coords: GeoCoords | null;
  status: GeoStatus;
  /** True if the browser had already blocked location before this visit. */
  previouslyDenied: boolean;
  request: () => void;
  setManual: (c: GeoCoords) => void;
};

const MANUAL_KEY = "gasopop:manual-location";

export function useGeolocation(): GeoState {
  const [coords, setCoords] = useState<GeoCoords | null>(null);
  const [status, setStatus] = useState<GeoStatus>("checking");
  const [previouslyDenied, setPreviouslyDenied] = useState(false);

  const request = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatus("unsupported");
      return;
    }
    setStatus("asking");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setStatus("granted");
        setPreviouslyDenied(false);
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) setPreviouslyDenied(true);
        setStatus("denied");
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 },
    );
  }, []);

  const setManual = useCallback((c: GeoCoords) => {
    setCoords(c);
    setStatus("manual");
    try {
      localStorage.setItem(MANUAL_KEY, JSON.stringify(c));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatus("unsupported");
      return;
    }
    const restoreManual = () => {
      try {
        const raw = localStorage.getItem(MANUAL_KEY);
        if (raw) {
          setCoords(JSON.parse(raw) as GeoCoords);
          return true;
        }
      } catch {
        /* ignore */
      }
      return false;
    };
    const perms = navigator.permissions;
    if (!perms?.query) {
      setStatus("prompt");
      return;
    }
    perms
      .query({ name: "geolocation" as PermissionName })
      .then((p) => {
        if (p.state === "granted") request();
        else if (p.state === "denied") {
          setPreviouslyDenied(true);
          setStatus(restoreManual() ? "manual" : "denied");
        } else setStatus("prompt");
      })
      .catch(() => setStatus("prompt"));
  }, [request]);

  return { coords, status, previouslyDenied, request, setManual };
}
