#!/usr/bin/env bash
# H3 — download every source named in data/sources/h3/*.json into DIR and check
# each download against its manifest's sha256 before anything is unpacked.
# Any mismatch stops the script: nothing is loaded from a file the manifests do
# not name. The ingest then re-checks the unpacked files against the same
# manifests.
#
#   bash scripts/h3-fetch-sources.sh /tmp/h3
set -euo pipefail
DIR=${1:?usage: h3-fetch-sources.sh DIR}
M=$(cd "$(dirname "$0")/../data/sources/h3" && pwd)
mkdir -p "$DIR"/cat "$DIR"/dem "$DIR"/census/Seccionado_2021 "$DIR"/epc

j() { jq -er "$1" "$M/$2"; }

fetch() { # url out sha256
  curl -fsSL --retry 3 --retry-delay 15 --max-time 1800 -o "$2" "$1"
  local got
  got=$(sha256sum "$2" | cut -d' ' -f1)
  if [ "$got" != "$3" ]; then
    echo "REFUSED $(basename "$2"): sha256 $got ≠ manifest $3 — the publisher's file has changed; update the manifest in a ruled block" >&2
    exit 1
  fi
  echo "ok  $(basename "$2")  $got"
}

C=catastro-bu-14900.json
fetch "$(j .source.url $C)" "$DIR/cat/bu.zip" "$(j .source.sha256 $C)"
unzip -q -o -j "$DIR/cat/bu.zip" "$(j .files.building.name $C)" "$(j .files.buildingPart.name $C)" -d "$DIR/cat"

D=ign-mdt25-cordoba.json
fetch "$(j .source.url $D)" "$DIR/dem/mdt25.asc" "$(j .source.sha256 $D)"

I=ine-censo2021.json
fetch "$(j .boundaries.source.url $I)" "$DIR/census/secc.zip" "$(j .boundaries.source.sha256 $I)"
unzip -q -o -j "$DIR/census/secc.zip" 'Seccionado_2021/SECC_CE_20210101.*' -d "$DIR/census/Seccionado_2021"
fetch "$(j .indicators.source.url $I)" "$DIR/census/C2021_Indicadores.csv" "$(j .indicators.source.sha256 $I)"

E=junta-epc-cordoba.json
fetch "$(j .source.url $E)" "$DIR/epc/epc.7z" "$(j .source.sha256 $E)"
7z e -y -r -o"$DIR/epc" "$DIR/epc/epc.7z" "$(j .xml.name $E)" >/dev/null
test -s "$DIR/epc/$(j .xml.name $E)"

echo "all sources fetched and checked into $DIR"
