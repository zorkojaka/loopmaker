# Loopmaker

Looper za brskalnik — mišljen za telefon, brez namestitve.

**Živa različica:** https://zorkojaka.github.io/loopmaker/

## Ideja

Delaš z **loopi**: ena linija = en loop. Naredi bobne, dodaj hi-hat, naredi basovsko
linijo, akorde na klavirju — vsak je svoja kartica v paleti. Med igranjem jih s tapom
prižigaš in ugašaš in tako sestavljaš skladbo v živo.

Vsi loopi tečejo po skupni uri: loop se pripne na `globalStep % dolžina`, zato dvotaktni
bas in enotaktni hi-hat ostaneta v fazi, prižiganje sredi takta pa ne premakne ritma.

## Kje smo

- **Faza 1:** sintetizirani zvoki in step sequencer. ✔
- **Faza 2:** melodika — klavir, flavta, godala, brenkalo, orgle; klaviatura z akordi. ✔
- **Faza 3:** deska loopov — loop kot enota, vse na enem zaslonu, vklop z velikim gumbom. ✔
- **Faza 4:** looper z mikrofonom — snemanje linije s telefona, overdub, kalibracija latence.
- **Faza 5:** izvoz v WAV, PWA (offline), deljenje povezave.
- **Faza 6:** kamera kot kontroler (sledenje roki prek MediaPipe).

## Uporaba

Vse je na enem zaslonu. Vsak loop je svoja vrstica:

- **Velik gumb levo** loop prižge ali ugasne. To je glavni gib med igranjem.
- **Mreža desno** je urejanje v živo: tap na polje je prazno → zvok → akcent → prazno,
  vlečenje riše. Vsak loop kaže svojo dolžino in po njej teče svoja bela črta, zato se
  vidi, da dvotaktni bas kroži počasneje od enotaktnega hi-hata.
- **⌄** odpre podrobnosti kar pod vrstico: glasnost, uglasitev, izzven, dolžina loopa,
  poslušaj, podvoji, počisti, izbriši. Pri melodičnih loopih se tu odpre tudi **klaviatura**
  z vrstico akordov.
- **⋯** (ali dolg pritisk na velik gumb) odpre meni: prižgi/ugasni, samo ta naj igra,
  podvoji, preimenuj, dolžina, zapolni vsako 4- ali 8-tinko, počisti, izbriši.
- **Dolg pritisk / desni klik na polje v mreži**: ghost, akcent, **roll ×2–×4**, izbriši.
- Spodaj so **+ Nov loop**, **Vse prižgi** in **Vse ugasni**.

**Klaviatura** (pod melodičnim loopom)

- Navpično višina tona, vodoravno čas; **akord je več not druga nad drugo**.
- **Vrstica akordov**: izberi tonaliteto (C…B, dur/mol) in klikni stopnjo (I, ii, IV, V …) —
  trozvok se vstavi na kazalec in ga premakne naprej.
- **Tipke levo** so igralne. **−8va / +8va** premakneta okno za oktavo.

**Ostalo**

- **Tempo**: povleci številko gor/dol, klikni za vpis, ali trkaj ritem na **TAP**.
- ⚙ odpre swing in glavno glasnost. Preslednica = play/stop.
- Vse se sproti shrani v brskalnik.

## Kako deluje

Zvoki nastanejo sproti iz oscilatorjev in šuma ([src/audio/voices.ts](src/audio/voices.ts)) — nobenih
sample datotek. Tolkala so enkratni udarci, melodični glasovi imajo ADSR ovoj in trajanje note.

Ritem vodi lookahead scheduler ([src/audio/engine.ts](src/audio/engine.ts)): `setInterval` vsakih 25 ms
pogleda 120 ms naprej in dogodke pripne na vzorčno natančno uro `AudioContext`.

Črte, ki tečejo po loopih, premika ena sama animacijska zanka v [Board.tsx](src/components/Board.tsx),
ki piše neposredno v DOM; v React state gre samo tisto, kar res spremeni izris.

Stanje je en objekt z loopi, ki ga spreminja reducer ([src/state/song.ts](src/state/song.ts)).
Tam je tudi `migrate()`, ki star zapis z vzorci razbije na posamezne loope.

## Razvoj

```bash
npm install
npm run dev -- --host
npm run build
```

Deploy gre samodejno prek GitHub Actions ob vsakem pushu na `main`.
