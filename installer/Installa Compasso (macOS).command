#!/bin/bash
# Installa Compasso.zxp con l'installatore ufficiale di Adobe (UPIA, incluso in Creative Cloud).
cd "$(dirname "$0")" || exit 1
ZXP="$(pwd)/Compasso.zxp"
UPIA="/Library/Application Support/Adobe/Adobe Desktop Common/RemoteComponents/UPI/UnifiedPluginInstallerAgent/UnifiedPluginInstallerAgent.app/Contents/MacOS/UnifiedPluginInstallerAgent"

echo ""
echo "  COMPASSO per Adobe Illustrator"
echo "  ------------------------------"
echo ""
if [ ! -f "$ZXP" ]; then
  echo "  Non trovo Compasso.zxp accanto a questo file."
  echo ""
  echo "  Probabilmente hai scaricato il CODICE SORGENTE del progetto (pulsante «Code» o «Source code»)."
  echo "  Scarica invece Compasso-Windows-macOS.zip dalla sezione «Assets» della pagina che si apre ora,"
  echo "  estrai tutto e apri l'installer che contiene."
  open "https://github.com/marcodolce904-boop/COMPASSO/releases/latest"
  read -r -p "  Premi Invio per chiudere…" _
  exit 1
fi
if [ ! -x "$UPIA" ]; then
  echo "  Non trovo l'installatore di Adobe Creative Cloud."
  echo "  Installa Compasso.zxp con «ZXP Installer» (gratuito): https://aescripts.com/learn/zxp-installer/"
  read -r -p "  Premi Invio per chiudere…" _
  exit 1
fi
read -r -p "  Chiudi Illustrator, poi premi Invio per installare…" _
if "$UPIA" --install "$ZXP"; then
  echo ""
  echo "  FATTO!  Apri Illustrator e scegli:  Finestra > Estensioni > Compasso"
else
  echo ""
  echo "  L'installazione non è riuscita. Prova con «ZXP Installer» (vedi LEGGIMI.txt)."
fi
echo ""
read -r -p "  Premi Invio per chiudere…" _
