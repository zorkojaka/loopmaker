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

## Trije pogledi

1. **Delaj loop** — tu loop nastane: tapkaš ga v ritmu, popraviš v mreži. ✔
2. **Kanali** — vklop/izklop loopov; veriženje v kitice pride kasneje. ✔
3. **Mix** — kvadrati za sprotno mešanje in bližnjice do zvokov. (zadnje)

## Delaj loop

- Zgoraj izbereš loop (ali dodaš novega z **+ nov**).
- **SNEMAJ** požene uro in odpre zapisovanje. Tapkaš po veliki ploščici (tolkala) ali po
  ploščicah lestvice (melodični loopi) — vsak udarec se pripne na najbližji korak izbrane
  **kvantizacije** (1/16, 1/8, 1/4).
- **Akcent** naredi naslednje udarce glasnejše, **Metronom** doda klik na vsako dobo.
- Pod ploščicami je mreža istega loopa: kar zgrešiš, popraviš s prstom.

**Glas z mikrofonom** je v istem oknu: **+ nov → Posnetek → Glas (mikrofon)**.

- Vsak posnetek je **svoj loop** s svojim velikim gumbom — glasove dodajaš enega za drugim
  (Glas, Glas 2, Glas 3 …) in vsakega posebej prižgeš ali ugasneš.
- Izbereš dolžino (1, 2 ali 4 takte) in pritisneš **SNEMAJ GLAS**.
- Snemanje se sproži šele na začetku naslednjega takta — vmesni takt je odštevanje z
  metronomom, tako da posnetek pade točno v mrežo.
- Zajem teče v `AudioWorklet` po vzorcih (`public/capture-worklet.js`), zato je posnetek
  natanko toliko dolg, kolikor traja loop.
- **Zamik naprave** premakne okno snemanja naprej ali nazaj; s tem izničiš zakasnitev
  svojega telefona. Če posnetek zveni prepozno, povečaj zamik in posnemi znova.
- **+ Dodaj plast na ta glas** posname še eno plast in jo prišteje k obstoječi (dvoglasje,
  odgovori, tolkala z usti). Vsota se mehko omeji, da ne zaklipa.
- **Samodejna glasnost** dvigne tih posnetek na spodobno raven; robovi posnetka se vedno
  zabrišejo za 6 ms, da rez ob vsakem obhodu ne poka.
- **+ Nov glas** takoj naredi naslednji glasovni loop.
- Posnetki gredo v IndexedDB (ne v localStorage, kjer bi hitro zmanjkalo prostora).
- Ob spremembi tempa se posnetek raztegne, da ostane v ritmu.

## Kanali in kitice

Vse je na enem zaslonu. Vsak loop je svoja vrstica:

- **Velik gumb levo** loop prižge ali ugasne. To je glavni gib med igranjem.
- **Mreža desno** je urejanje v živo: tap na polje je prazno → zvok → akcent → prazno,
  vlečenje riše. Vsak loop kaže svojo dolžino in po njej teče svoja bela črta, zato se
  vidi, da dvotaktni bas kroži počasneje od enotaktnega hi-hata.
- **⌄** odpre podrobnosti kar pod vrstico: glasnost, uglasitev, izzven, dolžina loopa,
  poslušaj, podvoji, počisti, izbriši. Pri melodičnih loopih se tu odpre tudi **klaviatura**
  z vrstico akordov.
- V glavi vrstice so ikone: **svinčnik** (odpre ta loop v pogledu *Delaj loop*, da ga
  popraviš ali dosnameš), **⌄** (podrobnosti), **zanka s številko** (tap kroži dolžino
  1 → 2 → 4 takte) in **koš** (izbris; pri loopu z vsebino vpraša za potrditev).
- **Dolg pritisk na velik gumb** odpre celoten meni: prižgi/ugasni, samo ta naj igra,
  podvoji, preimenuj, zapolni vsako 4- ali 8-tinko, počisti.
- **Dolg pritisk / desni klik na polje v mreži**: ghost, akcent, **roll ×2–×4**, **izmenjava
  A/B**, izbriši.
- Spodaj so **+ Nov loop**, **Vse prižgi** in **Vse ugasni**.

**Kitice** so nad kanali:

- **+ shrani stanje** posname, kateri loopi trenutno igrajo, in doda kitico v zaporedje.
- Tap na kitico prižge natanko tiste loope; dolg pritisk odpre meni (preimenuj, dolžina v
  taktih, posodobi po trenutnem stanju, izbriši).
- **Zaporedje** je vrsta kitic; s puščicama ju premikaš, z ✕ odstraniš.
- **Predvajaj zaporedje** preda vodenje kiticam: skladba gre kitica → refren → kitica sama,
  trenutna kitica je označena. Stikala na kanalih takrat samo pripravljajo stanje, ki ga s
  *Posodobi po trenutnem stanju* shraniš nazaj v kitico.

**Klaviatura** (pod melodičnim loopom)

- Navpično višina tona, vodoravno čas; **akord je več not druga nad drugo**.
- **Vrstica akordov**: izberi tonaliteto (C…B, dur/mol) in klikni stopnjo (I, ii, IV, V …) —
  trozvok se vstavi na kazalec in ga premakne naprej.
- **Note se vlečejo**: povleci telo note za premik po času in višini, povleci **desni rob**
  za krajšanje ali daljšanje. Kratek dotik noto samo predposluša, brisanje je v meniju.
- **Tipke levo** so igralne. **−8va / +8va** premakneta okno za oktavo; ob odprtju se okno
  samo postavi tako, da so note loopa vidne.
- **Izmenjava A/B**: nota, označena z **A**, igra v 1., 3., 5. obhodu loopa, nota z **B** pa v
  2., 4., 6. Dve noti na istem koraku — ena A, ena B — se tako menjata iz obhoda v obhod in
  melodija se ne ponavlja tako suho. V meniju note je tudi **Naredi par A/B tukaj**, ki
  obstoječo noto označi z A in cel ton više doda njen B par. Isto velja za korake bobnov.

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
