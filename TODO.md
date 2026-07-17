# Blade Rush — To-Do / Roadmap

Daftar pekerjaan berikutnya. Riwayat yang **sudah selesai** ada di
`app/data/changelog.json` (ditampilkan di halaman `/changelog`). Ringkasan
sistem yang sudah ada di `CLAUDE.md`.

> Aturan: setiap perubahan → update `app/data/changelog.json`, `CLAUDE.md`
> (bila ada sistem/konsep baru), dan file ini (pindahkan item ke "Selesai"
> atau centang), lalu `npx nuxi typecheck` + jalankan dev + commit.

## 🔜 Berikutnya (prioritas)

- [ ] **Daily Challenge** — RNG deterministik berbasis seed tanggal (map,
      spawn, gate sama untuk semua orang di hari yang sama). Simpan skor harian
      terbaik + streak berapa hari berturut main. Butuh: seeded PRNG yang di-
      thread ke `SpawnService`/pemilihan map/gate (ganti `Math.random` di jalur
      yang relevan saat mode daily).

- [ ] **Mekanik bos unik + multi-fase** — tiap arketipe bos (dari `bossName`/
      skin) dapat gimmick sendiri: teleport, summon lebih agresif, perisai fase,
      pola enrage berbeda. Tambah **fase kedua** saat HP < ambang (ganti pola +
      efek transisi). Sentuh `updateBoss`/`castFan`/`castMeteors` + state fase.

- [ ] **Hazard per map** — bahaya lingkungan khas tiap map: genangan lava
      (Caldera, damage berkala), pasir hisap (Desert, memperlambat), es licin
      (Tundra, gerak meluncur), pusaran (Abyss, menyeret). Tambah field `hazard`
      di `MAPS`, spawn zona hazard + cek overlap player/enemy di `update`.

- [ ] **Objective/quest untuk koin** — 2-3 target per sesi (bunuh N bos, capai
      Divine, bertahan X menit, serap N NPC) yang memberi koin saat tercapai.
      Bisa reuse `RunStats`/achievement infra. Tampilkan progress ringkas di HUD
      + reward di layar game-over.

- [ ] **Companion/pet evolvable** — sekutu panggilan yang mengorbit/mengikuti
      hero, menyerang musuh terdekat, dan **berevolusi** ikut tier hero. Entity
      baru (`entities/Companion.ts`) + sprite baked + kontribusi damage kecil.

## 🧩 Backlog / ide

- [ ] **Variasi tempur lanjutan** (elite sudah ada):
  - [ ] XP gem drop + magnet (ala survivor.io) sebagai alternatif XP otomatis.
  - [ ] Tipe musuh baru: penembak jarak jauh, pembelah (split saat mati).
- [ ] **Kartu level-up**: tandai elemental yang "akan berevolusi" saat di level 4
      (butuh overlay tahu level upgrade saat ini).
- [ ] **Prestige lanjutan**: milestone bintang (mis. tiap 10 bintang buka bonus
      spesial), atau prestige per-hero.
- [ ] **Onboarding**: pop-up tutorial singkat saat pertama main (guide sudah ada
      di `/guide`, tinggal auto-show sekali).
- [ ] **Audio/musik**: lebih banyak layer musik dinamis; SFX unik per elite affix.
- [ ] **Performa**: bake tekstur secara lazy/async biar loading awal lebih cepat
      (~ribuan tekstur saat boot) — berisiko, kerjakan hati-hati + verifikasi
      ketersediaan tekstur.
- [ ] **Aksesibilitas**: opsi colorblind, toggle reduce-flash (selain screen shake).
- [ ] **Sosial**: papan skor lokal multi-entri + share skor.

## ✅ Selesai (highlight sesi terakhir)

Lihat `/changelog` untuk daftar lengkap & bertanggal. Sorotan:

- Prestige (reset koin+upgrade → bintang permanen).
- Evolusi hero: cadence lebih pelan + spektakel mewah per tier rarity.
- Evolusi upgrade elemental (Ignite→Inferno, Frostbite→Absolute Chill, Venom→Plague).
- Efek visual bespoke untuk semua 20 ultimate divine (meteor/petir/salju/gempa/racun).
- Boss warning + boss membantai NPC di dekatnya.
- Relic (modifier pasif dari peti), 12 map, banner map, musik dinamis, changelog.
