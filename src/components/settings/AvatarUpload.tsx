import { useRef, useState } from "react";
import { Loader2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/UserAvatar";
import { uploadAvatar } from "@/lib/avatar.functions";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif"];

interface Props {
  value: string | null;
  name?: string | null;
  onChange: (url: string | null) => void;
}

/**
 * Avatar picker: a visual preview plus two plain actions.
 *
 * The raw storage URL is deliberately never shown — the bytes land in our own
 * `avatars` bucket under the member's user id and the profile keeps a stable
 * app route, so there is nothing useful to paste or edit by hand.
 */
export function AvatarUpload({ value, name, onChange }: Props) {
  const { t } = useI18n();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    if (!ALLOWED.includes(file.type)) {
      toast.error(t("avatar.err.type"));
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error(t("avatar.err.size"));
      return;
    }

    setBusy(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error(t("avatar.err.read")));
        reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
        reader.readAsDataURL(file);
      });

      const ext = (file.name.split(".").pop() || "jpg").toLowerCase().slice(0, 5);
      const result = await uploadAvatar({ data: { base64, contentType: file.type, ext } });
      if (!result.ok || !result.path) throw new Error(result.message ?? t("avatar.err.upload"));

      onChange(`/api/public/avatar?path=${encodeURIComponent(result.path)}`);
      toast.success(t("avatar.updated"));
    } catch (error) {
      toast.error(t("avatar.err.upload"), {
        description: error instanceof Error ? error.message : t("avatar.err.retry"),
      });
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <UserAvatar src={value} name={name} className="h-14 w-14" textClassName="text-base" />
      <input
        ref={input}
        type="file"
        accept={ALLOWED.join(",")}
        className="sr-only"
        onChange={(e) => void pick(e.target.files?.[0])}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="rounded-xl"
        disabled={busy}
        onClick={() => input.current?.click()}
      >
        {busy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        ) : (
          <Upload className="h-3.5 w-3.5" aria-hidden />
        )}
        {value ? t("avatar.replace") : t("avatar.upload")}
      </Button>
      {value ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="rounded-xl text-muted-foreground"
          disabled={busy}
          onClick={() => onChange(null)}
        >
          <X className="h-3.5 w-3.5" aria-hidden />
          {t("avatar.remove")}
        </Button>
      ) : null}
    </div>
  );
}
