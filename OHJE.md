# Työkalulista — QR-tarra joka avaa rastitettavan listan

Kirjoita lista, tulosta tarra, liimaa laatikkoon. Kun työkumppani lukee koodin
puhelimellaan, lista aukeaa ruudulle ja työkalut voi rastittaa kerätessä.

Koko lista kulkee QR-koodin sisällä. Verkossa oleva sivu on pelkkä piirtäjä,
jossa ei ole yhtään listaa. Uusi lista ei siis koskaan vaadi sivun päivitystä.

## Kansiot

| Kansio | Mitä | Julkaistaanko |
|---|---|---|
| `docs/` | `index.html` piirtää listan, `sw.js` pitää sen puhelimessa offline-tilassa | kyllä, tämä on sivusto |
| `tyokalut/` | `generaattori.html` tekee koodin ja tarran, `julkaise.sh` vie muutokset | ei |
| `testit/` | `t_lista.js` nopeat väitteet, `t_lista_selain.mjs` oikea selain | ei |

## Käyttöönotto, tehdään kerran

1. Luo GitHubiin **julkinen** varasto, esimerkiksi `lista`. Julkinen se on siksi,
   että Pages tarvitsee sen maksuttomassa käytössä. Mitään salaista täällä ei
   ole: sivu on pelkkä piirtäjä ilman dataa.
2. Vie kansio varastoon:

   ```sh
   cd ~/Tyokalulista
   git init -b main
   git add -A && git commit -m "Työkalulista"
   git remote add origin git@github.com:<tunnus>/lista.git
   git push -u origin main
   ```

3. GitHubissa **Settings → Pages → Source: Deploy from a branch → main → /docs**.
   Minuutin päästä osoite `https://<tunnus>.github.io/lista/` vastaa.
4. Avaa `tyokalut/generaattori.html` koneelta ja kirjoita tuo osoite
   osoitekenttään. Generaattori muistaa sen jatkossa.

Myöhemmät muutokset menevät perille komennolla `sh tyokalut/julkaise.sh`. Se ajaa
testit ensin eikä julkaise punaisena.

## Listan tekeminen

1. Avaa `tyokalut/generaattori.html`.
2. Kirjoita otsikko ja työkalut, yksi per rivi.
3. Kirjoita **tarran tekstirivi**, jos haluat. Se tulostuu koodin alle ja on
   vapaa teksti: palautusohje, numero, työmaan nimi. Tyhjänä rivi jää pois.
4. Tulosta tarra tai lataa PNG-kuva. Tarran leveys on yhdeksän senttiä ja koodi
   noin kuusi ja puoli, mikä lukeutuu luotettavasti puhelimen kameralla.

Generaattori kertoo koodin koon ja varoittaa, jos koodista tulee tiheä. Tiheä
koodi kannattaa tulostaa isompana ja kokeilla lukemista ennen liimaamista.

## Mitä työkumppani näkee

Kamera avaa listan sivuksi. Työkalut rastitetaan kerätessä, ja laskuri kertoo
montako on jäljellä. Rastit jäävät muistiin siihen puhelimeen: kesken jäänyt
keruu jatkuu samasta kohdasta, myös seuraavana päivänä. Toisen kerääjän rastit
eivät näy, koska mitään ei lähetetä palvelimelle.

Listan tulostaminen onnistuu myös suoraan puhelimesta.

## Rajat ja niiden syyt

- **Osoitteen on oltava julkinen.** Työkumppanit eivät ole sinun verkossasi,
  joten kotipalvelin tai Tailscale-osoite ei kelpaa. Siksi GitHub Pages.
- **Sivun isäntä ei näe listaa.** Listan sisältö on osoitteen risuaidan
  jälkeisessä osassa, jota selain ei lähetä palvelimelle lainkaan.
- **Ensimmäinen avaus tarvitsee kentän.** Sen jälkeen sivu on puhelimen
  muistissa ja aukeaa katvealueellakin. Jos koodi luetaan ensimmäisen kerran
  ilman yhteyttä, mitään ei aukea.
- **iPhone siivoaa muistin.** Jos sivua ei avata viikkoon, Safari saattaa
  poistaa tallennetut rastit. Lista itse ei katoa, koska se on koodissa.
- **Tarra kestää, lista ei muutu.** Jos työkalut vaihtuvat, tee uusi tarra.
  Vanha koodi näyttää vanhan listan ikuisesti, koska lista on siinä.
- **Ilman sivua tulevaa varten:** generaattorin tekstitila laittaa listan
  koodiin pelkkänä tekstinä. Silloin kamera näyttää sen heti ilman verkkoa,
  mutta rastitusta ja tulostusta ei ole.

## Testit

```sh
node testit/t_lista.js          # koodaus ja purku, tiedostonimet, alaviite
node testit/t_lista_selain.mjs  # oikea Chrome: rastit, tulostus, koko ketju
```

Selaintesti pystyttää oman staattisen palvelimen, koska `file://`-sivulla
selaimen muisti ei toimi ja jokainen rastiväite olisi vihreä syyttä. Se ajaa
myös ketjun päästä päähän: generaattori tekee koodin sisällön ja sivu purkaa
sen takaisin listaksi.

Kuvat silmälle: `TL_KUVA=/polku/etuliite node testit/t_lista_selain.mjs`.
