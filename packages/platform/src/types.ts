export interface PlatformLoginResult {
  code: string;
}

export interface PlatformAuth {
  login(): Promise<PlatformLoginResult>;
}

export interface PlatformStorage {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
}

export interface PlatformNavigation {
  navigateTo(path: string): Promise<void>;
  redirectTo(path: string): Promise<void>;
  switchTab(path: string): Promise<void>;
  reLaunch(path: string): Promise<void>;
}

export interface PlatformShareOptions {
  title: string;
  path: string;
  imageUrl?: string;
}

export interface PlatformShare {
  buildShareMessage(options: PlatformShareOptions): PlatformShareOptions;
}

export interface PlatformAdapter {
  auth: PlatformAuth;
  storage: PlatformStorage;
  navigation: PlatformNavigation;
  share: PlatformShare;
}
