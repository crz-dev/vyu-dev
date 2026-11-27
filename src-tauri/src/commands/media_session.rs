// Windows System Media Transport Controls (SMTC) integration.
//
// The session lives on a dedicated MTA thread so WinRT apartment rules never
// leak into Tauri's async command threads. All updates are serialized through
// a channel and guarded by a generation counter so late IPC calls cannot
// overwrite newer metadata.
use serde::{Deserialize, Serialize};
use std::sync::mpsc::{self, Receiver, Sender};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager};

use windows::core::{factory, HSTRING};
use windows::Foundation::{TimeSpan, TypedEventHandler};
use windows::Media::{
    MediaPlaybackStatus, MediaPlaybackType, PlaybackPositionChangeRequestedEventArgs,
    SystemMediaTransportControls, SystemMediaTransportControlsButton,
    SystemMediaTransportControlsButtonPressedEventArgs,
    SystemMediaTransportControlsTimelineProperties,
};
use windows::Storage::StorageFile;
use windows::Storage::Streams::RandomAccessStreamReference;
use windows::Win32::Foundation::HWND;
use windows::Win32::System::WinRT::{
    ISystemMediaTransportControlsInterop, RoInitialize, RoUninitialize, RO_INIT_MULTITHREADED,
};

const SMTC_EVENT: &str = "media:smtc-command";
const TICKS_PER_SECOND: f64 = 10_000_000.0;

pub struct MediaSessionState {
    tx: Mutex<Sender<SessionCommand>>,
}

impl MediaSessionState {
    fn send(&self, command: SessionCommand) -> Result<(), String> {
        self.tx
            .lock()
            .map_err(|e| format!("Media session is unavailable: {e}"))?
            .send(command)
            .map_err(|_| "Media session thread stopped".to_string())
    }
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaSessionUpdate {
    pub session_id: u64,
    pub generation: u64,
    pub title: String,
    pub artist: String,
    pub album: String,
    /// "audio" or "video".
    pub media_type: String,
    pub playing: bool,
    pub position: f64,
    pub duration: f64,
    pub playback_rate: f64,
    pub can_next: bool,
    pub can_previous: bool,
    pub thumbnail_path: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct SmtcCommand {
    command: String,
    position: Option<f64>,
}

enum SessionCommand {
    Update(MediaSessionUpdate),
    Clear { session_id: u64, generation: u64 },
}

struct Session {
    controls: SystemMediaTransportControls,
    session_id: u64,
    last_generation: u64,
    thumbnail_path: Option<String>,
}

/// Starts the media-session worker. Call once during app setup.
pub fn init(app: &AppHandle) {
    let hwnd = app
        .get_webview_window("main")
        .and_then(|window| window.hwnd().ok())
        .map(|hwnd| hwnd.0 as isize);

    let (tx, rx) = mpsc::channel();
    let worker_app = app.clone();
    let spawned = std::thread::Builder::new()
        .name("vyu-media-session".into())
        .spawn(move || run(worker_app, hwnd, rx));

    if let Err(e) = spawned {
        eprintln!("Failed to start media session thread: {e}");
    }

    app.manage(MediaSessionState { tx: Mutex::new(tx) });
}

#[tauri::command]
pub fn update_media_session(
    state: tauri::State<'_, MediaSessionState>,
    update: MediaSessionUpdate,
) -> Result<(), String> {
    state.send(SessionCommand::Update(update))
}

#[tauri::command]
pub fn clear_media_session(
    state: tauri::State<'_, MediaSessionState>,
    session_id: u64,
    generation: u64,
) -> Result<(), String> {
    state.send(SessionCommand::Clear {
        session_id,
        generation,
    })
}

fn run(app: AppHandle, hwnd: Option<isize>, rx: Receiver<SessionCommand>) {
    let initialized = unsafe { RoInitialize(RO_INIT_MULTITHREADED) }.is_ok();
    let mut session: Option<Session> = None;
    let mut failed = false;

    while let Ok(command) = rx.recv() {
        match command {
            SessionCommand::Update(update) => {
                if session.is_none() && !failed {
                    let hwnd = hwnd.or_else(|| {
                        app.get_webview_window("main")
                            .and_then(|window| window.hwnd().ok())
                            .map(|hwnd| hwnd.0 as isize)
                    });
                    match hwnd.map(|hwnd| create_session(&app, hwnd)) {
                        Some(Ok(created)) => session = Some(created),
                        Some(Err(e)) => {
                            failed = true;
                            eprintln!("Media session unavailable: {e}");
                        }
                        None => {
                            failed = true;
                            eprintln!("Media session unavailable: no main window handle");
                        }
                    }
                }

                if let Some(session) = session.as_mut() {
                    if update.session_id < session.session_id {
                        continue;
                    }
                    if update.session_id > session.session_id {
                        session.session_id = update.session_id;
                        session.last_generation = 0;
                    }
                    if update.generation < session.last_generation {
                        continue;
                    }
                    session.last_generation = update.generation;
                    if let Err(e) = apply_update(session, &update) {
                        eprintln!("Failed to update media session: {e}");
                    }
                }
            }
            SessionCommand::Clear {
                session_id,
                generation,
            } => {
                if let Some(session) = session.as_mut() {
                    if session_id < session.session_id {
                        continue;
                    }
                    if session_id > session.session_id {
                        session.session_id = session_id;
                        session.last_generation = 0;
                    }
                    if generation < session.last_generation {
                        continue;
                    }
                    session.last_generation = generation;
                    session.thumbnail_path = None;
                    let _ = session.controls.SetIsEnabled(false);
                    let _ = session
                        .controls
                        .SetPlaybackStatus(MediaPlaybackStatus::Closed);
                    if let Ok(updater) = session.controls.DisplayUpdater() {
                        let _ = updater.ClearAll();
                        let _ = updater.Update();
                    }
                }
            }
        }
    }

    if initialized {
        unsafe { RoUninitialize() };
    }
}

fn create_session(app: &AppHandle, hwnd: isize) -> windows::core::Result<Session> {
    let interop: ISystemMediaTransportControlsInterop =
        factory::<SystemMediaTransportControls, ISystemMediaTransportControlsInterop>()?;
    let controls: SystemMediaTransportControls =
        unsafe { interop.GetForWindow(HWND(hwnd as *mut core::ffi::c_void))? };

    let button_app = app.clone();
    let button_handler = TypedEventHandler::<
        SystemMediaTransportControls,
        SystemMediaTransportControlsButtonPressedEventArgs,
    >::new(move |_, args| {
        let args = args.ok()?;
        let button = args.Button()?;
        let command = if button == SystemMediaTransportControlsButton::Play {
            "play"
        } else if button == SystemMediaTransportControlsButton::Pause {
            "pause"
        } else if button == SystemMediaTransportControlsButton::Next {
            "next"
        } else if button == SystemMediaTransportControlsButton::Previous {
            "previous"
        } else {
            return Ok(());
        };
        let _ = button_app.emit(
            SMTC_EVENT,
            SmtcCommand {
                command: command.into(),
                position: None,
            },
        );
        Ok(())
    });
    controls.ButtonPressed(&button_handler)?;

    let seek_app = app.clone();
    let seek_handler = TypedEventHandler::<
        SystemMediaTransportControls,
        PlaybackPositionChangeRequestedEventArgs,
    >::new(move |_, args| {
        let args = args.ok()?;
        let position = args.RequestedPlaybackPosition()?.Duration as f64 / TICKS_PER_SECOND;
        let _ = seek_app.emit(
            SMTC_EVENT,
            SmtcCommand {
                command: "seek".into(),
                position: Some(position),
            },
        );
        Ok(())
    });
    controls.PlaybackPositionChangeRequested(&seek_handler)?;

    let _ = controls.SetIsEnabled(true);

    Ok(Session {
        controls,
        session_id: 0,
        last_generation: 0,
        thumbnail_path: None,
    })
}

fn apply_update(session: &mut Session, update: &MediaSessionUpdate) -> windows::core::Result<()> {
    let controls = &session.controls;
    controls.SetIsEnabled(true)?;
    controls.SetPlaybackStatus(if update.playing {
        MediaPlaybackStatus::Playing
    } else {
        MediaPlaybackStatus::Paused
    })?;
    controls.SetIsPlayEnabled(true)?;
    controls.SetIsPauseEnabled(true)?;
    controls.SetIsStopEnabled(false)?;
    controls.SetIsNextEnabled(update.can_next)?;
    controls.SetIsPreviousEnabled(update.can_previous)?;
    controls.SetIsFastForwardEnabled(false)?;
    controls.SetIsRewindEnabled(false)?;
    controls.SetIsRecordEnabled(false)?;
    controls.SetIsChannelUpEnabled(false)?;
    controls.SetIsChannelDownEnabled(false)?;
    controls.SetShuffleEnabled(false)?;

    let rate = if update.playback_rate.is_finite() && update.playback_rate > 0.0 {
        update.playback_rate
    } else {
        1.0
    };
    let _ = controls.SetPlaybackRate(rate);

    let updater = controls.DisplayUpdater()?;
    let next_thumbnail = update.thumbnail_path.as_deref();
    let thumbnail_changed = next_thumbnail != session.thumbnail_path.as_deref();
    if thumbnail_changed && next_thumbnail.is_none() {
        // Clear stale artwork before the new metadata is written.
        let _ = updater.ClearAll();
    }

    if update.media_type == "video" {
        updater.SetType(MediaPlaybackType::Video)?;
        let properties = updater.VideoProperties()?;
        properties.SetTitle(&HSTRING::from(update.title.as_str()))?;
        if !update.artist.is_empty() {
            properties.SetSubtitle(&HSTRING::from(update.artist.as_str()))?;
        }
    } else {
        updater.SetType(MediaPlaybackType::Music)?;
        let properties = updater.MusicProperties()?;
        properties.SetTitle(&HSTRING::from(update.title.as_str()))?;
        if !update.artist.is_empty() {
            properties.SetArtist(&HSTRING::from(update.artist.as_str()))?;
        }
        if !update.album.is_empty() {
            properties.SetAlbumTitle(&HSTRING::from(update.album.as_str()))?;
        }
    }

    if let Some(path) = next_thumbnail {
        if thumbnail_changed {
            let _ = apply_thumbnail(&updater, path);
        }
    }
    session.thumbnail_path = update.thumbnail_path.clone();

    updater.Update()?;

    let duration = if update.duration.is_finite() && update.duration > 0.0 {
        update.duration
    } else {
        0.0
    };
    let position = if update.position.is_finite() {
        update.position.clamp(0.0, duration.max(0.0))
    } else {
        0.0
    };
    let timeline = SystemMediaTransportControlsTimelineProperties::new()?;
    timeline.SetStartTime(ticks(0.0))?;
    timeline.SetMinSeekTime(ticks(0.0))?;
    timeline.SetEndTime(ticks(duration))?;
    timeline.SetMaxSeekTime(ticks(duration))?;
    timeline.SetPosition(ticks(position))?;
    controls.UpdateTimelineProperties(&timeline)?;

    Ok(())
}

fn apply_thumbnail(
    updater: &windows::Media::SystemMediaTransportControlsDisplayUpdater,
    path: &str,
) -> windows::core::Result<()> {
    let file = StorageFile::GetFileFromPathAsync(&HSTRING::from(path))?.join()?;
    let stream = RandomAccessStreamReference::CreateFromFile(&file)?;
    updater.SetThumbnail(&stream)
}

fn ticks(seconds: f64) -> TimeSpan {
    TimeSpan {
        Duration: (seconds.max(0.0) * TICKS_PER_SECOND).round() as i64,
    }
}
