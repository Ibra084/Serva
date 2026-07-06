const DEMO_COOKIE = "serva_demo";

export function enableDemoSession() {
  document.cookie = `${DEMO_COOKIE}=1; path=/; max-age=86400; samesite=lax`;
}

export function clearDemoSession() {
  document.cookie = `${DEMO_COOKIE}=; path=/; max-age=0`;
}
