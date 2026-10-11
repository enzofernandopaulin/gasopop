export function getRequest(): Request | undefined {
  if (typeof window === "undefined") return undefined;
  return new Request(window.location.href);
}
