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
| macOS | `SlideAgent-1.0.0-mac-x64.dmg` | Applications’a sürükle-bırak kurulum |
| macOS | `SlideAgent-1.0.0-mac.zip` | `.app` arşivi |
| Windows | `SlideAgent Setup 1.0.0.exe` | NSIS kurucu; masaüstü + Start Menu kısayolu |
| Windows | `SlideAgent-1.0.0-win.zip` | Kurucusuz klasör (içinde `SlideAgent.exe`) |
| Linux | `SlideAgent-1.0.0.AppImage` | Çalıştırılabilir tek dosya |
| Linux | `slideagent_1.0.0_amd64.deb` | Debian / Ubuntu paketi |

Sürüm numarası `package.json` içindeki `version` alanından gelir. Mimari, paketleyen bilgisayara göre değişir.

## Kullanıcı olarak kurmak

Sunumu **PowerPoint** veya **LibreOffice Impress** ile aç, slayt gösterisini başlat, sonra SlideAgent’ta **Dinle** anahtarını aç. Mikrofon iznini ver.

### macOS

1. `release/SlideAgent-1.0.0-mac-x64.dmg` dosyasını aç.
2. **SlideAgent** uygulamasını **Applications** klasörüne sürükle.
3. İlk açılışta Gatekeeper “tanınmayan geliştirici” diyebilir: **Sistem Ayarları → Gizlilik ve Güvenlik → Yine de Aç**.
4. Mikrofon izni isteyecek. AppleScript / erişilebilirlik izni, klavye yedek yolu için gerekebilir.

Paket imzasızdır (Developer ID yok).

### Windows

1. `SlideAgent Setup 1.0.0.exe` çalıştır, kurulum sihirbazını bitir.
2. Masaüstünde ve Başlat menüsünde **SlideAgent** kısayolu oluşur.
3. Alternatif: `SlideAgent-1.0.0-win.zip` dosyasını açıp `SlideAgent.exe` çalıştır.

SmartScreen uyarı verebilir; yerel derleme olduğu için imza yoktur. PowerPoint’in açık olması COM yolu için yeterlidir.

### Linux

- **AppImage:** `chmod +x SlideAgent-1.0.0.AppImage && ./SlideAgent-1.0.0.AppImage`
- **deb:** `sudo dpkg -i slideagent_1.0.0_amd64.deb` (gerekirse `sudo apt -f install`)

LibreOffice UNO için Impress’i şöyle açmak en temiz yoldur:

```bash
soffice --accept="socket,host=127.0.0.1,port=2002;urp;"
```

Klavye yedeği için [xdotool](https://github.com/jordansissel/xdotool) (MIT) önerilir: `sudo apt install xdotool`.

## Ses tanıma

İki MIT / Apache-2 uyumlu yol vardır; **Otomatik** ikisini sırayla dener:

1. **Web Speech API** — [Sosial Video](https://github.com/nordlyse/sosial-video) içindeki `speechLog` aracı. Chrome / Edge üzerinde hızlıdır. Electron’da genelde yoktur.
2. **Whisper tiny** — `@huggingface/transformers` (Apache-2.0) + OpenAI Whisper (MIT). Çevrimdışı. İlk çalıştırmada model bir kez indirilir (~40 MB, quantize).

Dil menüsünden konuşma dili seçilir (Whisper’a ve Web Speech’e iletilir). **Otomatik** Whisper’ın dili kendisinin tanımasına bırakır. Desteklenen diller:

İngilizce, Norveççe, İsveççe, Türkçe, Çince, Japonca, Danca, Hintçe, Almanca, Hollandaca, İzlandaca, İsviçre Almancası (Schweizerdeutsch), Fransızca, Portekizce, İspanyolca.

Komut çözümleyici tüm bu dillerdeki “ileri / geri / başa / sona / 15. slayt” karşılıklarını aynı anda anlar; seçilen dil yalnızca ses tanımaya ipucu verir.

Komut sayılmazsa slayt değişmez: “bu slaytta ileri teknoloji…” gibi cümleler yok sayılır.

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
| `@huggingface/transformers` | Apache-2.0 | Whisper tiny (çevrimdışı STT) |
| OpenAI Whisper ağırlıkları | MIT | Dil modeli |
| Web Speech API (Sosial Video deseni) | tarayıcı API’si | Hızlı STT |
| xdotool (isteğe bağlı, Linux) | MIT | Klavye yedeği |

PowerPoint COM, AppleScript ve LibreOffice UNO, zaten kurulu ofis uygulamasının API’sidir; bu repoya gömülmez.

Ayrıntı: [THIRD_PARTY.md](THIRD_PARTY.md).
