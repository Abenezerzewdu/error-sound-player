import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { execFile } from "child_process";

let changeTimer: NodeJS.Timeout | undefined;

interface ErrorSnapshot {
  file: string;
  message: string;
  line: number;
  column: number;
}

let previousErrors: ErrorSnapshot[] = [];
let hasInitialSnapshot = false;

function getErrorKey(error: ErrorSnapshot): string {
  return `${error.file}|${error.message}|${error.line}|${error.column}`;
}

function playErrorSound(context: vscode.ExtensionContext) {
  const soundPath = path.join(context.extensionPath, "sounds", "error.mp3");

  console.log("🔊 Trying to play:", soundPath);

  // Check that the file actually exists
  if (!fs.existsSync(soundPath)) {
    console.error("❌ Sound file does not exist:", soundPath);
    return;
  }

  console.log("✅ Sound file exists");

  // Escape the path for PowerShell
  const escapedPath = soundPath.replace(/'/g, "''");

  const script = `
    Add-Type -AssemblyName presentationCore

    $player = New-Object System.Windows.Media.MediaPlayer

    $player.Open([System.Uri]::new('${escapedPath}'))

    Start-Sleep -Milliseconds 500

    $player.Play()

    Start-Sleep -Seconds 3

    $player.Stop()
    $player.Close()
  `;

  execFile(
    "powershell.exe",
    ["-NoProfile", "-Command", script],
    (error, stdout, stderr) => {
      if (error) {
        console.error("❌ Audio process failed:", error);
        console.error("stderr:", stderr);
        return;
      }

      console.log("🔊 Sound playback command finished");
      console.log("stdout:", stdout);
    },
  );
}

export function activate(context: vscode.ExtensionContext) {
  console.log("Error Sound Player is active");

  const changeListener = vscode.workspace.onDidChangeTextDocument((event) => {
    console.log("✏️ File changed:", event.document.fileName);

    if (changeTimer) {
      clearTimeout(changeTimer);
    }

    changeTimer = setTimeout(() => {
      const diagnostics = vscode.languages.getDiagnostics();

      const currentErrors: ErrorSnapshot[] = [];

      for (const [uri, fileDiagnostics] of diagnostics) {
        for (const diagnostic of fileDiagnostics) {
          if (diagnostic.severity !== vscode.DiagnosticSeverity.Error) {
            continue;
          }

          currentErrors.push({
            file: uri.toString(),
            message: diagnostic.message,
            line: diagnostic.range.start.line,
            column: diagnostic.range.start.character,
          });
        }
      }

      console.log("Current errors:", currentErrors);

      // FIRST CHECK
      if (!hasInitialSnapshot) {
        if (currentErrors.length > 0) {
          console.log("🔊 Existing errors detected!", currentErrors);

          playErrorSound(context);
        }

        previousErrors = currentErrors;
        hasInitialSnapshot = true;

        return;
      }

      // LATER CHECKS
      const previousKeys = new Set(previousErrors.map(getErrorKey));

      const newErrors = currentErrors.filter((error) => {
        return !previousKeys.has(getErrorKey(error));
      });

      if (newErrors.length > 0) {
        console.log("🚨 NEW ERROR DETECTED!", newErrors);

        playErrorSound(context);
      } else {
        console.log("✅ No new errors.");
      }

      // Save current state
      previousErrors = currentErrors;
    }, 800);
  });

  context.subscriptions.push(changeListener);
}

export function deactivate() {
  if (changeTimer) {
    clearTimeout(changeTimer);
  }
}
