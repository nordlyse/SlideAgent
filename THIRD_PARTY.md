# Third-party licenses

SlideAgent itself is MIT. Runtime and packaging tools used in this repository are MIT or Apache-2.0.

| Package | License | Use |
|---|---|---|
| electron | MIT | Desktop application shell |
| electron-builder | MIT | macOS / Windows / Linux installers |
| vite | MIT | Renderer bundler |
| @huggingface/transformers | Apache-2.0 | Offline speech-to-text fallback (Whisper) |
| onnxruntime-web (transitive) | MIT | ONNX inference for Whisper |
| OpenAI Whisper model weights (Xenova/whisper-tiny) | MIT | Multilingual ASR fallback |
| vosk-browser | Apache-2.0 | Streaming in-app speech recognition |
| Vosk small language models (Alphacephei) | Apache-2.0 | Downloaded on first listen |
| xdotool (optional system package on Linux) | MIT | Keyboard fallback |

The primary speech path is the same Web Speech API as K-PrimeApp `frontend/src/features/IT/SpeechToText.js` (webkitSpeechRecognition in Google Chrome / Edge). Electron cannot host that Google service; an off-screen Chrome helper forwards transcripts to SlideAgent. Vosk and Whisper remain optional offline fallbacks.

Office automation (PowerPoint COM, AppleScript, LibreOffice UNO) talks to software the user already installed. Those applications are not redistributed here.
