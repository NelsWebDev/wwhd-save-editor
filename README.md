# Wind Waker HD Save Editor

A browser-based editor for renaming quest logs and/or switching them between first and second playthroughs (Hero's clothes) in **The Legend of Zelda: The Wind Waker HD** save files (`cking.sav`) for Wii U / Cemu.

**ONLINE DEMO: [wwhd-editor.nels.app](https://wwhd-editor.nels.app/)**

***No registration or repo download required***. 
Just visit the URL, upload your `cking.sav` file, download the new one, backup your old one, and replace with the new one. 


## Use

1. Open [`index.html`](./index.html) in a modern browser.
2. Drop your `cking.sav` file onto the page, or click the file chooser.
3. Edit the names and playthrough settings for the three quest logs. Names must be 1-8 printable ASCII characters. The displayed location is informational.
4. Click **Download edited cking.sav** to save the modified copy.
5. After keeping a backup, replace the save in the game's save folder with the downloaded file. Close the game or emulator before replacing it, then reopen the game.

No installation or packages are required. The editor runs locally in your browser; save data is not uploaded. To host the app, serve `index.html` and `wwhd-save.js` together from the same directory.

## Safety and limitations

- The original file is not changed; edits are downloaded as a separate copy. Keep a backup before replacing your game save. No warranty or support is implied. 
- The editor checks the save's size and checksums before loading, and recalculates checksums for the edited file.
- Second-playthrough support changes the clear-count flag only. It has not been tested with every save, so try it on a backup first.
- This is an unofficial fan tool and is not affiliated with Nintendo.

## Files

- [`index.html`](./index.html) - browser interface and editing workflow.
- [`wwhd-save.js`](./wwhd-save.js) - save parsing, validation, quest-log editing, and checksum logic.
