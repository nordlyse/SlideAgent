# SlideAgent

Control an open PowerPoint or LibreOffice Impress slideshow **with your voice**.

When the microphone hears “next”, “back”, “go to the start”, “go to the end”, or “go to slide 15”, SlideAgent uses the presentation’s built-in API (or keyboard shortcuts if the API is unavailable).

| Action | Things you can say | PowerPoint | LibreOffice Impress |
|---|---|---|---|
| Next | next, ileri, neste, weiter, siguiente, 下一张, 次へ | `SlideShowView.Next()` | `gotoNextEffect()` |
| Previous | back, geri, forrige, zurück, 上一张 | `Previous()` | `gotoPreviousEffect()` |
| First | first, başa git, første, erste, 第一张 | `First()` | `gotoFirstSlide()` |
| Last | last, sona git, siste, letzte, 最后 | `Last()` | `gotoLastSlide()` |
| Specific slide | go to slide 20, 15. slayta git, gå til lysbilde 15, 第15页 | `GotoSlide(n)` (1-based) | `gotoSlideIndex(n-1)` (0-based) |

On Windows it binds to a running PowerPoint COM object first. On macOS it uses PowerPoint AppleScript. LibreOffice UNO is tried on every platform. If no API is available, slideshow shortcuts are sent (right/left arrow, Home/End, number + Enter).

## Where are the packages?

Installers are **not** in git. `release/` is gitignored; each package is built on the machine that runs the packager.

After packaging, files are in the project-root **`release/`** folder:

| Platform | File | What it is |
|---|---|---|
| macOS | `SlideAgent-1.1.1-mac-x64.dmg` | Drag-and-drop into Applications |
| macOS | `SlideAgent-1.1.1-mac.zip` | `.app` archive |
| Windows | `SlideAgent Setup 1.1.1.exe` | NSIS installer; desktop + Start Menu shortcut |
| Windows | `SlideAgent-1.1.1-win.zip` | Portable folder (`SlideAgent.exe` inside) |
| Linux | `SlideAgent-1.1.1.AppImage` | Single executable |
| Linux | `slideagent_1.1.1_amd64.deb` | Debian / Ubuntu package |

The version number comes from `package.json`. Architecture follows the machine that built the package.

## Install as a user

Closing the window with **X** quits the app completely (no tray / background process).

Open the deck in **PowerPoint** or **LibreOffice Impress**, start the slideshow, then turn **Listen** on in SlideAgent. Speech to Text runs in the SlideAgent window; a separate browser page is not shown.

### macOS

1. Open `release/SlideAgent-1.1.1-mac-x64.dmg`.
2. Drag **SlideAgent** into **Applications**.
3. Gatekeeper may say the developer is unidentified: **System Settings → Privacy & Security → Open Anyway**.
4. It will ask for microphone access. AppleScript / accessibility permission may be needed for the keyboard fallback.

The package is unsigned (no Developer ID).

### Windows

1. Run `SlideAgent Setup 1.1.1.exe` and finish the wizard.
2. A **SlideAgent** shortcut is created on the desktop and in the Start menu.
3. Alternatively unzip `SlideAgent-1.1.1-win.zip` and run `SlideAgent.exe`.

SmartScreen may warn because the build is local and unsigned. PowerPoint must be open for the COM path.

### Linux

- **AppImage:** `chmod +x SlideAgent-1.1.1.AppImage && ./SlideAgent-1.1.1.AppImage`
- **deb:** `sudo dpkg -i slideagent_1.1.1_amd64.deb` (then `sudo apt -f install` if needed)

The cleanest LibreOffice UNO setup is to start Impress like this:

```bash
soffice --accept="socket,host=127.0.0.1,port=2002;urp;"
```

For the keyboard fallback, [xdotool](https://github.com/jordansissel/xdotool) (MIT) is recommended: `sudo apt install xdotool`.

## Speech recognition

K-PrimeApp **Speech to Text** is not Whisper. It is Chrome **`webkitSpeechRecognition`** (Google Web Speech). That engine is fast and works well — but **only in real Chrome / Edge**. Electron Chromium has no Google speech key.

**Default** Speech to Text uses that same Google Web Speech engine, with the UI inside SlideAgent. Chrome runs in the background (off-screen); you do not see a separate page. The macOS microphone menu may still say Chrome, because that process holds the mic. Turning Listen off quits it.

1. **Speech to Text** — default, in the SlideAgent window. Google Chrome or Edge must be installed.
2. **Vosk** — offline fallback if Chrome is missing.

Whisper is no longer an option; it hallucinates short commands.

Pick the spoken language from the language menu (`tr-TR` matches K-PrimeApp Turkish). Supported languages:

English, Norwegian, Swedish, Turkish, Chinese, Japanese, Danish, Hindi, German, Dutch, Icelandic, Swiss German, French, Portuguese, Spanish.

The command parser understands “next / back / first / last / go to slide 15” in all of those languages at once.

Ordinary speech that is not a command does not change the slide: sentences like “this slide shows advanced technology…” are ignored.

Do not use 1.0.0–1.1.0 packages; **1.1.1** is the English UI.

The same commands can be typed in the text box.

## Run as a developer

```bash
git clone <this-repo>
cd SlideAgent
npm install
npm test
npm run desktop
```

`npm run desktop` starts Vite (`http://localhost:5173`) and Electron.

## Rebuild packages

```bash
npm install
npm run dist
```

One platform:

```bash
npm run dist:mac     # DMG + zip
npm run dist:linux   # AppImage + deb
npm run dist:win     # NSIS installer + zip (x64)
```

Config file: `electron-builder.yml`. Output folder: `release/`. Windows `.ico` generation uses `sips` on macOS (`npm run build:ico`).

## Licenses

SlideAgent is **MIT**. Dependencies are MIT or Apache-2.0 only:

| Tool | License | Role |
|---|---|---|
| Electron | MIT | Desktop shell |
| electron-builder | MIT | dmg / nsis / AppImage / deb |
| Vite | MIT | UI bundle |
| `@huggingface/transformers` | Apache-2.0 | Whisper tiny (fallback STT) |
| OpenAI Whisper weights | MIT | Language model (fallback) |
| vosk-browser | Apache-2.0 | Streaming offline STT |
| Vosk language models (Alphacephei) | Apache-2.0 | Downloaded on first listen |
| Web Speech API (K-PrimeApp SpeechToText) | browser API | Primary STT in Chrome/Edge |
| xdotool (optional, Linux) | MIT | Keyboard fallback |

PowerPoint COM, AppleScript, and LibreOffice UNO are APIs of office software the user already installed; they are not bundled in this repo.

Details: [THIRD_PARTY.md](THIRD_PARTY.md).

## Author

|         |                                                     |
| ------- | --------------------------------------------------- |
| First name | Jakob                                               |
| Last name  | Lyse                                                |
| GitHub     | [nordlyse](https://github.com/nordlyse)             |
| Email      | [jakob.lyse@gmail.com](mailto:jakob.lyse@gmail.com) |
