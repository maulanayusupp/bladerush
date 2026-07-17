# Blade Rush — Panduan Proyek & Coding Style

**Blade Rush** — game web *survivor*: ring pedang berputar yang tumbuh,
menghabisi gerombolan musuh, dan duel melawan hero rival. Dibangun dengan
**Nuxt 4 + TypeScript** untuk shell aplikasi dan **Phaser 4** untuk gameplay di
`<canvas>`.

## Perintah

```bash
npm run dev       # server pengembangan
npm run build     # build produksi
npm run preview   # pratinjau hasil build
npx nuxi typecheck  # cek tipe TypeScript
```

## Arsitektur (3 lapisan tegas)

Aturan emas: **logika bisnis tidak boleh tahu soal Phaser maupun Vue.**

| Folder | Isi | Boleh impor |
|--------|-----|-------------|
| `app/helpers/` | Fungsi **murni** tanpa state/efek samping (math, format). | apa pun yang murni |
| `app/services/` | **Logika bisnis** game (aturan power, spawn, skor, event bus). | `helpers`, `types`, `constants` — **BUKAN** Phaser/Vue |
| `app/game/` | Adaptor **Phaser** (scenes, entities, config). Memanggil services untuk keputusan, lalu merender. | `services`, `helpers`, `types`, `constants`, `phaser` |
| `app/components/` | Komponen **Vue** (UI/DOM). | `services`, `helpers`, `stores`, `types` |
| `app/stores/` | State UI lintas-halaman (Pinia). | `helpers`, `types` |
| `app/types/` | Tipe domain bersama. | — |

Alur data: `Phaser (BattleScene)` ⇄ `services/EventBus` ⇄ `components (GameHud)`.
Komunikasi lintas-batas **selalu** lewat `gameEventBus` yang bertipe, **bukan**
Vue reactivity per-frame (demi performa).

## Konvensi kode

### Umum
- **Semua kode berbahasa Inggris**: identifier, komentar, nama file, dan
  string di dalam kode. **Tidak ada teks non-Inggris di kode.**
- **TypeScript wajib**, `lang="ts"` di semua `<script setup>`. Hindari `any`;
  cast eksplisit bila berinteraksi dengan API Phaser yang longgar.
- **Jangan berasumsi**: verifikasi API/versi sebelum memakai; jangan hardcode
  nilai yang belum dipastikan. Nilai gameplay ditaruh di `app/game/constants.ts`.
- Alias impor: gunakan `~/` (→ `app/`) untuk modul lintas-folder. Pengecualian:
  `GameCanvas.vue` meng-*import dinamis* `createGame` via path **relatif** agar
  Phaser tidak ikut ter-bundle di server.

### Component-based (Vue)
- Satu komponen = satu tanggung jawab. Pecah UI jadi komponen kecil reusable
  (mis. `ui/BaseButton.vue`). Komponen game di `components/game/`.
- Urutan blok SFC: `<script setup lang="ts">` → `<template>`. Tanpa `<style>`
  di komponen (lihat SCSS di bawah).
- Props pakai `defineProps<...>()` + `withDefaults`. Nama komponen PascalCase.

### Services & Helpers
- **Helper = fungsi murni**, `namaFile.helper.ts`, tanpa kelas.
- **Service = kelas** ber-state atau berperilaku, satu tanggung jawab, nama
  `NamaService.ts`. Ekspor kelas; buat instance di pemakai (scene), agar mudah
  di-*unit test*.

### Styling — SCSS terpusat, TANPA inline style
- **Dilarang** `<style>` di komponen dan atribut `style="..."` yang bersifat
  presentasional. Semua gaya ada di `app/assets/scss/` (arsitektur 7-1):
  - `abstracts/` → `_variables.scss` (design token) & `_mixins.scss` (murni,
    diinjeksikan global via `nuxt.config.ts`).
  - `base/` → reset & tipografi. `components/` → gaya per komponen (BEM).
  - `main.scss` → entry yang `@use` semua partial.
- Warna/spacing/font **hanya** dari token `_variables.scss` — jangan hardcode.
- Penamaan kelas: **BEM** (`.hud__stat-value--power`).
- **Nilai dinamis** (mis. lebar health-bar) boleh lewat **CSS custom property**
  yang di-`:style="{ '--x': value }"` — ini data, bukan styling; seluruh
  presentasi tetap di SCSS memakai `var(--x)`. Ini satu-satunya pemakaian
  `:style` yang diizinkan.

### Localization (i18n)
- **Tidak boleh ada teks UI hardcoded** di komponen. Semua teks yang dilihat
  pengguna melalui `@nuxtjs/i18n`: `$t('key')` di template, `useI18n().t()` di
  script.
- Kunci terjemahan **berbahasa Inggris & deskriptif** (`gameOver.playAgain`),
  dikelompokkan per area (`menu`, `hud`, `gameOver`, `language`).
- File terjemahan: `i18n/locales/{code}.json`. `en` = default & fallback.
  Tambah bahasa = tambah file + daftarkan di `nuxt.config.ts` (`i18n.locales`).
- Teks di dalam Phaser (mis. label gerbang) hanya angka/simbol; jika kelak ada
  teks Phaser yang perlu diterjemahkan, ambil dari i18n lalu oper ke scene.

### Phaser
- Impor Phaser **hanya** di modul yang di-*import dinamis* client-side.
  Halaman game dibungkus `<ClientOnly>`.
- Entity = kelas meng-*extend* tipe Phaser, satu file per entity.
- **Object pooling** untuk objek yang sering muncul-hilang (peluru, musuh):
  pakai Group `maxSize` + `get()`/`disableBody()`, **jangan** `new`/`destroy`
  saat runtime.
- Lepas listener & timer di `SHUTDOWN`; hancurkan game di `onBeforeUnmount`.

## Status (roadmap)

- [x] Fase 0 — Scaffold + arsitektur + SCSS + CLAUDE.md
- [x] Fase 1 — Bridge Nuxt ↔ Phaser (GameCanvas + EventBus)
- [x] Fase 2 — Player & gerak
- [x] Fase 3 — Power & gate + auto-shoot
- [x] Fase 4 — Musuh & tempur (pooling, collision)
- [x] Fase 5 — HUD & progres (skor, game-over, high-score)
- [x] Polish — sprite prosedural (baked), audio prosedural, efek, tuning kurva

## Sistem yang sudah ada (ringkas, untuk sesi berikutnya)

Semua aset **di-bake saat runtime** di `BootScene` (tidak ada file gambar).

- **Hero**: `HERO.skins` skin, `HERO.divineCount` teratas = Divine (bespoke di
  `drawDivineHero`, pakai basis `divineCore`). Rarity via `heroRarity()`. Evolusi
  ikut **skor** (`checkEvolve`, cadence `HERO.evolveStepMs`), ganti hero me-reset
  cooldown skill. Naik tier rarity = spektakel khas per-tier (`rarityEvolveFx` +
  event `hero:rarityup` → banner HUD).
- **Divine ultimate**: `DIVINE_SKILLS` (satu per Divine), `castDivineSkill` +
  cut-in sinematik (event `divine:cast`) + SFX `audioService.ultimate(id)`.
  Efek visual bespoke lewat helper `fx*` (`fxMeteors`, `fxLightning`,
  `fxBlizzard`, `fxQuake`, `fxPoisonCloud`, `fxLightPillars`, `fxVortex`,
  `fxFlames`, `fxDamageArea`, `fxRing`, `fxBurst`, `fxBolt`). Pakai helper ini
  untuk skill baru — jangan cuma warning ring datar.
- **Mode** (`ModeService`): normal / endless / bossrush / timeattack.
- **Boss Rush** (`BOSS_RUSH`): gelombang bos (lead + escort) di Lvl 10 (normal).
  Bos muncul dengan warning (banner + telegraph) & membantai NPC yang mendekat
  (`bossSlayNearbyNpcs`). **Arketipe** per skin (`BOSS_MECH`, `bossArchetype`):
  summoner/teleporter/charger/bomber/shielder (`runBossMechanic`), + **fase 2**
  di bawah `phase2Frac` HP (`updateBossMechanics`, event `boss:phase`).
- **Maps** (`MAPS`, 12): tiap map punya `props`, `obstacles` bertema, `ambient`,
  dan `hazard` (`HAZARD`). Ground/props/obstacles di-bake di BootScene. Banner
  nama map: event `map:set`. Hazard = zona lantai non-solid (`applyHazards`):
  lava/toxic (DoT), quicksand/toxic (slow), ice (slip cepat), whirlpool (tarik).
- **Relic** (`RELICS`): modifier pasif dari peti, di-`recomputeRelics()`.
- **Evolusi upgrade** (`EVOLUTIONS`, `UPGRADE_EVOLVE_AT`): upgrade elemental
  (burn/frost/venom) di level 5 berevolusi jadi skill auto-cast (`updateEvolutions`
  → `castEvolution` pakai helper `fx*`). Event `upgrade:evolved`.
- **Meta shop** (`MetaService`, koin) + **unlock hero pakai koin** di Codex.
- **Prestige** (`PRESTIGE`, `MetaService.prestige()`): reset koin+upgrade →
  Prestige Star permanen (+5% damage & koin/star, folded ke `damageMul`/`coinMul`).
  UI di `MenuShop`; bintang tampil di menu.
- **Progres**: XP `LEVEL` (per-kill ikut nilai kill), achievements, Codex, ranking.
- **Loadout** (`LoadoutService`), **Settings** (`SettingsService`: screenShake).
- **Musik dinamis**: `audioService.setMusicIntensity(0|1|2)` (ambient/boss/rush).
- **Halaman**: `/` (menu), `/play`, `/codex`, `/guide`, `/changelog`.
- **Changelog**: `app/data/changelog.json` (WAJIB di-update tiap perubahan).
- **To-do / roadmap**: `TODO.md` di root (pekerjaan berikutnya + backlog).

> Setiap perubahan berarti: update `changelog.json`, `TODO.md` (pindahkan item
> yang selesai), **dan** dokumen ini bila ada sistem/konsep baru, lalu
> `npx nuxi typecheck` + jalankan dev + commit.
