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

Tämä on jo tehty osoitteeseen `https://developjt.github.io/lista/`. Ohje on
tallessa siltä varalta, että sama tehdään joskus uudestaan.

1. Luo **julkinen** varasto ja työnnä sisältö. GitHubin komentorivi hoitaa
   varaston luonnin, etäosoitteen ja työnnön yhdellä kertaa:

   ```sh
   cd ~/Tyokalulista
   git init -b main && git add -A && git commit -m "Työkalulista"
   gh repo create lista --public --source=. --remote=origin --push
   ```

   Julkinen varasto on maksuttoman Pagesin ehto. Mitään salaista täällä ei ole:
   sivu on pelkkä piirtäjä ilman dataa.

2. **Jos työntö torjutaan sähköpostin takia**, GitHub suojaa yksityistä
   osoitettasi. Vaihda tälle varastolle GitHubin oma noreply-osoite ja korjaa
   tehty commit:

   ```sh
   git config user.email "$(gh api user --jq '.id')+<tunnus>@users.noreply.github.com"
   git commit --amend --reset-author --no-edit
   git push -u origin main
   ```

   Asetus koskee vain tätä varastoa, joten muut projektit säilyvät ennallaan.

3. Kytke Pages päälle. Selaimesta **Settings → Pages → Source: Deploy from a
   branch → main → /docs**, tai komentoriviltä:

   ```sh
   gh api -X POST repos/<tunnus>/lista/pages -f "source[branch]=main" -f "source[path]=/docs"
   ```

   Haaran on oltava GitHubissa ennen tätä, muuten komento vastaa virheellä.
   Osoite alkaa vastata noin minuutin kuluttua.

4. Avaa `tyokalut/generaattori.html` koneelta ja kirjoita osoite
   osoitekenttään. Generaattori muistaa sen jatkossa.

Myöhemmät muutokset menevät perille komennolla `sh tyokalut/julkaise.sh`. Se ajaa
testit ensin eikä julkaise punaisena.

## Neljä osiota

Koodi voi kantaa neljä osiota. Kirjoita vain ne joita tarvitset: tyhjä osio
jää kokonaan pois eikä vie tilaa koodista.

| Osio | Mitä siihen | Miten näkyy |
|---|---|---|
| Huomioitavaa | varoitukset ja muistettavat | keltainen laatikko ylimpänä, luetaan ennen muuta |
| Työkalut | mitä otetaan mukaan | rastitettava lista, oma laskuri |
| Varaosat | mitä tarvitaan paikalle | rastitettava lista, oma laskuri |
| Työohjeet | askeleet järjestyksessä | numeroitu lista, sivu numeroi itse |

Järjestys on kiinteä: huomiot ensin, koska varoitus luetaan ennen kuin mitään
aloitetaan. Ohjeisiin ei kirjoiteta numeroita käsin. Väliin lisätty askel
numeroituu itsestään oikein, eikä vanhoja rivejä tarvitse korjata.

Jos koodissa on vain työkalulista, sivu piirtää sen ilman osio-otsikkoa
täsmälleen kuten ennen osioita.

## Listan tekeminen

1. Avaa `tyokalut/generaattori.html`.
2. Kirjoita otsikko ja ne osiot joita tarvitset, yksi rivi per työkalu, varaosa,
   huomio tai askel.
3. Kirjoita **tarran tekstirivi**, jos haluat. Se tulostuu koodin alle ja on
   vapaa teksti: palautusohje, numero, työmaan nimi. Tyhjänä rivi jää pois.
   Tarraan tulee vain koodi, otsikko ja tämä rivi, eivät osiot.
4. Tulosta tarra tai lataa PNG-kuva. Tarran leveys on yhdeksän senttiä ja koodi
   noin kuusi ja puoli, mikä lukeutuu luotettavasti puhelimen kameralla.

Generaattori kertoo koodin koon ja varoittaa, jos koodista tulee tiheä. Neljä
osiota kasvattaa koodia, joten pitkän työohjeen kanssa kannattaa tulostaa
isompi tarra ja kokeilla lukemista ennen liimaamista. Katto tulee vastaan noin
kolmen tuhannen merkin kohdalla, jolloin generaattori kieltäytyy ja kertoo sen.

## Mitä työkumppani näkee

Kamera avaa listan sivuksi. Huomiot ovat ylimpänä keltaisessa laatikossa.
Työkalut ja varaosat rastitetaan kerätessä, ja kummallakin on oma laskuri sekä
yhteinen laskuri sivun yläreunassa. Työohjeet ovat numeroituina askeleina.

Rastit jäävät muistiin siihen puhelimeen: kesken jäänyt keruu jatkuu samasta
kohdasta, myös seuraavana päivänä. Toisen kerääjän rastit eivät näy, koska
mitään ei lähetetä palvelimelle.

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
- **Ilman sivua tulevaa varten:** generaattorin tekstitila laittaa kaikki
  osiot koodiin pelkkänä tekstinä otsikoineen. Silloin kamera näyttää sen heti
  ilman verkkoa, mutta rastitusta ja tulostusta ei ole.

## Testit

```sh
node testit/t_lista.js          # koodaus ja purku, osiot, tiedostonimet
node testit/t_lista_selain.mjs  # oikea Chrome: osiot, rastit, tulostus, ketju
```

Selaintesti pystyttää oman staattisen palvelimen, koska `file://`-sivulla
selaimen muisti ei toimi ja jokainen rastiväite olisi vihreä syyttä. Se ajaa
myös ketjun päästä päähän: generaattori tekee koodin sisällön ja sivu purkaa
sen takaisin listaksi.

Kuvat silmälle: `TL_KUVA=/polku/etuliite node testit/t_lista_selain.mjs`.
