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
- **Faza 3:** paleta loopov — loop kot enota, prižiganje in ugašanje v živo. ✔
- **Faza 4:** looper z mikrofonom — snemanje linije s telefona, overdub, kalibracija latence.
- **Faza 5:** izvoz v WAV, PWA (offline), deljenje povezave.
- **Faza 6:** kamera kot kontroler (sledenje roki prek MediaPipe).

## Uporaba

**Paleta** je glavni zaslon.

- **Tap na kartico** loop prižge ali ugasne. Črtica na dnu kartice kaže, kje v svojem ciklu je.
- **✎** odpre urejevalnik tega loopa.
- **Dolg pritisk / desni klik**: uredi, podvoji, preimenuj, samo ta naj igra, dolžina (1/2/4 takte),
  počisti, izbriši.
- **+ Nov loop** doda linijo: ritmično (Kick, Snare, Hat …) ali melodično (Klavir, Flavta …).
- Spodaj sta **Vse prižgi** in **Vse ugasni**.

**Urejevalnik ritma** (za ritmične loope)

- Vsi loopi so vidni hkrati, ker se hi-hat piše proti bobnu — urejaš tistega, ki je izbran.
- **Tap na celico**: prazno → zvok → akcent → prazno. Vlečenje riše.
- Loop, krajši od mreže, se v njej **ponovi**; bledejša polja so ista koraka.
- **Desni klik na celico**: ghost, akcent, **roll ×2–×4**, izbriši.

**Klaviatura** (za melodične loope)

- Navpično višina tona, vodoravno čas; **akord je več not druga nad drugo**.
- **Vrstica akordov**: izberi tonaliteto (C…B, dur/mol) in klikni stopnjo (I, ii, IV, V …) —
  trozvok se vstavi na kazalec in ga premakne naprej.
- **Tipke levo** so igralne. **−8va / +8va** premakneta okno za oktavo.
- **Desni klik na noto**: dolžina, glasnost, izbriši.

**Ostalo**

- **Tempo**: povleci številko gor/dol, klikni za vpis, ali trkaj ritem na **TAP**.
- ⚙ odpre swing in glavno glasnost. Preslednica = play/stop, Esc = nazaj v paleto.
- Vse se sproti shrani v brskalnik.

## Kako deluje

Zvoki nastanejo sproti iz oscilatorjev in šuma ([src/audio/voices.ts](src/audio/voices.ts)) — nobenih
sample datotek. Tolkala so enkratni udarci, melodični glasovi imajo ADSR ovoj in trajanje note.

Ritem vodi lookahead scheduler ([src/audio/engine.ts](src/audio/engine.ts)): `setInterval` vsakih 25 ms
pogleda 120 ms naprej in dogodke pripne na vzorčno natančno uro `AudioContext`.

Playhead in faze kartic se rišejo prek DOM-a v `requestAnimationFrame`
([src/hooks/usePlayhead.ts](src/hooks/usePlayhead.ts)); v React state gre samo cel korak.

Stanje je en objekt z loopi, ki ga spreminja reducer ([src/state/song.ts](src/state/song.ts)).
Tam je tudi `migrate()`, ki star zapis z vzorci razbije na posamezne loope.

## Razvoj

```bash
npm install
npm run dev -- --host
npm run build
```

Deploy gre samodejno prek GitHub Actions ob vsakem pushu na `main`.
