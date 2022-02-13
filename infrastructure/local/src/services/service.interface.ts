export interface Service {
  init?: () => Promise<void>;
  destroy?: () => Promise<void>;
}
