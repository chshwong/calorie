export function isNativeWebView(): boolean {
  return typeof window !== "undefined" && (window as any).__AVOVIBE_NATIVE__ === true;
}
