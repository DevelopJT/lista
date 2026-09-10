/* TYÖKALULISTA — nopeat väitteet ilman selainta.
   Kaksi asiaa joita selaintesti ei näe yhtä tarkasti:

   1. KOODAUS JA PURKU OVAT ERI TIEDOSTOISSA. Generaattorin b64u() ja sivun
      b64uDecode() ovat toistensa käänteisfunktiot, mutta ne asuvat eri
      tiedostoissa eikä kumpikaan tunne toista. Ääkköset kulkevat kolmen
      muunnoksen läpi (UTF-8 tavut → binäärimerkkijono → base64), ja juuri
      siinä ketjussa "Rälläkkä" muuttuu roskaksi jos yksi vaihe puuttuu.
      Tässä ne ajetaan vastakkain suoraan.

   2. NIMENMUUTOKSEN ANSA. Sivu on docs/index.html, mutta service worker
      luetteloi tallennettavat tiedostot omassa listassaan. Jos lista jää
      osoittamaan vanhaan nimeen, addAll() hylkää lupauksen, asennus
      epäonnistuu — eikä mikään näy, koska verkossa sivu toimii silti.
      Vika paljastuisi vasta työmaalla katvealueella.

   Ajo:  node testit/t_lista.js */
"use strict";
const fs = require("fs"), vm = require("vm"), path = require("path");
const JUURI = path.join(__dirname, "..");

let v = 0, ok = 0;
function t(nimi, f){
  v++;
  try { f(); ok++; console.log(v + " OK  " + nimi); }
  catch(e){ console.log(v + " KAATUI  " + nimi + "\n      " + (e && e.message || e)); }
}
function on(e, m){ if (!e) throw new Error(m || "ehto"); }

/* Yksinkertainen tynkä-DOM: sivujen skriptit ajetaan latauksen tapaan, jotta
   funktiot syntyvät kontekstiin. Funktiomäärittelyt nostetaan ennen mitään
   suoritusta, joten ne ovat olemassa vaikka loppuosa kompastuisi tynkään —
   mahdollinen virhe TULOSTETAAN eikä niellä, ettei tynkä piilottaisi vikaa. */
function elementti(){
  const o = { value: "", textContent: "", innerHTML: "", hidden: false, checked: false,
              className: "", placeholder: "", defaultValue: "", style: {}, width: 0, height: 0,
              children: [], dataset: {},
              appendChild(){}, addEventListener(){}, setAttribute(){}, removeAttribute(){},
              getAttribute(){ return null; }, focus(){}, click(){},
              querySelector(){ return elementti(); }, querySelectorAll(){ return []; },
              getContext(){ return { fillStyle:"", fillRect(){}, drawImage(){} }; },
              toDataURL(){ return "data:image/png;base64,"; } };
  o.classList = { add(){}, remove(){}, toggle(){}, contains(){ return false; } };
  return o;
}
function konteksti(tiedosto){
  const lahde = fs.readFileSync(path.join(JUURI, tiedosto), "utf8");
  let koodi = "", re = /<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g, m;
  while ((m = re.exec(lahde))) koodi += m[1] + "\n";
  const solut = {};
  const ctx = {
    console, Math, JSON, String, Number, Array, Object, RegExp, Error, isNaN, Date,
    parseInt, parseFloat, encodeURIComponent, decodeURIComponent, Promise, Set, Map, Buffer,
    setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0,
    TextEncoder, TextDecoder, atob, btoa,
    localStorage: { _: {}, getItem(k){ return k in this._ ? this._[k] : null; },
                    setItem(k, x){ this._[k] = String(x); },
                    removeItem(k){ delete this._[k]; }, clear(){ this._ = {}; },
                    key(i){ return Object.keys(this._)[i] ?? null; },
                    get length(){ return Object.keys(this._).length; } },
    location: { hash: "", href: "http://testi/", search: "", protocol: "http:", hostname: "127.0.0.1" },
    navigator: { userAgent: "node" },
    addEventListener(){}, removeEventListener(){}, print(){},
    document: { getElementById(id){ return solut[id] || (solut[id] = elementti()); },
                querySelector(){ return elementti(); }, querySelectorAll(){ return []; },
                createElement(){ return elementti(); }, addEventListener(){},
                body: elementti(), documentElement: elementti(), title: "" }
  };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
  vm.createContext(ctx);
  try { vm.runInContext(koodi, ctx, { filename: tiedosto }); }
  catch(e){ console.log("      (huom: " + tiedosto + " keskeytyi tyngässä: " + e.message + ")"); }
  return ctx;
}

const sivu = konteksti("docs/index.html");
const gen = konteksti("tyokalut/generaattori.html");

console.log("--- koodaus ja purku ---");

t("molemmat funktiot syntyivät", function(){
  on(typeof gen.b64u === "function", "generaattorin b64u puuttuu");
  on(typeof sivu.b64uDecode === "function", "sivun b64uDecode puuttuu");
});

t("ÄÄKKÖSET kulkevat koodauksen läpi ehjinä", function(){
  const lista = { v: 1, t: "Työkalut kattotöihin", i: ["Rälläkkä", "Suojalasit", "Ruuvit 4,2 × 25", "Mittanauha 5 m"] };
  const purettu = JSON.parse(sivu.b64uDecode(gen.b64u(JSON.stringify(lista))));
  on(purettu.t === lista.t, "otsikko muuttui: " + purettu.t);
  on(purettu.i.join("|") === lista.i.join("|"), "rivit muuttuivat: " + purettu.i.join("|"));
});

t("base64url ei sisällä osoitteessa hankalia merkkejä", function(){
  // + / = katkaisisivat osoitteen tai vaatisivat prosenttikoodauksen.
  const koodi = gen.b64u(JSON.stringify({ v: 1, t: "Ä?/+=", i: ["a".repeat(200)] }));
  on(!/[+/=]/.test(koodi), "koodissa on hankalia merkkejä: " + koodi.slice(0, 40));
});

t("rikkinäinen koodi ei heitä ulos vaan tunnistetaan", function(){
  let heitti = false;
  try { JSON.parse(sivu.b64uDecode("ei-oikeaa-dataa!!!")); } catch (e) { heitti = true; }
  on(heitti, "roskadata meni läpi kelvollisena");
});

console.log("--- neljä osiota (v2) ---");

t("v2-koodi kantaa kaikki neljä osiota ehjinä", function(){
  const tyo = { v: 2, t: "Kattoluukku", i: ["Rälläkkä"], osat: ["Tiiviste 60 mm"],
                huom: ["Katto liukas sateella."], ohje: ["Katkaise virta.", "Irrota pelti."] };
  const p = JSON.parse(sivu.b64uDecode(gen.b64u(JSON.stringify(tyo))));
  on(p.v === 2, "versio: " + p.v);
  on(p.osat.join("|") === tyo.osat.join("|"), "varaosat: " + p.osat);
  on(p.huom.join("|") === tyo.huom.join("|"), "huomiot: " + p.huom);
  on(p.ohje.join("|") === tyo.ohje.join("|"), "ohjeet: " + p.ohje);
});

t("osioiden nimet ovat lyhyitä: koodiin ei kirjoiteta pitkiä avaimia", function(){
  // Jokainen avain toistuu koodissa kerran ja syö tilaa listan sisällöltä.
  const koodi = JSON.stringify({ v: 2, t: "x", i: ["a"], osat: ["b"], huom: ["c"], ohje: ["d"] });
  on(koodi.length < 70, "tunnisteet vievät liikaa tilaa: " + koodi.length + " merkkiä");
});

console.log("--- listan tunniste (rastien avain) ---");

t("sama lista antaa saman tunnisteen, eri lista eri tunnisteen", function(){
  on(typeof sivu.listaTunnus === "function", "listaTunnus puuttuu sivulta");
  const a = gen.b64u(JSON.stringify({ v: 1, t: "Paja", i: ["Vasara", "Viila"] }));
  const b = gen.b64u(JSON.stringify({ v: 1, t: "Paja", i: ["Vasara", "Viila", "Puukko"] }));
  on(sivu.listaTunnus(a) === sivu.listaTunnus(a), "tunniste ei ole vakaa");
  on(sivu.listaTunnus(a) !== sivu.listaTunnus(b), "lisätty rivi ei vaihtanut tunnistetta");
  on(/^[0-9a-z]{4,16}$/.test(sivu.listaTunnus(a)), "tunniste ei ole lyhyt merkkijono: " + sivu.listaTunnus(a));
});

console.log("--- tiedostot ja nimet ---");

t("julkaistava kansio sisältää sivun ja työntekijän", function(){
  on(fs.existsSync(path.join(JUURI, "docs/index.html")), "docs/index.html puuttuu");
  on(fs.existsSync(path.join(JUURI, "docs/sw.js")), "docs/sw.js puuttuu");
  on(!fs.existsSync(path.join(JUURI, "docs/lista.html")), "vanha lista.html jäi julkaistavaan kansioon");
});

t("SERVICE WORKER osoittaa oikeaan tiedostoon", function(){
  const sw = fs.readFileSync(path.join(JUURI, "docs/sw.js"), "utf8");
  on(sw.indexOf("lista.html") < 0, "sw.js viittaa yhä nimeen lista.html — asennus epäonnistuisi hiljaa");
  on(/CORE\s*=\s*\[[^\]]*\.\/(index\.html|)["']/.test(sw) || sw.indexOf('"./"') >= 0 || sw.indexOf("'./'") >= 0,
     "sw.js ei tallenna sivua omalla nimellään");
});

t("generaattoria ei julkaista", function(){
  on(!fs.existsSync(path.join(JUURI, "docs/generaattori.html")), "generaattori päätyi julkaistavaan kansioon");
  const gl = fs.readFileSync(path.join(JUURI, "tyokalut/generaattori.html"), "utf8");
  on(gl.length > 10000, "generaattori näyttää tyhjältä");
});

t("Tailscale-osoitetta ei ole missään: työkumppanit eivät ole siinä verkossa", function(){
  ["docs/index.html", "docs/sw.js", "tyokalut/generaattori.html"].forEach(function(f){
    const s = fs.readFileSync(path.join(JUURI, f), "utf8");
    on(s.indexOf("esimerkki") < 0 && s.indexOf("palvelin") < 0, f + " viittaa Pi:hin");
  });
});

t("sivu ei lupaa alaviitteessään enempää kuin pitää", function(){
  const s = fs.readFileSync(path.join(JUURI, "docs/index.html"), "utf8");
  const a = s.indexOf('id="foot"'), b = s.indexOf("</footer>", a);
  const teksti = a < 0 ? "" : s.slice(a, b);
  on(teksti.indexOf("palvelime") >= 0, "alaviite ei kerro ettei palvelimelle mene mitään");
  on(/rasti/i.test(teksti), "alaviite ei kerro että rastit jäävät puhelimeen");
});

console.log("\n" + ok + "/" + v + " läpi");
process.exit(ok === v ? 0 : 1);
