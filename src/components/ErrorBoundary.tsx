import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RotateCcw, ChevronDown, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props { children: ReactNode; label?: string; resetKey?: unknown; inline?: boolean; }
interface State { error: Error | null; info: ErrorInfo | null; detailsOpen: boolean; }

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null, info: null, detailsOpen: false };
  static getDerivedStateFromError(error: Error): Partial<State> { return { error }; }
  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", this.props.label ?? "app", error, info);
    this.setState({ info });
  }
  override componentDidUpdate(prev: Props) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null, info: null, detailsOpen: false });
  }
  private retry = () => this.setState({ error: null, info: null, detailsOpen: false });
  private reload = () => { if (typeof window !== "undefined") window.location.reload(); };
  private resetCache = () => { try { if (typeof window !== "undefined") { const keep = /^(sb-|db)/i; const doomed: string[] = []; for (let i = 0; i < window.localStorage.length; i += 1) { const key = window.localStorage.key(i); if (key && !keep.test(key)) doomed.push(key); } doomed.forEach((key) => window.localStorage.removeItem(key)); window.sessionStorage.clear(); } } catch {} this.reload(); };
  override render() {
    const { error, info, detailsOpen } = this.state;
    if (!error) return this.props.children;
    const stack = [error.stack ?? `${error.name}: ${error.message}`, info?.componentStack].filter(Boolean).join("\n\n");
    return <div role="alert" className={this.props.inline ? "w-full rounded-2xl border-2 border-foreground bg-card p-5 text-center" : "flex min-h-[60vh] w-full items-center justify-center px-4 py-10"}><div className="mx-auto w-full max-w-lg space-y-4 rounded-2xl border-2 border-foreground bg-card p-6 text-center"><div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-secondary"><AlertTriangle className="h-5 w-5 text-foreground" aria-hidden /></div><div className="space-y-1"><h2 className="text-lg font-medium">{this.props.label ? `${this.props.label} reageert niet meer` : "Er ging iets mis"}</h2><p className="text-sm text-muted-foreground">Er is een onverwachte fout opgetreden in de applicatie. We hebben het probleem opgevangen voordat de pagina crashte — herlaad om fris te starten.</p></div><div className="flex flex-wrap justify-center gap-2"><Button onClick={this.reload}><RotateCcw className="mr-2 h-4 w-4" aria-hidden />App opnieuw laden</Button><Button variant="outline" onClick={this.retry}>Opnieuw proberen</Button><Button variant="outline" onClick={this.resetCache}><Trash2 className="mr-2 h-4 w-4" aria-hidden />Reset app &amp; cache</Button></div><div className="pt-1 text-left"><button type="button" onClick={() => this.setState((s) => ({ detailsOpen: !s.detailsOpen }))} aria-expanded={detailsOpen} className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><ChevronDown className={`h-3.5 w-3.5 ${detailsOpen ? "rotate-180" : ""}`} aria-hidden />Technische details</button>{detailsOpen && <pre className="mt-2 max-h-64 overflow-auto rounded-xl border border-border bg-muted/60 p-3 text-left font-mono text-[11px] leading-relaxed whitespace-pre-wrap break-words text-muted-foreground">{stack}</pre>}</div></div></div>;
  }
}
