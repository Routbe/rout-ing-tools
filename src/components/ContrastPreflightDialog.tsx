import { AlertTriangle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/**
 * Preflight gate: shown when a user tries to export a code whose contrast is
 * under the WCAG AA safe threshold (4.5:1) for camera decoding.
 */
export function ContrastPreflightDialog({
  open,
  onOpenChange,
  ratio,
  onFixAndDownload,
  onDownloadAnyway,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ratio: number;
  onFixAndDownload: () => void;
  onDownloadAnyway: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="rounded-3xl" data-testid="contrast-preflight">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" aria-hidden />
            Waarschuwing: laag contrast
          </AlertDialogTitle>
          <AlertDialogDescription>
            Het contrast van deze QR-code is te laag (ratio {ratio.toFixed(2)}:1, onder 4.5:1), wat
            de leesbaarheid op mobiele telefoons kan verstoren.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2 sm:gap-2">
          <AlertDialogCancel
            data-testid="contrast-continue"
            onClick={onDownloadAnyway}
            className="min-h-11 rounded-xl"
          >
            Toch doorgaan op eigen risico
          </AlertDialogCancel>
          <AlertDialogAction
            data-testid="contrast-autofix"
            onClick={onFixAndDownload}
            className="min-h-11 rounded-xl"
          >
            Automatisch corrigeren &amp; downloaden
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
