# Loopmaker

Aplikacija za izdelavo glasbe v brskalniku — mišljena za telefon, brez namestitve.

**Živa različica:** https://zorkojaka.github.io/loopmaker/

## Kje smo

- **Faza 1:** step sequencer — 9 sintetiziranih instrumentov, vzorci, swing, akcenti. ✔
- **Faza 2:** aranžma — poljubno število vzorcev, bloki na časovnici, playhead, kontekstni meniji. ✔
- **Faza 2b:** melodika — klavir, flavta, godala, brenkalo, orgle; piano roll z akordi. ✔
- **Faza 3:** looper — snemanje z mikrofona telefona, overdub, kalibracija latence.
- **Faza 4:** izvoz v WAV, PWA (offline), deljenje povezave.
- **Faza 5:** kamera kot kontroler (sledenje roki prek MediaPipe).

## Uporaba

Aplikacija ima dva pogleda, preklop je v zgornji vrstici:

**Vzorec** — mreža instrumentov × korakov.

- **Tap na celico**: prazno → zvok → akcent → prazno. Vlečenje riše po mreži.
- **Desni klik / dolg pritisk na celico**: ghost, normalno, akcent, **roll ×2–×4**, izbriši.
- **Desni klik na ime instrumenta**: mute, solo, zapolni vsako 4- ali 8-tinko, zbriši vrsto.
- **Klik na trak s številkami** premakne playhead na tisti korak.

**Klaviatura** — tap na melodični kanal (Klavir, Flavta …) v mreži odpre piano roll.

- Navpično je višina tona, vodoravno čas; **akord je več not druga nad drugo**.
- **Tap v polje** doda noto in jo predposluša, **tap na noto** jo odstrani.
- **Vrstica akordov** postavi cel trozvok naenkrat: izberi tonaliteto (C…B, dur/mol) in klikni
  stopnjo (I, ii, IV, V …). Vsak akord se vstavi na kazalec in ga premakne naprej.
- **Desni klik na noto**: dolžina (1–8 korakov), glasnost, izbriši. **Desni klik v prazno**: zgradi
  dur/mol/zmanjšan akord od tiste note.
- **Tipke levo** so igralne — tap zaigra ton. **−8va / +8va** premakneta okno za oktavo.
- **+ glasbilo** pod seznamom instrumentov doda nov melodični kanal.

**Skladba** — bloki vzorcev na časovnici, kot playlist v FL Studiu.

- **Klik v prazno polje** postavi izbrani vzorec.
- **Vlečenje bloka** ga premakne, **desni klik** odpre meni (podvoji, zamenjaj vzorec, izbriši).
- Vsak vzorec se ureja posebej v pogledu **Vzorec**; sprememba se pozna povsod, kjer je blok postavljen.

**Ostalo**

- **Tempo**: povleci številko gor/dol, klikni jo za vpis, ali trkaj ritem na **TAP**.
- **Vzorci A/B/C…**: desni klik na zavihek za preimenovanje, podvojitev, barvo in dolžino (1/2/4 takte).
- ⚙ odpre swing in glavno glasnost. Preslednica = play/stop.
- Vse se sproti shrani v brskalnik.

## Kako deluje

Zvoki nastanejo sproti iz oscilatorjev in šuma ([src/audio/voices.ts](src/audio/voices.ts)) — nobenih
sample datotek, zato se aplikacija odpre takoj in ima vsak instrument žive parametre.

Ritem vodi lookahead scheduler ([src/audio/engine.ts](src/audio/engine.ts)): `setInterval` vsakih 25 ms
pogleda 120 ms naprej in dogodke pripne na vzorčno natančno uro `AudioContext`. Isti scheduler poganja
oba načina — razlika je le, ali korak razreši v trenutni vzorec ali v bloke na časovnici.

Playhead se premika prek DOM-a v `requestAnimationFrame` ([src/hooks/usePlayhead.ts](src/hooks/usePlayhead.ts));
v React state gre samo cel korak, sicer bi se ob vsakem okvirju prerisala cela mreža.

Stanje skladbe je en objekt, ki ga spreminja reducer ([src/state/song.ts](src/state/song.ts)) — vsi
ukazi menijev so navadne akcije, engine pa isti objekt bere prek ref-a in ga ni treba ustavljati.

## Razvoj

```bash
npm install
npm run dev -- --host
npm run build
```

Deploy gre samodejno prek GitHub Actions ob vsakem pushu na `main`.
