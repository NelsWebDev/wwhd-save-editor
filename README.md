# WWHD Save Editor

Rename quest logs and switch them between a first and second playthrough (Hero's clothes) in **The Legend of Zelda: The Wind Waker HD** (Wii U / Cemu) `cking.sav` files.

## Requirements

- Python 3.8+
- Tk, for the GUI only. The python.org installers for macOS and Windows include it. Otherwise:
  - macOS (Homebrew): `brew install python-tk`
  - Debian/Ubuntu: `sudo apt install python3-tk`
  - Fedora: `sudo dnf install python3-tkinter`
  - macOS system Python (`/usr/bin/python3`) also works.

No pip packages are needed.

## Usage

### Web app (no install)

Open `web/index.html` in a browser (or the hosted GitHub Pages version), drop in your `cking.sav`, edit, and download the modified file. Everything runs locally in your browser; nothing is uploaded. Only `web/` is needed to host it.

### GUI

```
python3 wwhd_gui.py
```

1. Enter or browse to the folder containing `cking.sav`, then click **Load**.
2. Edit each quest log's name (1-8 printable ASCII characters) and choose its playthrough.
3. Click **Save**, then close and reopen the game.

### Command line

```
python3 wwhd_rename.py path/to/cking.sav -s 2 -n Aryll        # rename Quest Log 2
python3 wwhd_second_quest.py path/to/cking.sav -s 2            # make Quest Log 2 a second quest
python3 wwhd_second_quest.py path/to/cking.sav -s 2 --normal   # revert to a normal quest
```

Add `--list` to either script to just show the current state. Run a script without arguments for interactive prompts.

## Safety

- Before every write, the original is copied to `cking.sav.bak-<timestamp>` next to it.
- Files that fail the size or checksum validation are refused and left untouched.
- Checksums are recalculated after changes.
- Close the game before editing, and keep your own backup of the whole save directory.
- Second quest support sets the clear-count flag only. It has not been tested on every save, so try it on a backup first.

## Files

- `wwhd_save.py` - shared save format logic (all other files need it)
- `wwhd_gui.py` - GUI
- `wwhd_rename.py`, `wwhd_second_quest.py` - command-line tools
- `web/` - browser version (`index.html` + `wwhd-save.js`, a port of `wwhd_save.py`)

Unofficial fan tool, not affiliated with Nintendo.
