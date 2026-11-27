// Panel arayüzü metinleri (İngilizce ve Türkçe). İngilizce referans dildir; eksik anahtar
// İngilizceye düşer. Değerler "{name}" yer tutucuları ve { one, other } çoğul biçimleri alabilir.
// HTML'deki sabit metinler data-i18n, data-i18n-placeholder ve data-i18n-title ile çevrilir.

const LANG_KEY = "cldhub_admin_lang";
export const UI_LANGUAGES = ["en", "tr"];

const GENRES_EN = {
  productivity: "Productivity", utilities: "Utilities", security: "Security", media: "Media", graphics: "Graphics",
  music: "Music", education: "Education", communication: "Communication", developer_tools: "Developer tools",
  finance: "Finance", health: "Health", action: "Action", adventure: "Adventure", arcade: "Arcade", casual: "Casual",
  puzzle: "Puzzle", racing: "Racing", rpg: "Role-playing", simulation: "Simulation", sports: "Sports", strategy: "Strategy",
};
const GENRES_TR = {
  productivity: "Verimlilik", utilities: "Araçlar", security: "Güvenlik", media: "Medya", graphics: "Grafik",
  music: "Müzik", education: "Eğitim", communication: "İletişim", developer_tools: "Geliştirici araçları",
  finance: "Finans", health: "Sağlık", action: "Aksiyon", adventure: "Macera", arcade: "Arcade", casual: "Gündelik",
  puzzle: "Bulmaca", racing: "Yarış", rpg: "Rol yapma", simulation: "Simülasyon", sports: "Spor", strategy: "Strateji",
};

const DICT = {
  en: {
    common: { close: "Close", none: "None", remove: "Remove", add: "Add", cancel: "Cancel", next: "Next", back: "Back",
              delete: "Delete", done: "Done", unpublished_lost: "Your unpublished changes will be lost." },
    theme: { light: "Light", system: "System", dark: "Dark" },
    top: { publish: "Publish", menu: "More" },
    menu: { languages: "Catalog languages", reload: "Reload catalog", export: "Download catalog.json", disconnect: "Disconnect" },
    source: { local: "Local file · {name}" },
    connect: {
      title: "Connect to the catalog",
      text: "The panel reads catalog.json straight from the GitHub repository, and every publish is saved as a commit.",
      owner: "User / organization", repo: "Repository", branch: "Branch", path: "File path", token: "GitHub token",
      toggle: "Show / hide", token_hint_1: "Create a", token_link: "fine-grained token",
      token_hint_2: "with Contents: Read and write for this repository only. The token is never sent to any server; it goes only from this browser to GitHub.",
      remember: "Remember on this device", remember_hint: "(otherwise forgotten when the tab closes)",
      submit: "Connect", or: "or", local: "Open a local catalog.json",
      local_hint: "In local mode nothing is sent to GitHub; download the file when you are done.",
      fill_all: "Fill in all fields.", created_on_publish: "{path} was not found; it will be created on the first publish.",
    },
    list: {
      title: "Apps", search: "Search by name or ID", add: "New app",
      count: { one: "{count} app · languages: {langs}", other: "{count} apps · languages: {langs}" },
      unpublished: { one: "{count} unpublished change", other: "{count} unpublished changes" },
      no_match: "Nothing matches", no_match_text: "Try another search or filter.",
      empty: "The catalog is empty", empty_text: "Add the first app to get started.",
      edit: "Edit {name}", new: "New, not published", changed: "Changed, not published",
      featured: "Featured", hidden: "Hidden", feature: "Feature in the store", unfeature: "Remove from featured",
    },
    filter: { all: "All", any_status: "Any status" },
    status: { upcoming: "Upcoming", released: "Released", archived: "Archived" },
    category: { app: "App", game: "Game", app_plural: "Apps", game_plural: "Games" },
    kind: { auto: "Automatic (from file name)", file: "Single file (portable)", zip: "ZIP (extracted to a folder)",
            inno: "Inno Setup installer", apk: "Android package (APK)" },
    genre: GENRES_EN,
    remove: { title: "Delete “{name}”?", text: "The entry is removed from the catalog. Until you publish, you can undo it by reloading.",
              done: "“{name}” deleted. Publish to apply." },
    reload: { title: "Discard changes?", ok: "Reload", done: "Catalog reloaded." },
    disconnect: { title: "Disconnect?", ok: "Disconnect" },
    editor: {
      tab: { general: "General", texts: "Texts", media: "Media", release: "Release", preview: "Preview" },
      new_title: "New app", save: "Save",
      errors: { one: "Fix {count} field to save.", other: "Fix {count} fields to save." },
      saved: "“{name}” saved. Don't forget to publish.",
      discard_title: "Discard your edits?", discard_text: "The changes you made in this window will be lost.", discard: "Discard",
    },
    field: {
      id: "ID", name: "Name", category: "Type", status: "Status", developer: "Developer",
      featured: "Featured", hidden: "Hidden in the store",
      link_website: "Website", link_privacy: "Privacy policy", link_support: "Support",
      github_repo: "GitHub repository", version: "Version", release_date: "Release date",
    },
    hint: {
      id: "Letters, digits, dashes and underscores.", id_locked: "Installed copies match by this ID, so it can't be changed.",
      featured_hidden: "Only one app can be featured. Hidden apps stay in the catalog but aren't listed (e.g. CLD Hub itself).",
      app_languages: "Languages the app itself is available in.", lang_code: "Code, e.g. de or pt-BR",
      name_translation: "Leave empty to use the default name.",
      pitch: "One sentence shown on store tiles.", changelog: "Shown as “What's new” for this version.",
    },
    section: { visibility: "Visibility", genres: "Genres", age: "Age rating", app_languages: "App languages", links: "Links" },
    texts: {
      source: "{lang}:", name: "Name in {lang}", pitch: "Short pitch", pitch_placeholder: "One-line pitch",
      description: "Description", changelog: "What's new", changelog_placeholder: "- New feature…",
      fallback_note: "Empty fields fall back to {lang} in CLD Hub.",
    },
    media: {
      logo: "Logo", cover: "Cover image", video: "Video", video_url: "Video link", screenshots: "Screenshots",
      logo_rules: "Square PNG, JPG or WebP, at least 256×256. Converted to a 512 px WebP.",
      cover_rules: "16:9, at least 1280 px wide. Cropped and converted to WebP (max 1920×1080).",
      icon_fallback: "Shown when there is no logo or it fails to load:",
      upload: "Upload", replace: "Replace", address: "Address", processing: "Preparing…",
      ready: "Ready: {size}, {kb} KB {type}. It's uploaded when you publish.",
      local_mode: "Uploading needs a GitHub connection. In local mode you can enter addresses.",
      all_languages: "All languages",
      drop: "Drop screenshots here or click to choose",
      drop_rules: "PNG, JPG or WebP · converted to WebP · long edge max 1920 px",
      add_url: "…or add an address (https://… or media/<ID>/…)",
      caption: "Caption (optional)", not_published: "Not published", move_left: "Move left", move_right: "Move right",
      group_off_title: "{lang} uses the shared screenshots",
      group_off_text: "Add a separate set if the screenshots should show the app in this language.",
      group_on: "Use separate screenshots for {lang}",
      group_remove: "Stop using separate screenshots for {lang}",
      group_remove_title: "Remove the {lang} screenshots?", group_remove_text: "Users of this language will see the shared screenshots.",
    },
    release: {
      current: "Current release", none: "No release yet", new: "New release", platforms: "Platforms",
      download_url: "Download link", kind: "Install type", size: "Size (MB)", min_os: "Minimum OS",
      sha_hint: "Filled from the release; CLD Hub verifies the download with it",
      planned: "Planned (no file yet)", history: "Version history", history_empty: "Earlier versions appear here after a new release.",
    },
    wizard: {
      title: "New release", pick: "Release", notes: "Notes", files: "Files", review: "Review",
      no_releases: "No published releases in this repository", prerelease: "Pre-release", current: "Current",
      file_count: { one: "{count} file", other: "{count} files" },
      notes_hint: "Release notes for v{version}. The GitHub release text is filled in for the default language.",
      files_hint: "Files were matched to platforms by name. Check them before you continue.",
      file: "File", no_file: "— No file —", no_files_warning: "No file is selected; users won't be able to download this release.",
      history_note: "v{version} moves to the version history when you save.",
      apply: "Apply", applied: "v{version} applied. Save, then publish.",
    },
    preview: {
      note: "An approximation of how CLD Hub shows the app. Texts missing in the chosen language show the fallback, marked in brackets.",
      tile: "Store tile", detail: "App page", install: "Install", about: "About", whats_new: "What's new",
      no_description: "No description yet.", desktop: "Desktop", phone: "Phone", fallback_title: "Fallback language",
    },
    languages: {
      title: "Catalog languages",
      text: "App texts can be entered in these languages. The first one is the default: CLD Hub shows it when a translation is missing.",
      add_placeholder: "Language code, e.g. de or pt-BR", default: "Default",
      exists: "{lang} is already in the list.", added: "{lang} added. Publish to apply.",
      remove_title: "Remove {lang}?", remove_text: "No app has content in this language yet.",
      remove_text_used: { one: "Its texts and screenshots in {count} app will be deleted too.",
                          other: "Its texts and screenshots in {count} apps will be deleted too." },
    },
    publish: {
      title: "Publish changes", subtitle: "Images and catalog.json go out together in a single commit.",
      commit: "Commit message", ok: "Publish",
      added: "Added: {name}", modified: "Updated: {name}", removed: "Deleted: {name}", languages: "Catalog languages",
      more: { one: "and {count} more change", other: "and {count} more changes" },
      missing: "Missing translations: {langs}",
      uploads: { one: "{count} new image will be uploaded", other: "{count} new images will be uploaded" },
      deletions: { one: "{count} unused image will be deleted", other: "{count} unused images will be deleted" },
      done_title: "Published", done_text: "CLD Hub users will see the changes within a few minutes.", view_commit: "View commit",
    },
    diff: {
      added: "added", removed: "removed", changed: "changed", file: "file",
      screenshots: "Screenshots ({group}): {from} → {to}",
      field: { name: "Name", subtitle: "Short pitch", description: "Description", notes: "What's new", version: "Version",
               date: "Release date", category: "Type", status: "Status", logo: "Logo", cover: "Cover image", video: "Video",
               developer: "Developer", genres: "Genres", age_rating: "Age rating", app_languages: "App languages",
               links: "Links", github_repo: "GitHub repository", icon: "Icon", featured: "Featured", hidden: "Hidden",
               history: "Version history" },
    },
    error: {
      id_required: "ID is required.", id_pattern: "Use only letters, digits, dashes and underscores.",
      id_taken: "This ID is already in use.", name_required: "Name is required.",
      version_required: "A released or archived app needs a version.",
      version_pattern: "No spaces in the version (e.g. 1.2.0, 1.0.1-beta).", date_pattern: "Use the YYYY-MM-DD format.",
      repo_pattern: "Write it as 'owner/repo'.", media_pattern: "Must be an address or a media/<id>/… path.",
      url_invalid: "Not a valid web address.", support_invalid: "Must be a web address or mailto: link.",
      genre_unknown: "Unknown genre: {genre}", lang_pattern: "Not a language code: {lang} (e.g. de, pt-BR)",
      download_url: "{platform} link is not a valid address.", size_negative: "Size can't be negative.",
      sha_pattern: "Must be a 64-character SHA-256 value.", apk_android_only: "APK is for Android only.",
      android_apk_only: "Android can only install an APK.", screenshot_pattern: "Not a valid address or media/ path: {url}",
      downloads_required: "A released or archived app needs at least one download link.",
      wizard_repo: "Enter the GitHub repository first.",
      catalog_json: "catalog.json is not valid JSON: {detail}", catalog_apps: "catalog.json has no 'apps' list.",
      gh_offline: "Couldn't reach GitHub. Check your internet connection.",
      gh_no_push: "This token can't write to the repository (Contents: Read and write is needed).",
      gh_conflict: "The catalog changed somewhere else in the meantime. Reload and try again.",
      gh_401: "The token is invalid or has expired.", gh_403: "Access denied ({detail}).",
      gh_404: "Repository, branch or file not found. Check the details and the token's repository access.",
      gh_422: "GitHub rejected the request ({detail}).", gh_other: "GitHub error: HTTP {status} {detail}",
      image_type: "Choose a PNG, JPG or WebP image.", image_too_big: "The image is larger than {mb} MB.",
      image_unreadable: "The image couldn't be read.", image_too_small: "The image is too small (at least {min}).",
      image_need_id: "Enter a valid ID on the General tab first; file names are based on it.",
    },
  },

  tr: {
    common: { close: "Kapat", none: "Yok", remove: "Kaldır", add: "Ekle", cancel: "Vazgeç", next: "İleri", back: "Geri",
              delete: "Sil", done: "Tamam", unpublished_lost: "Yayınlanmamış değişikliklerin kaybolacak." },
    theme: { light: "Açık", system: "Sistem", dark: "Koyu" },
    top: { publish: "Yayınla", menu: "Diğer" },
    menu: { languages: "Katalog dilleri", reload: "Kataloğu yeniden yükle", export: "catalog.json indir", disconnect: "Bağlantıyı kes" },
    source: { local: "Yerel dosya · {name}" },
    connect: {
      title: "Kataloğa bağlan",
      text: "Panel, catalog.json dosyasını doğrudan GitHub reposundan okur ve her yayın bir commit olarak kaydedilir.",
      owner: "Kullanıcı / organizasyon", repo: "Repo", branch: "Dal (branch)", path: "Dosya yolu", token: "GitHub token",
      toggle: "Göster / gizle", token_hint_1: "Yalnızca bu repo için Contents: Read and write izni olan bir",
      token_link: "fine-grained token",
      token_hint_2: "oluştur. Token hiçbir sunucuya gönderilmez; sadece bu tarayıcıdan GitHub'a iletilir.",
      remember: "Bu cihazda hatırla", remember_hint: "(kapalıysa sekme kapanınca silinir)",
      submit: "Bağlan", or: "veya", local: "Yerel catalog.json aç",
      local_hint: "Yerel modda GitHub'a bir şey gönderilmez; düzenledikten sonra dosyayı indirirsin.",
      fill_all: "Tüm alanları doldur.", created_on_publish: "{path} bulunamadı; ilk yayında oluşturulacak.",
    },
    list: {
      title: "Uygulamalar", search: "Ad veya ID ile ara", add: "Yeni uygulama",
      count: "{count} uygulama · diller: {langs}",
      unpublished: "{count} yayınlanmamış değişiklik",
      no_match: "Eşleşen kayıt yok", no_match_text: "Başka bir arama ya da filtre dene.",
      empty: "Katalog boş", empty_text: "İlk uygulamayı ekleyerek başla.",
      edit: "{name} düzenle", new: "Yeni, yayınlanmadı", changed: "Değişti, yayınlanmadı",
      featured: "Vitrinde", hidden: "Gizli", feature: "Vitrinde öne çıkar", unfeature: "Vitrinden kaldır",
    },
    filter: { all: "Tümü", any_status: "Her durum" },
    status: { upcoming: "Yakında", released: "Yayında", archived: "Arşiv" },
    category: { app: "Uygulama", game: "Oyun", app_plural: "Uygulamalar", game_plural: "Oyunlar" },
    kind: { auto: "Otomatik (dosya adından)", file: "Tek dosya (taşınabilir)", zip: "ZIP (klasöre açılır)",
            inno: "Inno Setup kurulumu", apk: "Android paketi (APK)" },
    genre: GENRES_TR,
    remove: { title: "“{name}” silinsin mi?", text: "Kayıt katalogdan kaldırılır. Yayınlayana kadar yeniden yükleyerek geri alabilirsin.",
              done: "“{name}” silindi. Uygulamak için yayınla." },
    reload: { title: "Değişiklikler atılsın mı?", ok: "Yeniden yükle", done: "Katalog yeniden yüklendi." },
    disconnect: { title: "Bağlantı kesilsin mi?", ok: "Bağlantıyı kes" },
    editor: {
      tab: { general: "Genel", texts: "Metinler", media: "Medya", release: "Sürüm", preview: "Önizleme" },
      new_title: "Yeni uygulama", save: "Kaydet",
      errors: "Kaydetmek için {count} alanı düzelt.",
      saved: "“{name}” kaydedildi. Yayınlamayı unutma.",
      discard_title: "Düzenlemeler atılsın mı?", discard_text: "Bu pencerede yaptığın değişiklikler kaybolacak.", discard: "At",
    },
    field: {
      id: "ID", name: "Ad", category: "Tür", status: "Durum", developer: "Geliştirici",
      featured: "Vitrinde", hidden: "Mağazada gizli",
      link_website: "Web sitesi", link_privacy: "Gizlilik politikası", link_support: "Destek",
      github_repo: "GitHub reposu", version: "Sürüm", release_date: "Çıkış tarihi",
    },
    hint: {
      id: "Harf, rakam, tire ve alt çizgi.", id_locked: "Kurulu uygulamalar bu ID ile eşleştiği için değiştirilemez.",
      featured_hidden: "Vitrinde tek uygulama olur. Gizli uygulamalar katalogda kalır ama listelenmez (ör. CLD Hub'ın kendisi).",
      app_languages: "Uygulamanın kendisinin sunulduğu diller.", lang_code: "Kod, ör. de ya da pt-BR",
      name_translation: "Boş bırakılırsa varsayılan ad kullanılır.",
      pitch: "Mağaza kartlarında görünen tek cümle.", changelog: "Bu sürüm için “Yenilikler” olarak görünür.",
    },
    section: { visibility: "Görünürlük", genres: "Türler", age: "Yaş sınırı", app_languages: "Uygulama dilleri", links: "Bağlantılar" },
    texts: {
      source: "{lang}:", name: "{lang} adı", pitch: "Kısa tanıtım", pitch_placeholder: "Tek cümlelik tanıtım",
      description: "Açıklama", changelog: "Yenilikler", changelog_placeholder: "- Yeni özellik…",
      fallback_note: "Boş alanlar CLD Hub'da {lang} gösterilir.",
    },
    media: {
      logo: "Logo", cover: "Kapak görseli", video: "Video", video_url: "Video bağlantısı", screenshots: "Ekran görüntüleri",
      logo_rules: "Kare PNG, JPG veya WebP, en az 256×256. 512 px WebP'ye çevrilir.",
      cover_rules: "16:9, en az 1280 px genişlik. Kırpılıp WebP'ye çevrilir (en çok 1920×1080).",
      icon_fallback: "Logo yoksa ya da yüklenemezse gösterilecek simge:",
      upload: "Yükle", replace: "Değiştir", address: "Adres", processing: "Hazırlanıyor…",
      ready: "Hazır: {size}, {kb} KB {type}. Yayınlayınca yüklenir.",
      local_mode: "Yükleme için GitHub bağlantısı gerekir. Yerel modda adres girebilirsin.",
      all_languages: "Tüm diller",
      drop: "Ekran görüntülerini buraya bırak ya da seçmek için tıkla",
      drop_rules: "PNG, JPG veya WebP · WebP'ye çevrilir · uzun kenar en çok 1920 px",
      add_url: "…ya da adres ekle (https://… veya media/<ID>/…)",
      caption: "Açıklama (isteğe bağlı)", not_published: "Yayınlanmadı", move_left: "Sola taşı", move_right: "Sağa taşı",
      group_off_title: "{lang} ortak ekran görüntülerini kullanıyor",
      group_off_text: "Ekran görüntüleri uygulamayı bu dilde göstermeliyse ayrı bir set ekle.",
      group_on: "{lang} için ayrı ekran görüntüleri kullan",
      group_remove: "{lang} için ayrı ekran görüntülerini kaldır",
      group_remove_title: "{lang} ekran görüntüleri kaldırılsın mı?", group_remove_text: "Bu dilin kullanıcıları ortak ekran görüntülerini görür.",
    },
    release: {
      current: "Güncel sürüm", none: "Henüz sürüm yok", new: "Yeni sürüm", platforms: "Platformlar",
      download_url: "İndirme bağlantısı", kind: "Kurulum", size: "Boyut (MB)", min_os: "En düşük işletim sistemi",
      sha_hint: "Sürümden doldurulur; CLD Hub indirilen dosyayı bununla doğrular",
      planned: "Planlanıyor (henüz dosya yok)", history: "Sürüm geçmişi", history_empty: "Yeni sürümden sonra önceki sürümler burada görünür.",
    },
    wizard: {
      title: "Yeni sürüm", pick: "Sürüm", notes: "Notlar", files: "Dosyalar", review: "Özet",
      no_releases: "Bu repoda yayınlanmış sürüm yok", prerelease: "Ön sürüm", current: "Güncel",
      file_count: "{count} dosya",
      notes_hint: "v{version} sürüm notları. Varsayılan dile GitHub sürüm metni doldurulur.",
      files_hint: "Dosyalar adlarına göre platformlarla eşleştirildi. Devam etmeden kontrol et.",
      file: "Dosya", no_file: "— Dosya yok —", no_files_warning: "Dosya seçilmedi; kullanıcılar bu sürümü indiremez.",
      history_note: "Kaydedince v{version} sürüm geçmişine taşınır.",
      apply: "Uygula", applied: "v{version} uygulandı. Kaydet, sonra yayınla.",
    },
    preview: {
      note: "CLD Hub'daki görünümün yaklaşık hâli. Seçilen dilde eksik metinler yedek dilde, parantezle işaretlenerek görünür.",
      tile: "Mağaza kartı", detail: "Uygulama sayfası", install: "Yükle", about: "Hakkında", whats_new: "Yenilikler",
      no_description: "Henüz açıklama yok.", desktop: "Masaüstü", phone: "Telefon", fallback_title: "Yedek dil",
    },
    languages: {
      title: "Katalog dilleri",
      text: "Uygulama metinleri bu dillerde girilebilir. İlki varsayılandır: çeviri eksikse CLD Hub onu gösterir.",
      add_placeholder: "Dil kodu, ör. de ya da pt-BR", default: "Varsayılan",
      exists: "{lang} zaten listede.", added: "{lang} eklendi. Uygulamak için yayınla.",
      remove_title: "{lang} kaldırılsın mı?", remove_text: "Bu dilde henüz hiçbir uygulamanın içeriği yok.",
      remove_text_used: "{count} uygulamadaki bu dile ait metinler ve ekran görüntüleri de silinecek.",
    },
    publish: {
      title: "Değişiklikleri yayınla", subtitle: "Görseller ve catalog.json tek commit'te birlikte gider.",
      commit: "Commit mesajı", ok: "Yayınla",
      added: "Eklendi: {name}", modified: "Güncellendi: {name}", removed: "Silindi: {name}", languages: "Katalog dilleri",
      more: "ve {count} değişiklik daha",
      missing: "Eksik çeviriler: {langs}",
      uploads: "{count} yeni görsel yüklenecek",
      deletions: "Kullanılmayan {count} görsel silinecek",
      done_title: "Yayınlandı", done_text: "CLD Hub kullanıcıları değişiklikleri birkaç dakika içinde görecek.", view_commit: "Commit'i gör",
    },
    diff: {
      added: "eklendi", removed: "kaldırıldı", changed: "değişti", file: "dosyası",
      screenshots: "Ekran görüntüleri ({group}): {from} → {to}",
      field: { name: "Ad", subtitle: "Kısa tanıtım", description: "Açıklama", notes: "Yenilikler", version: "Sürüm",
               date: "Çıkış tarihi", category: "Tür", status: "Durum", logo: "Logo", cover: "Kapak görseli", video: "Video",
               developer: "Geliştirici", genres: "Türler", age_rating: "Yaş sınırı", app_languages: "Uygulama dilleri",
               links: "Bağlantılar", github_repo: "GitHub reposu", icon: "Simge", featured: "Vitrin", hidden: "Gizli",
               history: "Sürüm geçmişi" },
    },
    error: {
      id_required: "ID zorunlu.", id_pattern: "Yalnızca harf, rakam, tire ve alt çizgi kullan.",
      id_taken: "Bu ID zaten kullanılıyor.", name_required: "Ad zorunlu.",
      version_required: "Yayındaki ya da arşivdeki bir uygulamanın sürümü olmalı.",
      version_pattern: "Sürüm boşluk içeremez (ör. 1.2.0, 1.0.1-beta).", date_pattern: "YYYY-AA-GG biçiminde yaz.",
      repo_pattern: "'kullanıcı/repo' biçiminde yaz.", media_pattern: "Bir adres ya da media/<id>/… yolu olmalı.",
      url_invalid: "Geçerli bir web adresi değil.", support_invalid: "Web adresi ya da mailto: bağlantısı olmalı.",
      genre_unknown: "Bilinmeyen tür: {genre}", lang_pattern: "Dil kodu değil: {lang} (ör. de, pt-BR)",
      download_url: "{platform} bağlantısı geçerli bir adres değil.", size_negative: "Boyut negatif olamaz.",
      sha_pattern: "64 karakterlik bir SHA-256 değeri olmalı.", apk_android_only: "APK yalnızca Android için.",
      android_apk_only: "Android'de yalnızca APK kurulabilir.", screenshot_pattern: "Geçerli bir adres ya da media/ yolu değil: {url}",
      downloads_required: "Yayındaki ya da arşivdeki bir uygulamanın en az bir indirme bağlantısı olmalı.",
      wizard_repo: "Önce GitHub reposunu yaz.",
      catalog_json: "catalog.json geçerli bir JSON değil: {detail}", catalog_apps: "catalog.json içinde 'apps' listesi yok.",
      gh_offline: "GitHub'a bağlanılamadı. İnternet bağlantını kontrol et.",
      gh_no_push: "Bu token'ın repoya yazma izni yok (Contents: Read and write gerekli).",
      gh_conflict: "Katalog bu arada başka bir yerden değişmiş. Yeniden yükleyip tekrar dene.",
      gh_401: "Token geçersiz ya da süresi dolmuş.", gh_403: "Erişim reddedildi ({detail}).",
      gh_404: "Repo, dal veya dosya bulunamadı. Bilgileri ve token'ın repo erişimini kontrol et.",
      gh_422: "GitHub isteği reddetti ({detail}).", gh_other: "GitHub hatası: HTTP {status} {detail}",
      image_type: "PNG, JPG veya WebP bir görsel seç.", image_too_big: "Görsel {mb} MB'tan büyük.",
      image_unreadable: "Görsel okunamadı.", image_too_small: "Görsel çok küçük (en az {min}).",
      image_need_id: "Önce Genel sekmesinde geçerli bir ID yaz; dosya adları ona göre verilir.",
    },
  },
};

function detect() {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (UI_LANGUAGES.includes(saved)) return saved;
  } catch { /* depolama kapalı */ }
  const nav = globalThis.navigator || {};
  const browser = (nav.languages || [nav.language || "en"]).map((l) => l.toLowerCase().split("-")[0]);
  return browser.find((l) => UI_LANGUAGES.includes(l)) || "en";
}

let current = detect();
if (globalThis.document) document.documentElement.lang = current;

/** Testler için: sözlükler (değiştirilmemeli). */
export const DICTIONARIES = DICT;

export const getLang = () => current;

export function setLang(lang) {
  if (!UI_LANGUAGES.includes(lang)) return;
  current = lang;
  document.documentElement.lang = lang;
  try { localStorage.setItem(LANG_KEY, lang); } catch { /* depolama kapalı */ }
  applyStatic();
}

function lookup(dict, key) {
  return key.split(".").reduce((node, part) => (node && typeof node === "object" ? node[part] : undefined), dict);
}

/** Çeviri: t("list.count", { count: 3, langs: "en, tr" }). `lang` verilirse o dilde (yoksa İngilizce). */
export function t(key, params = {}, lang = current) {
  let value = lookup(DICT[lang] || DICT.en, key);
  if (value === undefined || (typeof value === "object" && !("other" in value))) value = lookup(DICT.en, key);
  if (value === undefined) return key;
  if (typeof value === "object") {
    const form = new Intl.PluralRules(lang).select(Number(params.count) || 0);
    value = value[form] ?? value.other;
  }
  return String(value).replace(/\{(\w+)\}/g, (match, name) =>
    (params[name] === undefined ? match : name === "count" ? new Intl.NumberFormat(lang).format(params[name]) : String(params[name])));
}

/** HTML'deki sabit metinleri çevirir. */
export function applyStatic(root = document) {
  for (const el of root.querySelectorAll("[data-i18n]")) el.textContent = t(el.dataset.i18n);
  for (const el of root.querySelectorAll("[data-i18n-placeholder]")) el.placeholder = t(el.dataset.i18nPlaceholder);
  for (const el of root.querySelectorAll("[data-i18n-title]")) {
    el.title = t(el.dataset.i18nTitle);
    el.setAttribute("aria-label", el.title);
  }
}

const displayNames = new Map();
function namesFor(lang) {
  if (!displayNames.has(lang)) {
    try { displayNames.set(lang, new Intl.DisplayNames([lang], { type: "language" })); }
    catch { displayNames.set(lang, null); }
  }
  return displayNames.get(lang);
}

/** Dilin arayüz dilindeki adı ("German" / "Almanca"). */
export function languageName(code, lang = current) {
  try { return namesFor(lang)?.of(code) || code; } catch { return code; }
}

/** Dilin kendi dilindeki adı, ilk harfi büyük ("Deutsch", "Türkçe"). */
export function nativeLanguageName(code) {
  let name;
  try { name = namesFor(code)?.of(code) || code; } catch { name = code; }
  return name.charAt(0).toLocaleUpperCase(code) + name.slice(1);
}

/** YYYY-AA-GG tarihini dile göre yazar. */
export function formatDate(iso, lang = current) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "");
  if (!match) return iso || "";
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  try {
    return new Intl.DateTimeFormat(lang, { dateStyle: "medium", timeZone: "UTC" }).format(date);
  } catch {
    return iso;
  }
}
