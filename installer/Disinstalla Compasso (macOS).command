#!/bin/bash
UPIA="/Library/Application Support/Adobe/Adobe Desktop Common/RemoteComponents/UPI/UnifiedPluginInstallerAgent/UnifiedPluginInstallerAgent.app/Contents/MacOS/UnifiedPluginInstallerAgent"
echo ""
if [ -x "$UPIA" ]; then "$UPIA" --remove "Compasso" && echo "  Fatto. Riavvia Illustrator.";
else echo "  Non trovo l'installatore di Adobe: disinstalla Compasso da «ZXP Installer»."; fi
echo ""
read -r -p "  Premi Invio per chiudere…" _
