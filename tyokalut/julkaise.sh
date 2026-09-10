#!/bin/sh
# TYÖKALULISTA — julkaisu GitHub Pagesiin.
# Aja:  sh tyokalut/julkaise.sh ["commit-viesti"]
#
# Julkaistava sisältö on VAIN docs/-kansio. Generaattori jää tyokalut/-kansioon
# eikä päädy sivustolle. Pages-asetus tehdään kerran selaimesta:
#   Settings → Pages → Source: Deploy from a branch → main → /docs
set -e
cd "$(dirname "$0")/.."

if [ ! -d .git ]; then
  echo "Tämä kansio ei ole vielä git-varasto. Kertaluontoinen käyttöönotto:"
  echo
  echo "  cd ~/Tyokalulista"
  echo "  git init -b main"
  echo "  git add -A && git commit -m 'Työkalulista'"
  echo "  git remote add origin git@github.com:<tunnus>/<varasto>.git"
  echo "  git push -u origin main"
  echo
  echo "Käy sitten GitHubissa: Settings → Pages → Source: main, kansio /docs."
  exit 1
fi

# 1) TESTIT ENSIN. Punaisena ei julkaista: sivu menee työkumppanien puhelimiin,
#    eikä rikkinäistä huomaa ennen kuin joku seisoo työmaalla koodin kanssa.
echo "--- testit ---"
node testit/t_lista.js
node testit/t_lista_selain.mjs

# 2) Julkaistava kansio: molemmat tiedostot olemassa eikä mitään ylimääräistä.
echo "--- julkaistava kansio ---"
for f in docs/index.html docs/sw.js; do
  [ -s "$f" ] || { echo "PUUTTUU tai on tyhjä: $f"; exit 1; }
done
ls docs
if [ -e docs/generaattori.html ]; then
  echo "VIRHE: generaattori päätyi julkaistavaan kansioon."; exit 1
fi

# 3) Commit ja push.
echo "--- git ---"
git add -A
if git diff --cached --quiet; then
  echo "Ei uusia muutoksia työpöydällä."
else
  git commit -m "${1:-Työkalulistan päivitys}"
fi
# Työntö AINA, myös ilman uutta committia: valmis mutta työntämätön commit
# jäisi muuten koneelle, ja sivusto näyttäisi vanhaa ilman että mikään kertoo.
git push

# 4) Osoite. Johdetaan etävarastosta, jotta se on aina se oikea eikä muistinvarainen.
eta=$(git remote get-url origin 2>/dev/null || true)
tunnus=$(printf '%s' "$eta" | sed -n 's#.*github\.com[:/]\([^/]*\)/.*#\1#p')
varasto=$(printf '%s' "$eta" | sed -n 's#.*github\.com[:/][^/]*/\(.*\)$#\1#p' | sed 's/\.git$//')
echo "--- valmis ---"
if [ -n "$tunnus" ] && [ -n "$varasto" ]; then
  echo "Osoite: https://$tunnus.github.io/$varasto/"
  echo "Kirjoita tuo generaattorin osoitekenttään kerran, niin se muistaa sen."
else
  echo "Etävarastoa ei tunnistettu GitHubiksi — tarkista osoite itse."
fi
echo "Julkaisussa on viiveensä: GitHub päivittää sivuston noin minuutissa."
