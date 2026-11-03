use std::fs;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::{Manager, PhysicalPosition, PhysicalSize, Position, Size};

use crate::constants::WINDOW_STATE_FILE;
use crate::types::SavedWindowState;

pub fn window_state_path(app: &tauri::AppHandle) -> Option<PathBuf> {
    app.path()
        .app_config_dir()
        .ok()
        .map(|dir| dir.join(WINDOW_STATE_FILE))
}

pub fn load_window_state(app: &tauri::AppHandle) -> Option<SavedWindowState> {
    let path = window_state_path(app)?;
    let contents = fs::read_to_string(path).ok()?;
    serde_json::from_str(&contents).ok()
}

pub fn persist_window_state(window: &tauri::WebviewWindow, skip: &Arc<AtomicBool>) {
    if skip.load(Ordering::Relaxed) {
        return;
    }

    let Some(path) = window_state_path(&window.app_handle()) else {
        return;
    };

    let maximized = window.is_maximized().unwrap_or(false);
    let Ok(size) = window.inner_size() else {
        return;
    };

    let (x, y) = if maximized {
        (0, 0)
    } else {
        let Ok(pos) = window.outer_position() else {
            return;
        };
        (pos.x, pos.y)
    };

    let state = SavedWindowState {
        x,
        y,
        width: size.width.max(400),
        height: size.height.max(300),
        maximized,
    };

    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }

    if let Ok(serialized) = serde_json::to_string_pretty(&state) {
        let _ = fs::write(path, serialized);
    }
}

/// Keep the window's top-left on a connected monitor's work area so the
/// title bar stays reachable after monitor layout changes.
fn position_on_monitor(window: &tauri::WebviewWindow, x: i32, y: i32) -> bool {
    const SLACK: i64 = 16;
    let Ok(monitors) = window.available_monitors() else {
        return false;
    };
    monitors.iter().any(|monitor| {
        let area = monitor.work_area();
        let left = area.position.x as i64;
        let top = area.position.y as i64;
        let right = left + area.size.width as i64;
        let bottom = top + area.size.height as i64;
        let wx = x as i64;
        let wy = y as i64;
        wx >= left - SLACK && wx < right + SLACK && wy >= top - SLACK && wy < bottom + SLACK
    })
}

pub fn restore_window_state(window: &tauri::WebviewWindow, skip: &Arc<AtomicBool>) {
    skip.store(true, Ordering::Relaxed);

    let Some(state) = load_window_state(&window.app_handle()) else {
        skip.store(false, Ordering::Relaxed);
        return;
    };

    let position_valid = position_on_monitor(window, state.x, state.y);

    if state.maximized {
        if state.width > 0 && state.height > 0 {
            let _ = window.set_size(Size::Physical(PhysicalSize::new(state.width, state.height)));
        }
        if position_valid {
            let _ =
                window.set_position(Position::Physical(PhysicalPosition::new(state.x, state.y)));
        }
        let _ = window.maximize();
    } else {
        let valid_size = state.width >= 400 && state.height >= 300;

        if valid_size {
            let _ = window.set_size(Size::Physical(PhysicalSize::new(state.width, state.height)));
        }

        if position_valid {
            let _ =
                window.set_position(Position::Physical(PhysicalPosition::new(state.x, state.y)));
        }
    }

    skip.store(false, Ordering::Relaxed);
}
