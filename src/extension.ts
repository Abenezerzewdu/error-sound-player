import * as vscode from "vscode";

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

          // Sound will go here later
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

        // Sound will go here later
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
