export interface AppSettings {
  countdown: boolean;
  sound: boolean;
  vibration: boolean;
  showProgress: boolean;
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  countdown: true,
  sound: false,
  vibration: false,
  showProgress: true,
};
