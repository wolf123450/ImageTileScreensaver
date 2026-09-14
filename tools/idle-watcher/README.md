# Idle Watcher

A standalone companion script for machines where the OS's own idle
timer can't be trusted to trigger a screensaver — typically because
another script or setting is keeping the machine "active" (e.g. a
mouse jiggler used to prevent a lock screen on a shared or kiosk
machine) but a screensaver is still wanted to protect an OLED
display.

`idle_watcher.py` tracks **keyboard input only** — it ignores all
mouse activity, since that's usually exactly what's being simulated by
whatever is keeping the machine "active". After a configurable period
of no real keypresses, it launches Image Tile Screensaver in
`ignoreMouse` mode, where the screensaver itself also ignores mouse
input and can only be dismissed by a keypress (any key by default, or
one specific key via `--dismiss-key`).

Requires Python 3.7+.

## Setup

```bash
cd tools/idle-watcher
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

## Usage

```bash
python idle_watcher.py --executable <path-to-screensaver> [options]
```

| Option | Default | Description |
| --- | --- | --- |
| `--executable` | *(required)* | Path to the screensaver binary (see per-OS notes below) |
| `--idle-seconds` | `300` | Seconds of keyboard inactivity before launching the screensaver |
| `--check-interval` | `5` | How often to check idle time, in seconds |
| `--dismiss-key` | *(none — any key)* | Restrict dismissal to one key, e.g. `Escape` |
| `--extra-arg` | *(none)* | Extra argument to pass through to the screensaver (repeatable) |

## Per-OS executable path

- **Windows**: the installed `.scr`, e.g.
  `C:\Program Files\image-tile-screensaver\ImageTileScreensaver.scr`
- **macOS**: point at the binary *inside* the `.app` bundle, not the
  bundle itself — `open -a` doesn't reliably forward CLI arguments:
  `/Applications/ImageTileScreensaver.app/Contents/MacOS/image-tile-screensaver`
- **Linux**: wherever you extracted/installed the built binary, e.g.
  `/opt/image-tile-screensaver/image-tile-screensaver`

## Running at login

### macOS (launchd)

See [`macos/com.imagetile.idlewatcher.plist.example`](macos/com.imagetile.idlewatcher.plist.example).
Copy it to `~/Library/LaunchAgents/`, edit the paths, then:

```bash
launchctl load ~/Library/LaunchAgents/com.imagetile.idlewatcher.plist
```

**Important:** macOS requires granting **Input Monitoring** permission
(System Settings → Privacy & Security → Input Monitoring) to whichever
`python3` binary runs the script, or the keyboard listener will start
but silently receive no events.

### Windows (Task Scheduler)

Create a task that runs at logon:

```powershell
schtasks /create /tn "ImageTile Idle Watcher" /tr "python C:\path\to\idle_watcher.py --executable ""C:\Program Files\image-tile-screensaver\ImageTileScreensaver.scr""" /sc onlogon
```

### Linux (systemd user service)

```ini
# ~/.config/systemd/user/idle-watcher.service
[Unit]
Description=Image Tile Screensaver idle watcher

[Service]
ExecStart=/usr/bin/python3 /path/to/idle_watcher.py --executable /opt/image-tile-screensaver/image-tile-screensaver
Restart=on-failure

[Install]
WantedBy=default.target
```

```bash
systemctl --user enable --now idle-watcher.service
```

Note: `pynput`'s global keyboard listener needs X11 (or XWayland); on a
pure Wayland session it may not receive events depending on the
compositor.
