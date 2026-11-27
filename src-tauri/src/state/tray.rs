// System tray icon and localized context menu.
use serde::Deserialize;
use std::sync::Mutex;
use tauri::menu::{Menu, MenuBuilder};
use tauri::tray::{MouseButton, MouseButtonState, TrayIcon, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager};

use crate::state::system::SystemConfig;

pub const TRAY_ID: &str = "vyu-tray";

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrayMenuLabels {
    pub show: String,
    pub hide: String,
    pub play_pause: String,
    pub next: String,
    pub previous: String,
    pub quit: String,
}

#[derive(Default)]
pub struct TrayState {
    icon: Mutex<Option<TrayIcon>>,
    labels: Mutex<Option<TrayMenuLabels>>,
}

fn show_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

fn hide_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.hide();
    }
}

fn build_menu(app: &AppHandle, labels: &TrayMenuLabels) -> tauri::Result<Menu<tauri::Wry>> {
    MenuBuilder::new(app)
        .text("tray-show", &labels.show)
        .text("tray-hide", &labels.hide)
        .separator()
        .text("tray-play-pause", &labels.play_pause)
        .text("tray-next", &labels.next)
        .text("tray-previous", &labels.previous)
        .separator()
        .text("tray-quit", &labels.quit)
        .build()
}

fn lock<T>(mutex: &Mutex<T>) -> std::sync::MutexGuard<'_, T> {
    mutex
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
}

/// Creates or removes the tray icon to match the persisted configuration.
pub fn apply(app: &AppHandle, config: &SystemConfig) {
    let state = app.state::<TrayState>();
    let mut icon = lock(&state.icon);

    if !config.show_tray_icon {
        *icon = None;
        return;
    }

    if icon.is_some() {
        return;
    }

    let default_icon = app
        .default_window_icon()
        .cloned()
        .or_else(|| tauri::image::Image::from_bytes(include_bytes!("../../icons/32x32.png")).ok());
    let Some(default_icon) = default_icon else {
        eprintln!("Tray icon unavailable: no bundled icon");
        return;
    };

    let labels = lock(&state.labels).clone();
    let menu = labels.as_ref().map(|labels| build_menu(app, labels));

    let mut builder = TrayIconBuilder::with_id(TRAY_ID)
        .icon(default_icon)
        .tooltip("Vyu")
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "tray-show" => show_main_window(app),
            "tray-hide" => hide_main_window(app),
            "tray-play-pause" => {
                let _ = app.emit("media:tray-command", "play-pause");
            }
            "tray-next" => {
                let _ = app.emit("media:tray-command", "next");
            }
            "tray-previous" => {
                let _ = app.emit("media:tray-command", "previous");
            }
            "tray-quit" => {
                let _ = app.emit("system:quit-requested", ());
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                show_main_window(tray.app_handle());
            }
        });

    if let Some(Ok(menu)) = menu {
        builder = builder.menu(&menu);
    }

    match builder.build(app) {
        Ok(tray) => *icon = Some(tray),
        Err(e) => eprintln!("Failed to create tray icon: {e}"),
    }
}

/// Stores localized labels and applies them to an existing tray icon.
pub fn set_menu(app: &AppHandle, labels: TrayMenuLabels) {
    let state = app.state::<TrayState>();
    *lock(&state.labels) = Some(labels.clone());

    let mut icon = lock(&state.icon);
    let Some(tray) = icon.as_mut() else {
        return;
    };

    match build_menu(app, &labels) {
        Ok(menu) => {
            if let Err(e) = tray.set_menu(Some(menu)) {
                eprintln!("Failed to update tray menu: {e}");
            }
        }
        Err(e) => eprintln!("Failed to build tray menu: {e}"),
    }
}
