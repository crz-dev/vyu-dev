// Keybind types
export type KeybindContext = "global" | "viewer" | "library" | "pdf";

export type KeybindCategory =
  | "app"
  | "viewer"
  | "file"
  | "editing"
  | "library"
  | "pdf"
  | "slideshow";

export type KeybindBehavior = "tap" | "hold";

export interface KeybindBinding {
  key: string;
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  meta: boolean;
}

export interface KeybindAction {
  id: string;
  label: string;
  description: string;
  category: KeybindCategory;
  context: KeybindContext;
  defaultBinding: KeybindBinding | null;
  allowRepeat: boolean;
  behavior: KeybindBehavior;
}

export type KeybindBindings = Record<string, KeybindBinding | null>;

export interface KeybindConfig {
  version: 1;
  bindings: KeybindBindings;
}
