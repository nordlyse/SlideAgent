# Third-party licenses

SlideAgent itself is MIT. Runtime and packaging tools used in this repository are MIT or Apache-2.0.

| Package | License | Use |
|---|---|---|
| electron | MIT | Desktop application shell |
| electron-builder | MIT | macOS / Windows / Linux installers |
| vite | MIT | Renderer bundler |
| @huggingface/transformers | Apache-2.0 | Offline speech-to-text pipeline |
| onnxruntime-web (transitive) | MIT | ONNX inference for Whisper |
| OpenAI Whisper model weights (Xenova/whisper-tiny) | MIT | Multilingual ASR |
| xdotool (optional system package on Linux) | MIT | Keyboard fallback |

The Web Speech path follows the MIT-licensed Sosial Video `speechLog` helper. It calls the browser Speech Recognition API rather than shipping a third-party recognizer.

Office automation (PowerPoint COM, AppleScript, LibreOffice UNO) talks to software the user already installed. Those applications are not redistributed here.
