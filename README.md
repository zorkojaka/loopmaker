# Loopmaker

Aplikacija za izdelavo glasbe v brskalniku — mišljena za telefon, brez namestitve.

**Živa različica:** https://zorkojaka.github.io/loopmaker/

## Kje smo

- **Faza 1 (zdaj):** step sequencer — 9 sintetiziranih instrumentov, 16 korakov, 4 vzorci, swing, akcenti.
- **Faza 2:** mixer, več kot 16 korakov, veriženje vzorcev v skladbo.
- **Faza 3:** looper — snemanje z mikrofona telefona, overdub, kalibracija latence.
- **Faza 4:** izvoz v WAV, PWA (offline), deljenje povezave.
- **Faza 5:** kamera kot kontroler (sledenje roki prek MediaPipe).

## Uporaba

- **Tap na celico** preklopi: prazno → zvok → akcent (svetlejša celica) → prazno.
- **Vlečenje s prstom** riše po mreži.
- **Tap na ime instrumenta** ga izbere in predposluša; spodaj se odprejo njegovi parametri.
- **Dvojni klik na ime** utiša (mute).
- **Preslednica** = play/stop (na računalniku).
- Vzorci **A–D** se preklapljajo v živo; vse se samodejno shrani v brskalnik.

## Zvok

Vsi zvoki nastanejo sproti iz oscilatorjev in šuma ([src/audio/voices.ts](src/audio/voices.ts)) —
nobenih sample datotek. Zato se aplikacija odpre takoj in ima vsak instrument
žive parametre (tune, dolžina). Bas in Blip sta melodična; njun `tune` je nota.

Ritem vodi lookahead scheduler ([src/audio/engine.ts](src/audio/engine.ts)): `setInterval` vsakih 25 ms
pogleda 120 ms naprej in dogodke pripne na vzorčno natančno uro `AudioContext`.
`setTimeout` sam po sebi je za glasbo prenatančen le na papirju — v praksi plava.

## Razvoj

```bash
npm install
npm run dev -- --host    # --host: odpri na telefonu prek LAN
npm run build
```

Deploy gre samodejno prek GitHub Actions ob vsakem pushu na `main`.
