import { useState, type CSSProperties } from "react";
import { CalendarClock, Loader2, Mail } from "lucide-react";
import { toast } from "sonner";
import { subscribeNewsletter } from "@/lib/newsletter.functions";
import { Turnstile } from "@/components/Turnstile";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/** Interactieve kaarten op het publieke profiel (nieuwsbrief, agenda). */

/** Brevo-nieuwsbriefinschrijving, volledig in de pagina. */
export function NewsletterBlock({
  handle,
  label,
  style,
}: {
  handle: string;
  label: string;
  style: CSSProperties;
}) {
  const [email, setEmail] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!email.trim() || busy) return;
    setBusy(true);
    try {
      const res = await subscribeNewsletter({
        data: { handle, email: email.trim(), turnstileToken: token },
      });
      if (res.ok) {
        setDone(true);
        toast.success(res.message);
      } else {
        toast.error(res.message);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Inschrijven mislukt.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex w-full flex-col gap-2 px-4 py-3" style={style}>
      <span className="flex items-center gap-2 text-sm font-medium">
        <Mail className="h-4 w-4" aria-hidden />
        {label || "Nieuwsbrief"}
      </span>
      {done ? (
        <span className="text-xs opacity-80">Bedankt — je staat op de lijst.</span>
      ) : (
        <div className="flex gap-2">
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="jij@email.com"
            aria-label="E-mailadres"
            maxLength={200}
            className="min-w-0 flex-1 rounded-md border border-current/20 bg-transparent px-2.5 py-1.5 text-xs outline-none placeholder:opacity-60"
          />
          <button
            type="submit"
            disabled={busy}
            className="inline-flex items-center gap-1 rounded-md border border-current/30 px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
          >
            {busy && <Loader2 className="h-3 w-3 animate-spin" aria-hidden />}
            Inschrijven
          </button>
        </div>
      )}
      <Turnstile onToken={setToken} />
    </form>
  );
}

/** Detecteert een boekingslink (Cal.com / Calendly) zodat we die kunnen embedden. */
export function isBookingUrl(url: string): boolean {
  return /(^|\/\/|\.)(cal\.com|calendly\.com)\//i.test(url);
}

/** Cal.com / Calendly in een overlay, zodat bezoekers de pagina niet verlaten. */
export function BookingBlock({
  href,
  label,
  style,
}: {
  href: string;
  label: string;
  style: CSSProperties;
}) {
  const [open, setOpen] = useState(false);
  const embed = href.includes("?") ? `${href}&embed=true` : `${href}?embed=true`;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-h-12 w-full items-center gap-3 px-4 py-3 text-sm font-medium transition-opacity hover:opacity-80"
        style={style}
      >
        <CalendarClock className="h-4 w-4 shrink-0" aria-hidden />
        <span className="min-w-0 flex-1 truncate text-center">{label || "Plan een gesprek"}</span>
        <span className="h-4 w-4 shrink-0" aria-hidden />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl p-0">
          <DialogHeader className="px-4 pt-4">
            <DialogTitle>{label || "Plan een gesprek"}</DialogTitle>
          </DialogHeader>
          <iframe
            src={embed}
            title={label || "Boekingsagenda"}
            className="h-[70vh] w-full rounded-b-lg border-0"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
