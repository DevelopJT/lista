/* Pieni CDP-ajuri oikealle selaimelle. Ei riippuvuuksia: Nodessa on oma
   WebSocket, ja Chrome puhuu suoraan.

   MIKSI oikea selain testien lisäksi: tässä projektissa vähintään kuusi vikaa
   on löytynyt vasta kuvasta tai oikeasta napautuksesta — CSS-törmäys,
   perityt animaatiot, riippuva sisennys, conic-gradientin suunta. vm-testi
   näkee logiikan, selain näkee ruudun.

   TÄMÄ TIEDOSTO ASUU REPOSSA EIKÄ /tmp:SSÄ. Koko testikanta menetettiin
   kerran kun kone sammui: /private/tmp tyhjeni ja mukana ~1050 väitettä.
   Jos kirjoitat uuden testin, kirjoita se tänne. */
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { createConnection } from "node:net";
import { join } from "node:path";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

/* Onko portissa jo joku? Chrome ei kerro bindin epäonnistumisesta mitään
   käyttökelpoista: se vain jää vastaamatta, ja virhe näyttää siltä kuin selain
   ei käynnistyisi lainkaan. Näin kävi kerran, kun edellisen ajon SSH-tunneli
   oli jäänyt pitämään oletusporttia. */
function porttiVapaa(portti){
  return new Promise(function(ok){
    const s = createConnection({host:"127.0.0.1", port:portti});
    const paata = function(vapaa){ s.destroy(); ok(vapaa); };
    s.once("connect", function(){ paata(false); });
    s.once("error", function(){ paata(true); });
    setTimeout(function(){ paata(true); }, 500);
  });
}

export async function avaaSelain(opt = {}){
  let portti = opt.portti || 9333;
  for (let n = 0; n < 20 && !(await porttiVapaa(portti)); n++) portti++;
  const profiili = mkdtempSync(join(tmpdir(), "pilmo-chrome-"));
  const proc = spawn(CHROME, [
    "--headless=new",
    "--remote-debugging-port=" + portti,
    "--user-data-dir=" + profiili,
    "--no-first-run", "--no-default-browser-check",
    "--disable-gpu", "--hide-scrollbars",
    /* Ilman näitä kolmea headless-sivua pidetään taustalla ja setTimeout
       hidastetaan minuuttitasolle. PILMO:n idle-ajastin on 1-120 min, joten
       koko lepotilan testaus olisi mahdotonta — ja vika näyttäisi siltä
       kuin ajastin ei toimisi lainkaan. */
    "--disable-background-timer-throttling",
    "--disable-backgrounding-occluded-windows",
    "--disable-renderer-backgrounding",
    /* Video-avatarit: headless estäisi autoplayn ilman tätä, ja testi
       näyttäisi siltä kuin pallo ei pyörisi. Lippu vain LÖYSENTÄÄ
       autoplay-sääntöä, joten muihin testeihin se ei vaikuta. */
    "--autoplay-policy=no-user-gesture-required",
    "--window-size=" + (opt.leveys || 1280) + "," + (opt.korkeus || 900),
    "about:blank"
  ], { stdio: "ignore" });

  const ws = await odotaWs(portti);
  const cdp = new Cdp(ws);
  await cdp.valmis;
  await cdp.laheta("Page.enable");
  await cdp.laheta("Runtime.enable");
  // Portti talteen: /json/list on ainoa tapa NÄHDÄ toinen ikkuna — ja
  // ainoa tapa todeta että se on oikeasti sulkeutunut.
  cdp.portti = portti;
  cdp.sulje = async function(){
    try { ws.close(); } catch(e){}
    proc.kill();
    try { rmSync(profiili, {recursive:true, force:true}); } catch(e){}
  };
  return cdp;
}

async function odotaWs(portti){
  for (let i = 0; i < 100; i++){
    try {
      const v = await fetch("http://127.0.0.1:" + portti + "/json/list");
      const lista = await v.json();
      const sivu = lista.find(function(x){ return x.type === "page"; });
      if (sivu) return new WebSocket(sivu.webSocketDebuggerUrl);
    } catch(e){}
    await new Promise(function(r){ setTimeout(r, 100); });
  }
  throw new Error("Chrome ei vastannut portissa " + portti);
}

class Cdp {
  constructor(ws){
    this.ws = ws;
    this.id = 0;
    this.odottavat = new Map();
    this.kuuntelijat = new Map();
    this.valmis = new Promise(function(r){ ws.addEventListener("open", r, {once:true}); });
    const self = this;
    ws.addEventListener("message", function(e){
      const v = JSON.parse(e.data);
      if (v.id && self.odottavat.has(v.id)){
        const {ok, virhe} = self.odottavat.get(v.id);
        self.odottavat.delete(v.id);
        v.error ? virhe(new Error(v.error.message)) : ok(v.result);
      } else if (v.method){
        (self.kuuntelijat.get(v.method) || []).forEach(function(f){ f(v.params); });
      }
    });
  }
  /* Aikaraja on PAKOLLINEN eikä varovaisuutta. Kun sivu navigoi kesken
     kutsun (PILMO:n idle-vahti tekee location.replace itsekseen), suorituskonteksti
     tuhoutuu eikä vastausta tule koskaan — ilman aikarajaa testiajo jäi
     roikkumaan ikuisesti eikä tulostanut riviäkään, mikä näytti siltä kuin
     selain ei olisi käynnistynyt lainkaan. */
  laheta(method, params, ms = 15000){
    const id = ++this.id, self = this;
    return new Promise(function(ok, virhe){
      const kello = setTimeout(function(){
        self.odottavat.delete(id);
        virhe(new Error("CDP-aikaraja (" + ms + " ms): " + method));
      }, ms);
      self.odottavat.set(id, {
        ok: function(v){ clearTimeout(kello); ok(v); },
        virhe: function(e){ clearTimeout(kello); virhe(e); }
      });
      self.ws.send(JSON.stringify({id, method, params: params || {}}));
    });
  }
  kun(tapahtuma, f){
    if (!this.kuuntelijat.has(tapahtuma)) this.kuuntelijat.set(tapahtuma, []);
    this.kuuntelijat.get(tapahtuma).push(f);
  }

  /* Odota latauksen valmistumista ENNEN navigointia: Page.navigate palaa heti,
     ja ilman odotusta seuraava arvioi() lukee vanhaa sivua.

     Pelkkä tunnisteen vaihto (".../#henkilo-2" samalta sivulta) EI lataa
     dokumenttia uudelleen eikä tuota load-tapahtumaa: odotus jäisi roikkumaan
     ja testi näyttäisi kaatuvan aivan muusta syystä. Se ajetaan siksi
     hashchangena, kuten selaimessakin tapahtuu. */
  async avaa(url){
    const nyt = await this.arvioi("location.href").catch(function(){ return ""; });
    if (nyt && nyt.split("#")[0] === url.split("#")[0] && url.indexOf("#") >= 0){
      await this.arvioi("location.hash = " + JSON.stringify(url.slice(url.indexOf("#"))));
      await this.nuku(250);
      return;
    }
    const valmis = new Promise((r) => this.kun("Page.loadEventFired", r));
    await this.laheta("Page.navigate", {url});
    await Promise.race([valmis, this.nuku(20000)]);   // ei ikuista odotusta
    await this.nuku(150);
  }
  /* Kaksi yritystä: sivu voi navigoida juuri kutsun aikana, jolloin
     suorituskonteksti tuhoutuu ja Chrome vastaa virheellä tai ei ollenkaan.
     Se ei ole testin tulos vaan kilpailutilanne — uusi yritys osuu uuteen
     kontekstiin. Toinen epäonnistuminen kaataa niin kuin pitääkin. */
  async arvioi(lauseke){
    for (let yritys = 0; ; yritys++){
      try {
        const v = await this.laheta("Runtime.evaluate",
          {expression: lauseke, awaitPromise: true, returnByValue: true});
        if (v.exceptionDetails)
          throw new Error(v.exceptionDetails.exception?.description || "poikkeus: " + lauseke);
        return v.result.value;
      } catch(e){
        const ohimenevä = /aikaraja|context was destroyed|Cannot find context/i.test(e.message || "");
        if (yritys >= 1 || !ohimenevä) throw e;
        await this.nuku(400);
      }
    }
  }
  /* Oikea hiiritapahtuma eikä el.click(): napautus kulkee samaa reittiä kuin
     sormi — pointerdown/pointerup ikkunatasolle asti. el.click() ohittaisi
     juuri sen koodin jota testataan. */
  async napauta(x, y){
    const yht = {x, y, button:"left", clickCount:1, buttons:1};
    await this.laheta("Input.dispatchMouseEvent", {type:"mousePressed", ...yht});
    await this.laheta("Input.dispatchMouseEvent", {type:"mouseReleased", ...yht});
    await this.nuku(250);
  }
  async napautaValitsinta(valitsin, n = 0){
    const p = await this.arvioi(`(function(){
      var e = document.querySelectorAll(${JSON.stringify(valitsin)})[${n}];
      if (!e) return null;
      var r = e.getBoundingClientRect();
      return {x: r.left + r.width/2, y: r.top + r.height/2};
    })()`);
    if (!p) throw new Error("ei osumaa valitsimelle " + valitsin + " [" + n + "]");
    await this.napauta(p.x, p.y);
    return p;
  }
  /* Jäädytä sivun kello ENNEN latausta. PILMO:n näkymä riippuu voimakkaasti
     kellonajasta (lähtökellot klo 6-, huominen klo 15-, nukkumaanmeno illalla),
     eikä aamunäkymää muuten näe kuin aamulla. Ajetaan uuden dokumentin
     alussa, jotta myös moduulitason var-alustukset näkevät jäädytetyn ajan. */
  async jaadytaKello(iso){
    await this.laheta("Page.addScriptToEvaluateOnNewDocument", { source: `
      (function(){
        var K = Date, kiinni = new K(${JSON.stringify(iso)}).getTime();
        function V(a, b, c, d, e, f){
          if (!(this instanceof V)) return new K(kiinni).toString();
          if (arguments.length === 0) return new K(kiinni);
          if (arguments.length === 1) return new K(a);
          return new K(a, b, c === undefined ? 1 : c, d || 0, e || 0, f || 0);
        }
        V.now = function(){ return kiinni; };
        V.parse = K.parse; V.UTC = K.UTC; V.prototype = K.prototype;
        window.Date = V;
      })();
    ` });
  }

  async kuva(polku){
    const v = await this.laheta("Page.captureScreenshot", {format:"png"});
    writeFileSync(polku, Buffer.from(v.data, "base64"));
    return polku;
  }
  nuku(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }
}

/* ---------- toiset ikkunat ----------
   window.open() luo OMAN kohteensa, johon tämä yhteys ei näe. Sitä ei voi
   ohjata avaajan kautta silloin kun se on eri originissa — ja PILMO:n
   lukujärjestykset ovat juuri sitä (hiekkalaatikko antaa uniikin originin).
   Siksi kohteeseen liitytään erikseen, ja sen KATOAMINEN listalta on ainoa
   rehellinen todiste siitä että window.close() toimi. */
export async function sivut(cdp){
  const v = await fetch("http://127.0.0.1:" + cdp.portti + "/json/list");
  return (await v.json()).filter(function(x){ return x.type === "page"; });
}

export async function onkoSivua(cdp, urlOsa){
  return (await sivut(cdp)).some(function(x){ return (x.url || "").indexOf(urlOsa) >= 0; });
}

export async function liitaSivuun(cdp, urlOsa, ms = 6000){
  const loppu = Date.now() + ms;
  for (;;){
    const kohde = (await sivut(cdp)).find(function(x){
      return (x.url || "").indexOf(urlOsa) >= 0; });
    if (kohde){
      const ws = new WebSocket(kohde.webSocketDebuggerUrl);
      const uusi = new Cdp(ws);
      await uusi.valmis;
      await uusi.laheta("Page.enable");
      await uusi.laheta("Runtime.enable");
      uusi.portti = cdp.portti;
      uusi.sulje = async function(){ try { ws.close(); } catch(e){} };
      return uusi;
    }
    if (Date.now() > loppu) throw new Error("kohdetta ei löytynyt: " + urlOsa);
    await new Promise(function(r){ setTimeout(r, 150); });
  }
}
