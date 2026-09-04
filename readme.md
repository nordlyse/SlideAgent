# SlideAgent

Açık PowerPoint veya LibreOffice Impress sunumunu **sesinle** yönetir.

Mikrofon “ileri”, “geri”, “başa git”, “sona git”, “15. slayta git” dediğini duyunca, slayt gösterisindeki yerleşik API’yi (yoksa klavye kısayolunu) kullanır.

| İstediğin eylem | Söylenebilecekler | PowerPoint | LibreOffice Impress |
|---|---|---|---|
| İleri | ileri, next, neste, weiter, siguiente, 下一张, 次へ | `SlideShowView.Next()` | `gotoNextEffect()` |
| Geri | geri, previous, forrige, zurück, 上一张 | `Previous()` | `gotoPreviousEffect()` |
| Başa | başa git, first, første, erste, 第一张 | `First()` | `gotoFirstSlide()` |
| Sona | sona git, last, siste, letzte, 最后 | `Last()` | `gotoLastSlide()` |
| Belirli slayt | 15. slayta git, go to slide 20, gå til lysbilde 15, 第15页 | `GotoSlide(n)` (1 tabanlı) | `gotoSlideIndex(n-1)` (0 tabanlı) |

Windows’ta önce çalışan PowerPoint COM nesnesine bağlanır. macOS’ta PowerPoint AppleScript kullanılır. Her platformda LibreOffice UNO denenir. API yoksa slayt gösterisi kısayolları gönderilir (sağ/sol ok, Home/End, numara + Enter).

## Paketler nerede?

Kurulum dosyaları git deposunda **yok**. `.gitignore` içinde `release/` durur; her paketleme makinede yeniden üretilir.

Paketledikten sonra dosyalar proje kökündeki **`release/`** klasöründedir:

| Platform | Dosya | Ne işe yarar |
|---|---|---|
| macOS | `SlideAgent-1.0.4-mac-x64.dmg` | Applications’a sürükle-bırak kurulum |
| macOS | `SlideAgent-1.0.4-mac.zip` | `.app` arşivi |
| Windows | `SlideAgent Setup 1.0.4.exe` | NSIS kurucu; masaüstü + Start Menu kısayolu |
| Windows | `SlideAgent-1.0.4-win.zip` | Kurucusuz klasör (içinde `SlideAgent.exe`) |
| Linux | `SlideAgent-1.0.4.AppImage` | Çalıştırılabilir tek dosya |
| Linux | `slideagent_1.0.4_amd64.deb` | Debian / Ubuntu paketi |

Sürüm numarası `package.json` içindeki `version` alanından gelir. Mimari, paketleyen bilgisayara göre değişir.

## Kullanıcı olarak kurmak

Pencereyi **X** ile kapatmak uygulamayı tamamen kapatır (tepsi / arka plan süreci kalmaz).

Sunumu **PowerPoint** veya **LibreOffice Impress** ile aç, slayt gösterisini başlat, sonra SlideAgent’ta **Dinle** anahtarını aç. Açılan **Chrome** penceresinde mikrofon iznini verin.

### macOS

1. `release/SlideAgent-1.0.4-mac-x64.dmg` dosyasını aç.
2. **SlideAgent** uygulamasını **Applications** klasörüne sürükle.
3. İlk açılışta Gatekeeper “tanınmayan geliştirici” diyebilir: **Sistem Ayarları → Gizlilik ve Güvenlik → Yine de Aç**.
4. Mikrofon izni isteyecek. AppleScript / erişilebilirlik izni, klavye yedek yolu için gerekebilir.

Paket imzasızdır (Developer ID yok).

### Windows

1. `SlideAgent Setup 1.0.4.exe` çalıştır, kurulum sihirbazını bitir.
2. Masaüstünde ve Başlat menüsünde **SlideAgent** kısayolu oluşur.
3. Alternatif: `SlideAgent-1.0.4-win.zip` dosyasını açıp `SlideAgent.exe` çalıştır.

SmartScreen uyarı verebilir; yerel derleme olduğu için imza yoktur. PowerPoint’in açık olması COM yolu için yeterlidir.

### Linux

- **AppImage:** `chmod +x SlideAgent-1.0.4.AppImage && ./SlideAgent-1.0.4.AppImage`
- **deb:** `sudo dpkg -i slideagent_1.0.4_amd64.deb` (gerekirse `sudo apt -f install`)

LibreOffice UNO için Impress’i şöyle açmak en temiz yoldur:

```bash
soffice --accept="socket,host=127.0.0.1,port=2002;urp;"
```

Klavye yedeği için [xdotool](https://github.com/jordansissel/xdotool) (MIT) önerilir: `sudo apt install xdotool`.

## Ses tanıma

K-PrimeApp **Speech to Text** sayfası Whisper değil; Chrome’daki **`webkitSpeechRecognition`** (Google Web Speech). Bu motor milisaniyede ve Türkçe’de iyidir — ama **yalnızca gerçek Chrome / Edge** içinde çalışır. Electron Chromium’unda Google konuşma anahtarı yoktur.

**Otomatik** (varsayılan) Chrome Web Speech’i **komut modunda** çalıştırır: her sözcük bitince tanımayı keser (`continuous: false`). K-PrimeApp not defteri gibi uzun dikte için `continuous: true` kullanır; o mod kısa “geri / başa dön” deyince cümle uydurur (`Yeti`, `Ember…`). Dil varsayılanı `tr-TR`.

1. **K-PrimeApp / Chrome Web Speech** — varsayılan. Google Chrome veya Microsoft Edge gerekir. **Dinle** açılınca küçük bir Chrome penceresi çıkar; mikrofon iznini **o pencerede** verin. Gerekirse kırmızı **Start Recording**’e basın.
2. **Vosk** — Chrome yoksa çevrimdışı yedek.
3. **Whisper tiny** — son yedek. Kısa Türkçe komutlarda zayıftır.

Dil menüsünden konuşma dili seçilir (`tr-TR` K-PrimeApp ile aynı). Desteklenen diller:

İngilizce, Norveççe, İsveççe, Türkçe, Çince, Japonca, Danca, Hintçe, Almanca, Hollandaca, İzlandaca, İsviçre Almancası (Schweizerdeutsch), Fransızca, Portekizce, İspanyolca.

Komut çözümleyici tüm bu dillerdeki “ileri / geri / başa / sona / 15. slayt” karşılıklarını aynı anda anlar.

Komut sayılmazsa slayt değişmez: “bu slaytta ileri teknoloji…” gibi cümleler yok sayılır.

1.0.0–1.0.3 paketlerini kullanmayın; **1.0.4** komut modundaki Chrome tanımadır.

Metin kutusundan da aynı komutlar gönderilebilir.

## Geliştirici olarak çalıştırmak

```bash
git clone <bu-repo>
cd SlideAgent
npm install
npm test
npm run desktop
```

`npm run desktop` Vite’ı (`http://localhost:5173`) ve Electron’u açar.

## Paketleri yeniden üretmek

```bash
npm install
npm run dist
```

Tek platform:

```bash
npm run dist:mac     # DMG + zip
npm run dist:linux   # AppImage + deb
npm run dist:win     # NSIS kurucu + zip (x64)
```

Ayar dosyası: `electron-builder.yml`. Çıktı klasörü: `release/`. Windows `.ico` üretimi macOS’ta `sips` kullanır (`npm run build:ico`).

## Lisanslar

SlideAgent **MIT**. Bağımlılıklar yalnızca MIT veya Apache-2.0:

| Araç | Lisans | Rol |
|---|---|---|
| Electron | MIT | Masaüstü kabuk |
| electron-builder | MIT | dmg / nsis / AppImage / deb |
| Vite | MIT | Arayüz paketi |
| `@huggingface/transformers` | Apache-2.0 | Whisper tiny (yedek STT) |
| OpenAI Whisper ağırlıkları | MIT | Dil modeli (yedek) |
| vosk-browser | Apache-2.0 | Akan çevrimdışı STT |
| Vosk dil modelleri (Alphacephei) | Apache-2.0 | İlk dinlemede indirilir |
| Web Speech API (K-PrimeApp SpeechToText) | tarayıcı API’si | Chrome/Edge’de asıl STT |
| xdotool (isteğe bağlı, Linux) | MIT | Klavye yedeği |

PowerPoint COM, AppleScript ve LibreOffice UNO, zaten kurulu ofis uygulamasının API’sidir; bu repoya gömülmez.

Ayrıntı: [THIRD_PARTY.md](THIRD_PARTY.md).

## Author

|         |                                                     |
| ------- | --------------------------------------------------- |
| First name | Jakob                                               |
| Last name  | Lyse                                                |
| GitHub     | [nordlyse](https://github.com/nordlyse)             |
| Email      | [jakob.lyse@gmail.com](mailto:jakob.lyse@gmail.com) |
