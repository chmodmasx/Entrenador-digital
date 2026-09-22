export interface AndroidBridge {
  setTrainingMode?: (enabled: boolean) => void;
  vibrate?: (milliseconds: number) => void;
  getAppVersion?: () => string;
  checkForUpdates?: () => void;
  saveBackup?: (json: string, suggestedName: string) => void;
  openBackup?: () => void;
  finishApp?: () => void;
}

declare global {
  interface Window {
    Android?: AndroidBridge;
  }
}

export function nativeBridge(): AndroidBridge | undefined {
  return window.Android;
}

export function setNativeTrainingMode(enabled: boolean): void {
  try {
    nativeBridge()?.setTrainingMode?.(enabled);
  } catch {
    // Native integration is optional in browser preview.
  }
}

export function nativeVibrate(milliseconds: number): boolean {
  try {
    const bridge = nativeBridge();
    if (!bridge?.vibrate) return false;
    bridge.vibrate(milliseconds);
    return true;
  } catch {
    return false;
  }
}

export function getNativeAppVersion(): string | null {
  try {
    return nativeBridge()?.getAppVersion?.() ?? null;
  } catch {
    return null;
  }
}

export function requestNativeUpdateCheck(): boolean {
  try {
    const bridge = nativeBridge();
    if (!bridge?.checkForUpdates) return false;
    bridge.checkForUpdates();
    return true;
  } catch {
    return false;
  }
}
