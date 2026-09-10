/* TYÖKALULISTA oikeassa selaimessa. Kaksi sivua, yksi ketju:
   tyokalut/generaattori.html tekee QR-koodin sisällön, docs/index.html piirtää
   sen listaksi. Testi ajaa molemmat ja kulkee ketjun läpi päästä päähän —
   pelkkä kummankin pään erillinen testi ei näkisi sitä, jos koodaus ja purku
   ajautuvat erilleen.

   Miksi oikea selain eikä vain node: rastien säilyminen on localStoragea,
   tulostusasettelu on @media print, ja työkalun nimen pääsy HTML:ksi näkyy
   vasta oikeassa DOM:issa. Mikään näistä ei ole olemassa tynkä-DOM:issa.

   Miksi oma palvelin eikä file://: Chrome antaa file://-sivulle läpinäkymättömän
   alkuperän, jolloin localStorage heittää poikkeuksen ja jokainen rastiväite
   olisi vihreä syyttä (ansa: testi mittaisi ympäristöä eikä koodia).

   Ajo:  node testit/t_lista_selain.mjs
   Kuvat silmälle:  TL_KUVA=/polku/etuliite node testit/t_lista_selain.mjs */
import { avaaSelain } from "./cdp.mjs";
import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { join, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const JUURI = join(dirname(fileURLToPath(import.meta.url)), "..");
const PORTTI = Number(process.env.TL_PORTTI || 8931);
const OSOITE = "http://127.0.0.1:" + PORTTI;
const TYYPIT = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
                 ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8" };

const palvelin = createServer((pyynto, vastaus) => {
  const polku = decodeURIComponent(pyynto.url.split("?")[0].split("#")[0]);
  if (polku.indexOf("..") >= 0) { vastaus.writeHead(403); return vastaus.end("ei"); }
  const tiedosto = join(JUURI, polku === "/" ? "/docs/index.html" : polku);
  if (!existsSync(tiedosto)) { vastaus.writeHead(404); return vastaus.end("ei loytynyt"); }
  vastaus.writeHead(200, {
    "Content-Type": TYYPIT[extname(tiedosto)] || "application/octet-stream",
    "Cache-Control": "no-store",
    // Service worker saa scopekseen koko sivuston, kuten GitHub Pagesissa.
    "Service-Worker-Allowed": "/"
  });
  vastaus.end(readFileSync(tiedosto));
});
await new Promise(r => palvelin.listen(PORTTI, "127.0.0.1", r));

let v = 0, ok = 0;
async function t(nimi, f){
  v++;
  try { await f(); ok++; console.log(v + " OK  " + nimi); }
  catch(e){ console.log(v + " KAATUI  " + nimi + "\n      " + (e && e.message || e)); }
}
function on(e, m){ if (!e) throw new Error(m || "ehto"); }

const s = await avaaSelain({ leveys: 420, korkeus: 900 });

/* Sama koodaus kuin generaattorissa. Kirjoitettu tänne KÄSIN eikä tuotu
   sivulta: jos molemmat lukisivat samaa toteutusta, testi ei näkisi sitä
   hetkeä jona koodaus muuttuu ja purku jää jälkeen. Ketjutesti alempana
   käyttää oikeaa generaattoria ja vartioi saman asian toisesta suunnasta. */
function b64u(str){
  return Buffer.from(str, "utf8").toString("base64")
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function hash(otsikko, rivit){ return "#" + b64u(JSON.stringify({ v: 1, t: otsikko, i: rivit })); }
/* v2 = neljä osiota (Jari 10.9.2026). Vanha v1 jää voimaan: jo tulostettu
   tarra ei saa lakata toimimasta siksi, että generaattori sai uusia kenttiä. */
function hash2(o){ return "#" + b64u(JSON.stringify(Object.assign({ v: 2 }, o))); }

const LISTA_A = ["Vasara", "Jakoavain", "Mittanauha 5 m"];
const LISTA_B = ["Rälläkkä", "Suojalasit"];
const A = OSOITE + "/docs/index.html" + hash("Perustyökalut", LISTA_A);
const B = OSOITE + "/docs/index.html" + hash("Katkaisu", LISTA_B);

/* TUORE DOKUMENTTI, ei Page.reload. Selain palauttaa lomakekenttien arvot
   latauksessa itse, ja se teki osoitteen muistamisesta vihreän testin ilman
   riviäkään toteutusta. Tyhjän sivun kautta kiertäminen pakottaa uuden
   dokumentin, jolloin arvo voi tulla vain koodin omasta muistista. */
async function tuoreLataus(url){
  await s.avaa("about:blank");
  await s.avaa(url);
}
const TILA = `(function(){
  var ruudut = Array.prototype.slice.call(document.querySelectorAll('input[type=checkbox]'));
  return { otsikko: (document.querySelector('h1') || {}).textContent || '',
           rivit: Array.prototype.slice.call(document.querySelectorAll('li .txt')).map(function(e){ return e.textContent; }),
           rastit: ruudut.map(function(r){ return r.checked; }),
           laskuri: (document.querySelector('.progress') || {}).textContent || '' };
})()`;

await t("lista piirtyy koodista: otsikko, rivit ja laskuri", async () => {
  await s.avaa(A);
  const r = await s.arvioi(TILA);
  on(r.otsikko === "Perustyökalut", "otsikko: " + r.otsikko);
  on(r.rivit.join("|") === LISTA_A.join("|"), "rivit: " + r.rivit.join("|"));
  on(r.laskuri === "0 / 3 kerätty", "laskuri: " + r.laskuri);
  if (process.env.TL_KUVA) await s.kuva(process.env.TL_KUVA + "-lista.png");
});

await t("RASTIT SÄILYVÄT puhelimessa sivun latauksen yli", async () => {
  await s.napautaValitsinta("input[type=checkbox]", 0);
  await s.napautaValitsinta("input[type=checkbox]", 2);
  let r = await s.arvioi(TILA);
  on(r.laskuri === "2 / 3 kerätty", "laskuri ennen latausta: " + r.laskuri);
  await tuoreLataus(A);
  r = await s.arvioi(TILA);
  on(r.rastit.join(",") === "true,false,true", "rastit latauksen jälkeen: " + r.rastit.join(","));
  on(r.laskuri === "2 / 3 kerätty", "laskuri latauksen jälkeen: " + r.laskuri);
});

await t("toinen lista on oma: eri sisältö alkaa tyhjänä eikä syö ensimmäisen tilaa", async () => {
  await s.avaa(B);
  let r = await s.arvioi(TILA);
  on(r.rivit.join("|") === LISTA_B.join("|"), "toisen listan rivit: " + r.rivit.join("|"));
  on(r.rastit.join(",") === "false,false", "toinen lista ei alkanut tyhjänä: " + r.rastit.join(","));
  await s.napautaValitsinta("input[type=checkbox]", 0);
  await s.avaa(A);
  r = await s.arvioi(TILA);
  on(r.rastit.join(",") === "true,false,true", "ensimmäisen listan rastit muuttuivat: " + r.rastit.join(","));
});

await t("Tyhjennä valinnat pyyhkii myös muistin", async () => {
  /* Esiehto ääneen: ilman sitä tämä olisi vihreä myös silloin kun mitään ei
     talleteta lainkaan — tyhjän tilan tyhjentäminen onnistuu aina. */
  let r = await s.arvioi(TILA);
  on(r.rastit.indexOf(true) >= 0, "esiehto: mitään ei ollut rastittuna");
  await s.napautaValitsinta("button.secondary");
  r = await s.arvioi(TILA);
  on(r.laskuri === "0 / 3 kerätty", "tyhjennys ei vaikuttanut: " + r.laskuri);
  await tuoreLataus(A);
  r = await s.arvioi(TILA);
  on(r.rastit.join(",") === "false,false,false", "rastit palasivat muistista: " + r.rastit.join(","));
});

await t("työkalun nimi ei päädy HTML:ksi", async () => {
  await s.avaa(OSOITE + "/docs/index.html" + hash("<b>Paja</b>", ['<img src=x onerror="window.__paha=1">', "Viila"]));
  const r = await s.arvioi(`(function(){
    return { kuvia: document.querySelectorAll('li img, h1 b').length,
             teksti: (document.querySelector('li .txt') || {}).textContent || '',
             otsikko: (document.querySelector('h1') || {}).textContent || '',
             paha: !!window.__paha };
  })()`);
  on(r.kuvia === 0, "merkkaus pääsi läpi: " + r.kuvia + " elementtiä");
  on(!r.paha, "onerror ehti ajaa");
  on(r.teksti.indexOf("<img") === 0, "teksti ei ole raakana: " + r.teksti);
  on(r.otsikko === "<b>Paja</b>", "otsikko: " + r.otsikko);
});

await t("ilman koodia sivu kertoo sen eikä näytä tyhjää listaa", async () => {
  await s.avaa(OSOITE + "/docs/index.html");
  const r = await s.arvioi(`(function(){
    return { ruutuja: document.querySelectorAll('input[type=checkbox]').length,
             teksti: document.body.textContent.indexOf('Ei listaa') >= 0,
             alaviite: document.getElementById('foot').hidden };
  })()`);
  on(r.ruutuja === 0, "tyhjä lista piirtyi silti");
  on(r.teksti, "ilmoitus puuttuu");
  on(r.alaviite, "alaviite jäi näkyviin ilman listaa");
});

await t("rikkinäinen koodi ei kaada sivua", async () => {
  await s.avaa(OSOITE + "/docs/index.html#ei-tavallinen-base64!!!");
  const r = await s.arvioi(`document.body.textContent.indexOf('Ei listaa') >= 0`);
  on(r === true, "rikkinäinen koodi ei tuottanut ilmoitusta");
});

await t("tulostuksessa napit ja alaviite jäävät pois", async () => {
  await s.avaa(A);
  await s.laheta("Emulation.setEmulatedMedia", { media: "print" });
  const r = await s.arvioi(`(function(){
    var nappi = document.querySelector('.actions'), foot = document.getElementById('foot');
    var ruutu = document.querySelector('input[type=checkbox]');
    return { napit: getComputedStyle(nappi).display, foot: getComputedStyle(foot).display,
             ruutuNakyy: !!(ruutu && ruutu.getBoundingClientRect().width > 0) };
  })()`);
  await s.laheta("Emulation.setEmulatedMedia", { media: "" });
  on(r.napit === "none", "napit näkyvät tulosteessa: " + r.napit);
  on(r.foot === "none", "alaviite näkyy tulosteessa: " + r.foot);
  on(r.ruutuNakyy, "rastiruudut katosivat tulosteesta");
});

console.log("--- neljä osiota ---");

const TYO = OSOITE + "/docs/index.html" + hash2({
  t: "Kattoluukun tiiviste",
  i: ["Rälläkkä", "Mittanauha 5 m"],
  osat: ["Ruuvit 4,2 × 25", "Tiiviste 60 mm"],
  huom: ["Katto on liukas sateella.", "Virta pois ennen aloitusta."],
  ohje: ["Katkaise virta.", "Irrota suojapelti.", "Vaihda tiiviste."]
});
const OSIOT_TYHJA = OSOITE + "/docs/index.html" + hash2({
  t: "Vain kaksi", i: ["Vasara"], osat: [], huom: [], ohje: ["Lyö."]
});
const OSIOT = `(function(){
  return Array.prototype.map.call(document.querySelectorAll('.osio'), function(o){
    var ots = o.querySelector('.osio-otsikko');
    return { otsikko: ots ? ots.textContent : '',
             laskuri: (o.querySelector('.osio-laskuri') || {}).textContent || '',
             ruutuja: o.querySelectorAll('input[type=checkbox]').length,
             rivit: Array.prototype.map.call(o.querySelectorAll('li .txt, li'), function(e){ return e.textContent.trim(); }),
             numeroitu: !!o.querySelector('ol'),
             luokat: o.className };
  });
})()`;

await t("neljä osiota piirtyy järjestyksessä huomiot, työkalut, varaosat, työohjeet", async () => {
  await s.avaa(TYO);
  const o = await s.arvioi(OSIOT);
  on(o.length === 4, "osioita " + o.length);
  const otsikot = o.map(x => x.otsikko.toLowerCase().replace(/[^a-zäö]/g, ""));
  on(/huomio/.test(otsikot[0]), "1. osio ei ole huomiot: " + o[0].otsikko);
  on(/kalu/.test(otsikot[1]), "2. osio ei ole työkalut: " + o[1].otsikko);
  on(/osa/.test(otsikot[2]), "3. osio ei ole varaosat: " + o[2].otsikko);
  on(/ohje/.test(otsikot[3]), "4. osio ei ole työohjeet: " + o[3].otsikko);
  if (process.env.TL_KUVA) await s.kuva(process.env.TL_KUVA + "-osiot.png");
});

await t("rastit vain keräysosioissa; huomiot ja ohjeet luetaan", async () => {
  const o = await s.arvioi(OSIOT);
  on(o[0].ruutuja === 0, "huomioissa on rastiruutuja: " + o[0].ruutuja);
  on(o[1].ruutuja === 2, "työkaluissa ruutuja " + o[1].ruutuja);
  on(o[2].ruutuja === 2, "varaosissa ruutuja " + o[2].ruutuja);
  on(o[3].ruutuja === 0, "ohjeissa on rastiruutuja: " + o[3].ruutuja);
});

await t("työohjeet numeroidaan itse, huomiot erottuvat varoituksena", async () => {
  const o = await s.arvioi(OSIOT);
  on(o[3].numeroitu, "ohjeet eivät ole numeroitu lista");
  on(/huomio|varoitus/.test(o[0].luokat), "huomiolohkolta puuttuu oma luokka: " + o[0].luokat);
  const vari = await s.arvioi(`(function(){
    var h = document.querySelector('.osio.huomio'); if (!h) return "ei lohkoa";
    var t = getComputedStyle(h);
    return { tausta: t.backgroundColor, reuna: t.borderLeftWidth + " " + t.borderLeftColor };
  })()`);
  on(typeof vari === "object" && vari.reuna !== "0px", "varoituslaatikolla ei ole korostusta: " + JSON.stringify(vari));
});

await t("laskuri per osio ja yhteensä ylhäällä", async () => {
  const o = await s.arvioi(OSIOT);
  on(o[1].laskuri === "0 / 2", "työkalujen laskuri: " + o[1].laskuri);
  on(o[2].laskuri === "0 / 2", "varaosien laskuri: " + o[2].laskuri);
  on(o[0].laskuri === "" && o[3].laskuri === "", "luettavissa osioissa on laskuri");
  const ylin = await s.arvioi(`(document.querySelector('.progress')||{}).textContent`);
  on(ylin === "0 / 4 kerätty", "yhteislaskuri: " + ylin);
});

await t("RASTIT ERIKSEEN kummassakin keräysosiossa ja säilyvät latauksen yli", async () => {
  await s.napautaValitsinta(".osio input[type=checkbox]", 1);   // työkaluista toinen
  await s.napautaValitsinta(".osio input[type=checkbox]", 2);   // varaosista ensimmäinen
  let ylin = await s.arvioi(`(document.querySelector('.progress')||{}).textContent`);
  on(ylin === "2 / 4 kerätty", "yhteislaskuri rastien jälkeen: " + ylin);
  await tuoreLataus(TYO);
  const r = await s.arvioi(`Array.prototype.map.call(document.querySelectorAll('.osio input[type=checkbox]'), function(e){ return e.checked; }).join(',')`);
  on(r === "false,true,true,false", "rastit latauksen jälkeen: " + r);
  const o = await s.arvioi(OSIOT);
  on(o[1].laskuri === "1 / 2" && o[2].laskuri === "1 / 2", "osiolaskurit: " + o[1].laskuri + " / " + o[2].laskuri);
});

await t("tyhjät osiot jäävät kokonaan pois", async () => {
  await s.avaa(OSIOT_TYHJA);
  const o = await s.arvioi(OSIOT);
  on(o.length === 2, "osioita " + o.length + ": " + o.map(x => x.otsikko).join(", "));
  on(/kalu/.test(o[0].otsikko.toLowerCase()) && /ohje/.test(o[1].otsikko.toLowerCase()),
     "väärät osiot: " + o.map(x => x.otsikko).join(", "));
});

await t("VANHA KOODI toimii yhä eikä näytä turhaa osio-otsikkoa", async () => {
  await s.avaa(A);
  const o = await s.arvioi(OSIOT);
  const r = await s.arvioi(TILA);
  on(r.rivit.join("|") === LISTA_A.join("|"), "vanha lista ei piirry: " + r.rivit.join("|"));
  on(o.length === 0 || o.every(x => !x.otsikko), "yhden listan koodi sai turhan osio-otsikon");
  on(r.laskuri === "0 / 3 kerätty", "vanhan koodin laskuri: " + r.laskuri);
});

console.log("--- generaattori ---");

const GEN = OSOITE + "/tyokalut/generaattori.html";

await t("generaattori ei tarjoa yksityisverkon osoitetta oletuksena", async () => {
  /* Osoitteen MUOTO eikä oma konenimi: tämä varasto on julkinen. */
  await s.avaa(GEN);
  await s.arvioi(`localStorage.clear()`);
  await tuoreLataus(GEN);
  const r = await s.arvioi(`(function(){
    var k = document.getElementById('viewerUrl'), lahde = document.documentElement.outerHTML;
    return { arvo: k.value, vihje: k.placeholder,
             yksityinen: ['ts.net', '.local', '192.168.', '10.0.'].filter(function(x){ return lahde.indexOf(x) >= 0; }).join(',') };
  })()`);
  on(r.arvo === "", "osoitekentässä on oletusarvo: " + r.arvo);
  on(r.yksityinen === "", "yksityisverkon osoite on yhä lähdekoodissa: " + r.yksityinen);
  on(/github\.io|https:\/\//.test(r.vihje), "vihjeteksti ei kerro osoitteen muotoa: " + r.vihje);
});

await t("OSOITE MUISTETAAN seuraavaan kertaan", async () => {
  await s.arvioi(`(function(){
    var k = document.getElementById('viewerUrl');
    k.value = "https://esimerkki.github.io/lista/";
    k.dispatchEvent(new Event('input', {bubbles:true}));
  })()`);
  await s.nuku(400);
  await tuoreLataus(GEN);
  const arvo = await s.arvioi(`document.getElementById('viewerUrl').value`);
  on(arvo === "https://esimerkki.github.io/lista/", "osoite ei säilynyt: " + arvo);
});

await t("TARRAN TEKSTIRIVI on vapaa kenttä: näkyy esikatselussa ja tulosteessa", async () => {
  await s.arvioi(`(function(){
    var k = document.getElementById('labelnote');
    k.value = "Palauta laatikkoon – Jari 040 000 0000";
    k.dispatchEvent(new Event('input', {bubbles:true}));
  })()`);
  await s.nuku(400);
  const r = await s.arvioi(`(function(){
    var esi = document.getElementById('labelnotePreview'), tulos = document.getElementById('printNote');
    return { esikatselu: esi ? esi.textContent : null, tuloste: tulos ? tulos.textContent : null,
             oletus: document.getElementById('labelnote').defaultValue };
  })()`);
  on(r.esikatselu === "Palauta laatikkoon – Jari 040 000 0000", "esikatselu: " + r.esikatselu);
  on(r.tuloste === "Palauta laatikkoon – Jari 040 000 0000", "tuloste: " + r.tuloste);
  on((r.oletus || "").length > 0, "kentällä ei ole oletustekstiä");
});

await t("tyhjä tekstirivi ei jätä tyhjää palkkia tarraan", async () => {
  await s.arvioi(`(function(){
    var k = document.getElementById('labelnote');
    k.value = "   ";
    k.dispatchEvent(new Event('input', {bubbles:true}));
  })()`);
  await s.nuku(400);
  const r = await s.arvioi(`(function(){
    var esi = document.getElementById('labelnotePreview'), tulos = document.getElementById('printNote');
    return { esi: esi.hidden || getComputedStyle(esi).display === 'none',
             tulos: tulos.hidden || getComputedStyle(tulos).display === 'none' };
  })()`);
  on(r.esi && r.tulos, "tyhjä rivi jäi näkyviin: " + JSON.stringify(r));
});

await t("esikatselulinkki osoittaa oikeaan tiedostoon", async () => {
  /* Generaattori muutti asuinpaikkaa (tyokalut/) ja sivu nimeä (docs/index.html).
     Suhteellinen linkki vanhaan naapuritiedostoon jäisi 404:ksi, eikä se näy
     mistään muusta kuin siitä että linkki ei aukea. */
  const r = await s.arvioi(`(function(){
    var a = document.getElementById('previewlink');
    return { href: a.getAttribute('href'), naytetaan: !document.getElementById('previewline').hidden };
  })()`);
  on(r.naytetaan, "esikatselurivi on piilossa sivutilassa");
  on(r.href.indexOf("../docs/index.html#") === 0, "linkki osoittaa väärään tiedostoon: " + r.href);
  const vastaus = await fetch(OSOITE + "/docs/index.html", { method: "HEAD" });
  on(vastaus.ok, "linkin kohde ei vastaa: " + vastaus.status);
  if (process.env.TL_KUVA) await s.kuva(process.env.TL_KUVA + "-generaattori.png");
});

await t("KETJU: generaattorin koodi purkautuu sivulla samaksi listaksi", async () => {
  const sisalto = await s.arvioi(`(function(){
    document.getElementById('viewerUrl').value = ${JSON.stringify(OSOITE + "/docs/index.html")};
    document.getElementById('title').value = "Katolle";
    document.getElementById('items').value = "Turvavaljaat\\nAkkuporakone + terät\\nRuuvit 4,2 × 25";
    ['viewerUrl','title','items'].forEach(function(id){
      document.getElementById(id).dispatchEvent(new Event('input', {bubbles:true}));
    });
    return qrContent();
  })()`);
  await s.nuku(400);
  on(sisalto.indexOf(OSOITE + "/docs/index.html#") === 0, "koodin sisältö: " + sisalto.slice(0, 80));
  await s.avaa(sisalto);
  const r = await s.arvioi(TILA);
  on(r.otsikko === "Katolle", "otsikko ketjun päässä: " + r.otsikko);
  on(r.rivit.join("|") === "Turvavaljaat|Akkuporakone + terät|Ruuvit 4,2 × 25",
     "rivit ketjun päässä: " + r.rivit.join("|"));
});

await t("GENERAATTORI: varaosat, huomioitavaa ja työohjeet päätyvät koodiin", async () => {
  await s.avaa(GEN);
  const sisalto = await s.arvioi(`(function(){
    document.getElementById('viewerUrl').value = ${JSON.stringify(OSOITE + "/docs/index.html")};
    document.getElementById('title').value = "Kattoluukku";
    document.getElementById('items').value = "Rälläkkä";
    document.getElementById('parts').value = ["Tiiviste 60 mm", "Ruuvit 4,2 × 25"].join(String.fromCharCode(10));
    document.getElementById('notes').value = "Katto liukas sateella.";
    document.getElementById('steps').value = ["Katkaise virta.", "Irrota suojapelti."].join(String.fromCharCode(10));
    ['viewerUrl','title','items','parts','notes','steps'].forEach(function(id){
      document.getElementById(id).dispatchEvent(new Event('input', {bubbles:true}));
    });
    return qrContent();
  })()`);
  await s.nuku(400);
  await s.avaa(sisalto);
  const o = await s.arvioi(OSIOT);
  on(o.length === 4, "ketjun päässä osioita " + o.length);
  on(o[2].rivit.join("|").indexOf("Tiiviste 60 mm") >= 0, "varaosat eivät tulleet läpi: " + o[2].rivit.join("|"));
  on(o[0].rivit.join(" ").indexOf("liukas") >= 0, "huomiot eivät tulleet läpi: " + o[0].rivit.join(" "));
  on(o[3].rivit.join(" ").indexOf("suojapelti") >= 0, "ohjeet eivät tulleet läpi: " + o[3].rivit.join(" "));
});

await t("tyhjä osio ei kasvata koodia", async () => {
  await s.avaa(GEN);
  const koot = await s.arvioi(`(function(){
    function aseta(o){
      Object.keys(o).forEach(function(id){
        document.getElementById(id).value = o[id];
        document.getElementById(id).dispatchEvent(new Event('input', {bubbles:true}));
      });
    }
    document.getElementById('viewerUrl').value = "https://x.io/l/";
    aseta({ title:"T", items:"Vasara", parts:"", notes:"", steps:"" });
    var vain = qrContent().length;
    aseta({ parts:"Ruuvi" });
    var kanssa = qrContent().length;
    return { vain: vain, kanssa: kanssa };
  })()`);
  on(koot.kanssa > koot.vain, "varaosien lisäys ei näy koodissa lainkaan");
  on(koot.vain < 120, "tyhjät osiot kasvattavat koodia turhaan: " + koot.vain + " merkkiä");
});

await t("tekstitila ei sisällä osoitetta lainkaan", async () => {
  await s.avaa(GEN);
  const sisalto = await s.arvioi(`(function(){
    document.getElementById('title').value = "Katolle";
    document.getElementById('items').value = "Turvavaljaat\\nRuuvit";
    document.querySelector('input[name=mode][value=text]').checked = true;
    document.querySelector('input[name=mode][value=text]').dispatchEvent(new Event('change', {bubbles:true}));
    return qrContent();
  })()`);
  on(sisalto.indexOf("http") < 0, "tekstitilassa on osoite: " + sisalto);
  on(sisalto.indexOf("Turvavaljaat") >= 0 && sisalto.indexOf("Katolle") >= 0, "lista puuttuu: " + sisalto);
});

console.log("\n" + ok + "/" + v + " läpi");
await s.sulje();
palvelin.close();
process.exit(ok === v ? 0 : 1);
