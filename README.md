# SafeHop

**Neighborhood safety for travelers.** Chicago, Los Angeles, New York City, Miami ve Seattle'da polise bildirilen olayları (yankesicilik, araçtan hırsızlık, gasp, saldırı vb.) son 6 ay üzerinden mahalle bazında haritada yeşil / sarı / kırmızı gösteren iOS + Android uygulaması.

```
SafeHop/
├── app/                  Expo (React Native) uygulaması — iOS + Android tek kod
│   ├── src/app/          Ekranlar (Expo Router): şehir listesi, harita, "About"
│   ├── src/components/   Harita üstü kategori seçici, lejant, detay paneli
│   ├── src/lib/stats.ts  Renk hesaplama (yoğunluk + şehir içi üçte birlik dilimler)
│   └── src/config.ts     ⚠️ Veri adresi buraya yazılacak (Adım 3)
├── data-pipeline/        Resmi açık veri API'lerinden 6 aylık özetleri üreten script (bağımlılıksız Node)
├── docs/                 GitHub Pages'te yayınlanan sayfalar (gizlilik politikası dahil)
└── .github/workflows/    Her gün veriyi yenileyip GitHub Pages'e koyan otomasyon
```

## Nasıl çalışıyor?

1. **Veri hattı** (`data-pipeline/`) her gün 5 şehrin resmi açık veri API'sine bağlanır, son **180 günü 6 adet 30 günlük döneme** bölerek mahalle × kategori sayılarını çeker, mahalle sınırlarını sadeleştirir ve küçük JSON dosyaları üretir.
2. **GitHub Actions** bu dosyaları ücretsiz olarak **GitHub Pages**'te yayınlar (`https://KULLANICI_ADIN.github.io/SafeHop/data/v1/`).
3. **Uygulama** bu JSON'ları indirir. Her mahalle için *km² başına aylık olay sayısı* hesaplanır ve mahalleler **aynı şehir içinde** üçe bölünür: en düşük üçte bir 🟢, orta 🟡, en yüksek 🔴. Kullanıcı kategori seçerek (ör. sadece "Pickpocketing") haritayı yeniden renklendirebilir, mahalleye dokununca sayılar, 6 aylık trend ve kategori dağılımı açılır.

| Şehir | Kaynak | Bölge birimi | Not |
|---|---|---|---|
| Chicago | Chicago PD – Crimes 2001 to Present | 77 community area | ~1 hafta gecikme |
| Los Angeles | LAPD – NIBRS Offenses | 21 LAPD bölgesi | |
| New York | NYPD Complaint Data (current + historic) | 78 karakol bölgesi, mahalle adlarıyla | Üç ayda bir güncelleniyor |
| Miami | City of Miami PD – Crimes (ArcGIS) | 13 polis mahallesi | **Miami Beach / South Beach dahil değil** |
| Seattle | SPD Crime Data | 58 mahalle (MCPP) | |

Sayılmayanlar: market hırsızlığı (shoplifting), dolandırıcılık, uyuşturucu, trafik suçları ve (verinin işaretlediği yerlerde) aile içi olaylar.

---

## Adım 1 — Bilgisayarına hazırlık (bir kere)

- **Node.js 20 veya üstü**: <https://nodejs.org> (LTS sürümünü kur). Kontrol: `node -v`
- **Telefonuna Expo Go**: App Store / Google Play'den "Expo Go" uygulaması.
- (Sonraki adımlar için) **GitHub hesabı** ve **Expo hesabı** (<https://expo.dev>, ücretsiz).

## Adım 2 — Uygulamayı telefonunda gör (5 dakika)

Terminali bu klasörde aç:

```bash
# 1) Güncel veriyi indir ve uygulamanın içine göm (internet gerekir, ~1 dk)
cd data-pipeline
npm run snapshot

# 2) Uygulamayı başlat
cd ../app
npm install
npx expo start
```

Terminalde çıkan **QR kodunu** iPhone'da kamerayla, Android'de Expo Go içinden okut. Şehir seç → harita açılır.

> `npm run snapshot` veriyi uygulamanın içine kopyalar (`app/assets/data/`). Bu, GitHub kurulumu bitmeden uygulamayı denemeni sağlar ve yayınladığında da internet yokken "yedek" olarak kullanılır.

## Adım 3 — Verinin her gün otomatik güncellenmesi (GitHub Pages)

1. GitHub'da **`SafeHop`** adında yeni bir repo aç. Ücretsiz planda GitHub Pages için repo **public** olmalı (kod herkese görünür olur; gizli kalsın istersen GitHub'ın ücretli planı gerekir).
2. Önce otomasyon dosyasını yerine taşı, sonra bu klasörü o repoya yükle:
   ```bash
   cd ~/Desktop/SafeHop
   mkdir -p .github/workflows && mv _github-workflow/update-data.yml .github/workflows/ && rmdir _github-workflow
   git init && git add . && git commit -m "SafeHop v1"
   git branch -M main
   git remote add origin https://github.com/KULLANICI_ADIN/SafeHop.git
   git push -u origin main
   ```
3. Repo → **Settings → Pages → Build and deployment → Source: "GitHub Actions"** seç.
4. Repo → **Actions → "Update crime data" → Run workflow**. 2–3 dakika sürer.
5. Tarayıcıda kontrol et: `https://KULLANICI_ADIN.github.io/SafeHop/data/v1/index.json` → JSON görmelisin.
6. `app/src/config.ts` dosyasında `YOUR_GITHUB_USERNAME` yerine kendi GitHub kullanıcı adını yaz.

Artık workflow her gün 09:23 UTC'de (İstanbul saatiyle 12:23) çalışır; uygulama yeni sürüm göndermeden güncel veriyi gösterir. Bir şehrin API'si o gün çalışmazsa o şehrin bir önceki verisi korunur.

*(İsteğe bağlı)* API limitlerine takılmamak için <https://data.cityofchicago.org/profile/edit/developer_settings> üzerinden ücretsiz bir Socrata "App Token" alıp repoya **Settings → Secrets and variables → Actions → `SOCRATA_APP_TOKEN`** olarak ekleyebilirsin.

## Adım 4 — Mağazalara yükleme (EAS)

Expo'nun bulut derleme servisi EAS ile Mac'te Xcode / Android Studio kurmana gerek yok.

```bash
cd app
npx eas-cli@latest login
npx eas-cli@latest init
```

`init` bir **project ID** yazdıracak; onu `app/app.config.ts` içindeki `EAS_PROJECT_ID = ''` satırına yapıştır.

**Paket adı:** `com.ertugrulozvardar.safehop` olarak ayarlı (`app/app.config.ts` → `BUNDLE_ID`). Mağazaya ilk yüklemeden önce değiştirebilirsin; sonra değiştirilemez.

### iOS (App Store)

1. App Store Connect → **Apps → +** → yeni uygulama; Bundle ID: `com.ertugrulozvardar.safehop`.
2. Derle ve gönder:
   ```bash
   npx eas-cli@latest build -p ios --profile production
   npx eas-cli@latest submit -p ios --latest
   ```
3. App Store Connect'te doldur:
   - **Privacy Policy URL:** `https://KULLANICI_ADIN.github.io/SafeHop/privacy.html`
   - **App Privacy:** "Data Not Collected"
   - Kategori: *Travel* (veya *Navigation*), ekran görüntüleri, açıklama.

### Android (Google Play)

1. **Google Play Console hesabı** aç (tek seferlik 25 $, kimlik doğrulaması istenir).
   - **Kişisel hesap**: yayına çıkmadan önce **en az 12 test kullanıcısıyla 14 gün kapalı test** zorunlu.
   - **Kurumsal hesap** (D-U-N-S numarası gerekir): bu şart yok.
2. **Google Maps anahtarı** (Android'de harita için şart):
   - Google Cloud Console → yeni proje → **"Maps SDK for Android"**'i etkinleştir → **Credentials → API key** oluştur.
   - Anahtarı kısıtla: *Android apps* → paket adı `com.ertugrulozvardar.safehop` + SHA-1 parmak izleri. SHA-1'leri `npx eas-cli@latest credentials -p android` ve Play Console → *App integrity* sayfasından alırsın.
   - Anahtarı EAS'e ekle:
     ```bash
     npx eas-cli@latest env:create --name GOOGLE_MAPS_ANDROID_API_KEY --value ANAHTARIN --environment production --environment preview --visibility sensitive
     ```
3. Derle:
   ```bash
   npx eas-cli@latest build -p android --profile production
   ```
4. Google Play ilk yüklemeyi **elle** ister: oluşan `.aab` dosyasını Play Console → *Testing → Closed testing* kanalına yükle, test kullanıcılarını ekle. Sonraki sürümlerde `npx eas-cli@latest submit -p android --latest` kullanabilirsin.
5. Play Console formları:
   - **Data safety:** veri toplanmıyor.
   - **Privacy policy:** yukarıdaki URL.
   - **İçerik derecelendirmesi** anketi.
   - **Hedef kitle:** 18+ önerilir.

> Telefonda test için mağazaya girmeden APK: `npx eas-cli@latest build -p android --profile preview`

---

## Geliştirme notları

```bash
cd data-pipeline && npm test          # kategori eşleme + geometri testleri
node build.mjs --cities chicago,miami # sadece bazı şehirler → site/data/v1
cd app && npm run typecheck           # TypeScript kontrolü
```

**Bakım gerektirebilecek noktalar**

- **Los Angeles** veri seti (`k7nn-b2ep`) yıl değişiminde yenisiyle değiştirilebiliyor. Workflow hata verirse `data-pipeline/src/pipeline.mjs` içindeki adresi güncelle.
- **Miami** verisi resmi katalogda listelenmeyen ama herkese açık bir ArcGIS servisinden geliyor; adres değişirse aynı dosyada güncellenir.
- Workflow başarısız olursa GitHub e-posta ile haber verir. Son başarılı veri yayında kalmaya devam eder.

**Yeni şehir eklemek:** `pipeline.mjs` → `CITIES` listesine kaynak API'yi, tarih alanını, mahalle sınırı katmanını ve kategori eşlemesini ekle. Ardından `app/src/config.ts` → `CITY_LIST`'e şehri ekle.

**Önemli:** Uygulama bir güvenlik garantisi değil, bilgilendirme aracıdır. Renkler sadece aynı şehirdeki bölgeleri birbiriyle karşılaştırır. Kalabalık bölgelerde (downtown, gece hayatı) daha çok insan olduğu için daha çok olay bildirilir. Uygulama içindeki "About" ekranı bunları kullanıcıya açıklıyor.
