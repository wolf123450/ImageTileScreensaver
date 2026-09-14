#!/usr/bin/env python3
"""
Launches Image Tile Screensaver after a period of real user inactivity,
for machines where the OS's own idle timer is defeated by an
activity-simulating script (e.g. a mouse jiggler that keeps the display
from locking).

Only keyboard input counts as activity here — mouse movement and clicks
are ignored entirely, both for resetting the idle timer and for
dismissing the screensaver once it's shown (the screensaver itself is
launched with ignoreMouse, so only a keypress closes it).

Requires: pip install -r requirements.txt

Usage:
    python idle_watcher.py --executable /path/to/screensaver [options]

Examples:
    # Windows
    python idle_watcher.py --executable "C:\\Program Files\\image-tile-screensaver\\ImageTileScreensaver.scr"

    # macOS (point at the binary inside the .app bundle, not the bundle itself,
    # so command-line arguments pass through cleanly)
    python idle_watcher.py --executable "/Applications/ImageTileScreensaver.app/Contents/MacOS/image-tile-screensaver" --dismiss-key Escape

    # Linux
    python idle_watcher.py --executable /opt/image-tile-screensaver/image-tile-screensaver --idle-seconds 600
"""
import argparse
import subprocess
import sys
import time
from pathlib import Path
from typing import List, Optional

try:
    from pynput import keyboard
except ImportError:
    print(
        "Missing dependency 'pynput'. Install it with:\n"
        "    pip install -r requirements.txt",
        file=sys.stderr,
    )
    sys.exit(1)


class IdleWatcher:
    def __init__(self, executable: str, idle_seconds: float, check_interval: float,
                 dismiss_key: Optional[str], extra_args: List[str]):
        self.executable = executable
        self.idle_seconds = idle_seconds
        self.check_interval = check_interval
        self.dismiss_key = dismiss_key
        self.extra_args = extra_args
        self.last_activity = time.monotonic()
        self.process: Optional[subprocess.Popen] = None

    def on_key_press(self, _key) -> None:
        self.last_activity = time.monotonic()

    def screensaver_args(self) -> List[str]:
        args = [self.executable, "/s", "ignoreMouse"]
        if self.dismiss_key:
            args.append(f"--dismiss-key={self.dismiss_key}")
        args.extend(self.extra_args)
        return args

    def launch_screensaver(self) -> None:
        args = self.screensaver_args()
        print(f"[idle-watcher] Idle for {self.idle_seconds:.0f}s, launching: {' '.join(args)}")
        try:
            self.process = subprocess.Popen(args)
        except OSError as e:
            print(f"[idle-watcher] Failed to launch screensaver: {e}", file=sys.stderr)
            self.process = None

    def screensaver_is_running(self) -> bool:
        if self.process is None:
            return False
        if self.process.poll() is None:
            return True
        # Process exited (dismissed by keypress); the dismiss key press
        # already updated last_activity via the keyboard listener.
        self.process = None
        return False

    def run(self) -> None:
        print(
            f"[idle-watcher] Watching for {self.idle_seconds:.0f}s of keyboard inactivity "
            f"(mouse ignored). Screensaver: {self.executable}"
        )
        listener = keyboard.Listener(on_press=self.on_key_press)
        listener.start()
        try:
            while True:
                time.sleep(self.check_interval)
                if self.screensaver_is_running():
                    continue
                idle_for = time.monotonic() - self.last_activity
                if idle_for >= self.idle_seconds:
                    self.launch_screensaver()
        except KeyboardInterrupt:
            print("\n[idle-watcher] Stopping.")
        finally:
            listener.stop()


def parse_args(argv: List[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--executable", required=True, help="Path to the screensaver executable/binary")
    parser.add_argument("--idle-seconds", type=float, default=300.0,
                         help="Seconds of keyboard inactivity before launching the screensaver (default: 300)")
    parser.add_argument("--check-interval", type=float, default=5.0,
                         help="Seconds between idle checks (default: 5)")
    parser.add_argument("--dismiss-key", default=None,
                         help="Restrict dismissal to a single key (e.g. Escape). Default: any key dismisses")
    parser.add_argument("--extra-arg", action="append", default=[], dest="extra_args",
                         help="Additional argument to pass through to the screensaver (repeatable)")
    return parser.parse_args(argv)


def main() -> None:
    args = parse_args(sys.argv[1:])

    if not Path(args.executable).exists():
        print(f"[idle-watcher] Warning: executable not found at {args.executable!r} "
              f"(will still try to launch it)", file=sys.stderr)

    watcher = IdleWatcher(
        executable=args.executable,
        idle_seconds=args.idle_seconds,
        check_interval=args.check_interval,
        dismiss_key=args.dismiss_key,
        extra_args=args.extra_args,
    )
    watcher.run()


if __name__ == "__main__":
    main()
