# Blade Rush — To-Do / Roadmap

Daftar pekerjaan berikutnya. Riwayat yang **sudah selesai** ada di
`app/data/changelog.json` (ditampilkan di halaman `/changelog`). Ringkasan
sistem yang sudah ada di `CLAUDE.md`.

> Aturan: setiap perubahan → update `app/data/changelog.json`, `CLAUDE.md`
> (bila ada sistem/konsep baru), dan file ini (pindahkan item ke "Selesai"
> atau centang), lalu `npx nuxi typecheck` + jalankan dev + commit.

## 🔜 Berikutnya (prioritas)

_Semua item prioritas sudah selesai — ambil berikutnya dari Backlog di bawah._

## 🧩 Backlog / ide

- [ ] **Prestige lanjutan**: milestone bintang (mis. tiap 10 bintang buka bonus
      spesial), atau prestige per-hero.
- [ ] **Onboarding**: pop-up tutorial singkat saat pertama main (guide sudah ada
      di `/guide`, tinggal auto-show sekali).
- [ ] **Audio/musik**: lebih banyak layer musik dinamis; SFX unik per elite affix.
- [ ] **Aksesibilitas**: opsi colorblind, toggle reduce-flash (selain screen shake).
- [ ] **Sosial**: papan skor lokal multi-entri + share skor.
- [ ] **Daily Challenge** (ditunda, bukan prioritas) — RNG deterministik berbasis
      seed tanggal (map/spawn/gate sama untuk semua orang di hari yang sama) +
      skor harian & streak. Butuh seeded PRNG di-thread ke jalur `Math.random`
      saat mode daily.

## ✅ Selesai (highlight sesi terakhir)

Lihat `/changelog` untuk daftar lengkap & bertanggal. Sorotan:

- Kartu level-up menandai upgrade yang "akan berevolusi" (badge emas).
- XP gem + magnet (kill drop gem, ditarik ke hero).
- Performa: baking tekstur bertahap (per-frame) + progress bar (anti-freeze).
- Musuh elite baru: Caster (penembak) & Splitter (pecah saat mati).
- Companion pet evolvable (16 bentuk, zap musuh, ikut tier hero).
- Session quests untuk koin (pool 40+, 4 per run, progress di HUD).
- Mekanik bos unik (summoner/teleporter/charger/bomber/shielder) + fase 2.
- Hazard per map (lava/pasir hisap/es/pusaran/toxic).
- Prestige (reset koin+upgrade → bintang permanen).
- Evolusi hero: cadence lebih pelan + spektakel mewah per tier rarity.
- Evolusi upgrade elemental (Ignite→Inferno, Frostbite→Absolute Chill, Venom→Plague).
- Efek visual bespoke untuk semua 20 ultimate divine (meteor/petir/salju/gempa/racun).
- Boss warning + boss membantai NPC di dekatnya.
- Relic (modifier pasif dari peti), 12 map, banner map, musik dinamis, changelog.
