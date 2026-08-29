import { useEffect, useRef, useState } from "react";
import { Link } from "@/lib/router-compat";
import { z } from "zod";
import { useServerFn } from "@tanstack/react-start";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Check, CheckCircle2, Copy, Github, Loader2, Mail } from "lucide-react";
import { BlueskyIcon, MastodonIcon } from "@/components/SocialIcons";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { submitContactMessage } from "@/lib/contact.functions";

export const CONTACT_EMAIL = "hallo@rout.be";
import { SOCIAL_LINKS, EXTERNAL_LINK_PROPS } from "@/lib/social-links";


const GITHUB_ISSUES = SOCIAL_LINKS.github;

const TOPICS = [
  { id: "general" },
  { id: "bug" },
  { id: "enterprise" },
] as const;

type TopicId = (typeof TOPICS)[number]["id"];

const schema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(255),
  subject: z.string().trim().min(1).max(150),
  message: z.string().trim().min(1).max(2000),
});

const inputClass =
  "w-full bg-background border border-input rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all";
const labelClass =
  "text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1 block";
const rowClass =
  "flex items-center justify-between gap-3 p-4 bg-muted/40 rounded-xl border border-border/50";

export default function Contact() {
  const { t, locale } = useI18n();
  const sendMessage = useServerFn(submitContactMessage);
  const [topic, setTopic] = useState<TopicId>("general");
  const [form, setForm] = useState<{ name: string; email: string; message: string }>({
    name: "",
    email: "",
    message: "",
  });
  const [honeypot, setHoneypot] = useState("");
  // Proof-of-time: stamped on mount, checked server-side against a 2s floor.
  const loadedAtRef = useRef<number | null>(null);
  useEffect(() => {
    loadedAtRef.current = Date.now();
  }, []);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [copied, setCopied] = useState(false);

  const field = (key: keyof typeof form, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const currentSubject = t(`contact.subject.${topic}`);

  const copyEmail = async () => {
    await navigator.clipboard.writeText(CONTACT_EMAIL);
    setCopied(true);
    toast.success(t("contact.copy.done"));
    window.setTimeout(() => setCopied(false), 1600);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sending) return;
    const parsed = schema.safeParse({ ...form, subject: currentSubject });
    if (!parsed.success) {
      console.warn("[contact] client validation failed:", parsed.error.flatten().fieldErrors);
      toast.error(t("contact.form.err.invalid"));
      return;
    }
    setSending(true);
    const requestPayload = {
      ...parsed.data,
      locale,
      company: honeypot,
      formLoadedAt: loadedAtRef.current ?? Date.now(),
    };
    console.info("[contact] submitting payload:", {
      ...requestPayload,
      message: `${requestPayload.message.length} chars`,
    });
    try {
      const result = await sendMessage({ data: requestPayload });
      console.info("[contact] server result:", result);
      if (!result.ok) {
        const base =
          result.reason === "rate_limited"
            ? t("contact.form.err.rate")
            : result.stored
              ? t("contact.form.err.stored_not_sent")
              : t("contact.form.err.network");
        toast.error(base, {
          description: result.detail,
          duration: 10000,
        });
        return;
      }
      setForm({ name: "", email: "", message: "" });
      setSent(true);
      if (result.detail) {
        console.warn("[contact] partial delivery:", result.detail);
        toast.warning(t("contact.form.partial"), { description: result.detail, duration: 8000 });
      } else {
        toast.success(t("contact.form.success"));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("[contact] submit failed:", error);
      toast.error(t("contact.form.err.network"), { description: message, duration: 10000 });
    } finally {
      setSending(false);
    }
  };



  return (
    <AppLayout crumbs={[{ label: t("contact.crumb") }]}>
      <div className="px-4 py-8 sm:py-14">
        <header className="mx-auto max-w-2xl text-center">
          <span className="eyebrow">{t("contact.eyebrow")}</span>
          <h1 className="mt-2 font-serif text-4xl font-medium sm:text-5xl">
            {t("contact.heading")}
          </h1>
          <p className="mx-auto mt-3 max-w-lg text-muted-foreground">{t("contact.intro")}</p>
        </header>

        <div
          data-testid="contact-topics"
          role="tablist"
          aria-label={t("contact.topics.aria")}
          className="mx-auto mt-8 grid w-full max-w-xl grid-cols-3 gap-1 rounded-xl bg-muted p-1"
        >
          {TOPICS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={topic === item.id}
              onClick={() => setTopic(item.id)}
              className={cn(
                "rounded-lg py-2 text-xs font-medium transition-all md:text-sm",
                topic === item.id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t(`contact.topic.${item.id}`)}
            </button>
          ))}
        </div>

        {topic === "bug" && (
          <p className="mt-3 text-center text-sm text-muted-foreground">
            {t("contact.bugHint.before")}{" "}
            <a
              href={GITHUB_ISSUES}
              {...EXTERNAL_LINK_PROPS}
              className="text-foreground underline underline-offset-4"
            >
              {t("contact.bugHint.link")}
            </a>{" "}
            {t("contact.bugHint.after")}
          </p>
        )}

        <div className="mx-auto mt-8 max-w-xl space-y-5 rounded-2xl border border-border bg-card p-6 shadow-sm md:p-8">
          {sent ? (
            <div
              data-testid="contact-success"
              role="status"
              className="flex flex-col items-center gap-3 py-6 text-center"
            >
              <CheckCircle2 className="h-10 w-10 text-primary" aria-hidden />
              <h2 className="font-serif text-2xl font-medium">{t("contact.form.sentTitle")}</h2>
              <p className="max-w-sm text-sm text-muted-foreground">
                {t("contact.form.sentBody")}
              </p>
              <Button variant="outline" className="mt-2" onClick={() => setSent(false)}>
                {t("contact.form.again")}
              </Button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-5" noValidate>
              <div>
                <label htmlFor="c-name" className={labelClass}>
                  {t("contact.field.name")}
                </label>
                <input
                  id="c-name"
                  name="name"
                  autoComplete="name"
                  placeholder={t("contact.field.namePlaceholder")}
                  className={inputClass}
                  maxLength={100}
                  disabled={sending}
                  value={form.name}
                  onChange={(e) => field("name", e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="c-email" className={labelClass}>
                  {t("contact.field.email")}
                </label>
                <input
                  id="c-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder={t("contact.field.emailPlaceholder")}
                  className={inputClass}
                  maxLength={255}
                  disabled={sending}
                  value={form.email}
                  onChange={(e) => field("email", e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="c-message" className={labelClass}>
                  {t("contact.field.message")}
                </label>
                <textarea
                  id="c-message"
                  name="message"
                  placeholder={t("contact.field.messagePlaceholder")}
                  className={cn(inputClass, "min-h-36 resize-y")}
                  maxLength={2000}
                  disabled={sending}
                  value={form.message}
                  onChange={(e) => field("message", e.target.value)}
                />
              </div>

              {/* Honeypot — hidden from humans, irresistible to bots. */}
              <div aria-hidden className="absolute h-0 w-0 overflow-hidden opacity-0">
                <label htmlFor="c-company">Company</label>
                <input
                  id="c-company"
                  name="company"
                  tabIndex={-1}
                  autoComplete="off"
                  value={honeypot}
                  onChange={(e) => setHoneypot(e.target.value)}
                />
              </div>

              <button
                type="submit"
                disabled={sending}
                aria-busy={sending}
                className="flex w-full select-none items-center justify-center rounded-xl bg-primary py-3 font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {sending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t("contact.form.sending")}
                  </>
                ) : (
                  t("contact.form.send")
                )}
              </button>
            </form>
          )}
        </div>


        <section
          data-testid="direct-channels"
          className="mx-auto mt-6 max-w-xl space-y-2"
          aria-labelledby="direct-channels-heading"
        >
          <h2
            id="direct-channels-heading"
            className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
          >
            {t("contact.channels.title")}
          </h2>

          <div className={rowClass}>
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="flex min-w-0 items-center gap-2 text-sm text-foreground"
            >
              <Mail className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <span className="truncate">{CONTACT_EMAIL}</span>
            </a>
            <button
              type="button"
              onClick={copyEmail}
              aria-label={t("contact.copy.aria")}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border/60 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          </div>

          <a href={GITHUB_ISSUES} {...EXTERNAL_LINK_PROPS} className={rowClass}>
            <span className="flex items-center gap-2 text-sm text-foreground">
              <Github className="h-4 w-4 text-muted-foreground" aria-hidden /> github.com/routbe
            </span>
            <span className="text-xs text-muted-foreground">{t("contact.channels.issues")}</span>
          </a>

          <a href={SOCIAL_LINKS.bluesky} {...EXTERNAL_LINK_PROPS} className={rowClass}>
            <span className="flex items-center gap-2 text-sm text-foreground">
              <BlueskyIcon className="h-4 w-4" /> bsky.app/profile/rout.be
            </span>
            <span className="text-xs text-muted-foreground">{t("contact.channels.bluesky")}</span>
          </a>

          <a href={SOCIAL_LINKS.mastodon} {...EXTERNAL_LINK_PROPS} className={rowClass}>
            <span className="flex items-center gap-2 text-sm text-foreground">
              <MastodonIcon className="h-4 w-4" /> mastodon.social/@routbe
            </span>
            <span className="text-xs text-muted-foreground">{t("contact.channels.fediverse")}</span>
          </a>

          <div className={rowClass}>
            <p className="text-xs text-muted-foreground">
              {t("contact.privacy.before")}{" "}
              <Link to="/privacy" className="underline underline-offset-4 hover:text-foreground">
                {t("contact.privacy.link")}
              </Link>
              .
            </p>
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
