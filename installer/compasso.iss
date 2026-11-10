; Installer Windows di Compasso (Inno Setup 6). Compilato dalla release automatica:
;   ISCC /DAppVersion=0.2.0 installer\compasso.iss
; Copia il pannello (cartella firmata) nella cartella delle estensioni CEP dell'utente:
; niente permessi di amministratore, niente modifiche al registro di Adobe.
#ifndef AppVersion
  #define AppVersion "0.0.0"
#endif
#ifndef SourceDir
  #define SourceDir "..\apps\illustrator\dist\signed\Compasso"
#endif

[Setup]
AppId={{7C0C1F0E-5B0A-4F6E-9A53-C0A9A5503D21}
AppName=Compasso per Adobe Illustrator
AppVersion={#AppVersion}
AppVerName=Compasso {#AppVersion}
AppPublisher=Marco Dolce
DefaultDirName={userappdata}\Adobe\CEP\extensions\com.marcodolce.compasso
DisableDirPage=yes
DisableProgramGroupPage=yes
DisableWelcomePage=yes
DisableReadyPage=no
PrivilegesRequired=lowest
UninstallFilesDir={localappdata}\Compasso\uninstall
UninstallDisplayName=Compasso per Adobe Illustrator
OutputDir=..\release
OutputBaseFilename=Compasso-Setup
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
ShowLanguageDialog=no
CloseApplications=no

[Languages]
Name: "it"; MessagesFile: "compiler:Languages\Italian.isl"

[InstallDelete]
; aggiornamento pulito: via i file della versione precedente
Type: filesandordirs; Name: "{app}"

[Files]
Source: "{#SourceDir}\*"; DestDir: "{app}"; Flags: recursesubdirs createallsubdirs ignoreversion

[UninstallDelete]
Type: filesandordirs; Name: "{app}"
Type: dirifempty; Name: "{localappdata}\Compasso"

[Messages]
ReadyLabel1=Compasso verrà installato per Adobe Illustrator.
ReadyLabel2a=Chiudi Illustrator se è aperto, poi premi Installa.
FinishedHeadingLabel=Compasso è installato
FinishedLabelNoIcons=Apri Illustrator e scegli:%n%n      Finestra  >  Estensioni  >  Compasso%n%n(in alcune versioni il menu si chiama «Estensioni (legacy)»).%n%nSeleziona un logo e premi DISEGNA COSTRUZIONE.
ClickFinish=Premi Fine per chiudere.
