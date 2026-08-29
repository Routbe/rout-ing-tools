import { useState } from "react";
import { CreditCard, Landmark } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Brand marks for the payment networks.
 *
 * Logos come from the simple-icons CDN (monochrome glyphs), each on its own
 * brand-coloured tile. Glyphs on a dark/coloured tile are inverted to white.
 * IBAN/SEPA uses the artwork mirrored on this project's CDN.
 */
interface Brand {
  url?: string;
  bg: string;
  /** Render the monochrome glyph in white (for coloured tiles). */
  invert?: boolean;
  alt: string;
}

const icon = (name: string) => `https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/${name}.svg`;

const BRANDS: Record<string, Brand> = {
  bancontact: { url: icon("bancontact"), bg: "#ffffff", alt: "Bancontact" },
  payconiq: { url: icon("payconiq"), bg: "#ff4785", invert: true, alt: "Payconiq" },
  paypal: { url: icon("paypal"), bg: "#ffffff", alt: "PayPal" },
  venmo: { url: icon("venmo"), bg: "#008cff", invert: true, alt: "Venmo" },
  cashapp: { url: icon("cashapp"), bg: "#00d632", invert: true, alt: "Cash App" },
  pix: { url: icon("pix"), bg: "#ffffff", alt: "Pix" },
  alipay: { url: icon("alipay"), bg: "#ffffff", alt: "Alipay+" },
  wechat: { url: icon("wechat"), bg: "#07c160", invert: true, alt: "WeChat Pay" },
  crypto: { url: icon("bitcoin"), bg: "#f7931a", invert: true, alt: "Crypto / Lightning" },
};

interface Props {
  id: string;
  className?: string;
}

/** Brand mark with a graceful fallback to a neutral card glyph. */
function BrandLogo({ brand, boxClass }: { brand: Brand; boxClass: string }) {
  const [failed, setFailed] = useState(false);

  if (failed || !brand.url) {
    return (
      <span className={cn(boxClass, "bg-secondary text-muted-foreground")} title={brand.alt}>
        <CreditCard className="w-[70%] h-[70%]" aria-hidden />
        <span className="sr-only">{brand.alt}</span>
      </span>
    );
  }

  return (
    <span className={boxClass} style={{ background: brand.bg }}>
      <img
        src={brand.url}
        alt={brand.alt}
        loading="lazy"
        onError={() => setFailed(true)}
        className="w-full h-full object-contain p-[15%]"
        style={brand.invert ? { filter: "brightness(0) invert(1)" } : undefined}
      />
    </span>
  );
}

export function PaymentBrandIcon({ id, className }: Props) {
  const box = cn(
    "rounded-xl overflow-hidden flex items-center justify-center flex-shrink-0 border border-border/60",
    className,
  );

  if (id === "iban") {
    // Bank-to-bank IBAN / EPC credit transfer — a bank glyph, not a card.
    return (
      <span className={cn(box, "bg-secondary text-foreground")} title="SEPA / EPC credit transfer">
        <Landmark className="w-[62%] h-[62%]" aria-hidden />
        <span className="sr-only">SEPA / EPC credit transfer</span>
      </span>
    );
  }

  if (id === "wero") {
    return (
      <span
        className={cn(box, "font-black tracking-tighter text-[0.42em] leading-none text-black")}
        style={{ background: "#FFD600" }}
        title="Wero"
      >
        WERO
      </span>
    );
  }

  const brand = BRANDS[id];
  if (!brand) {
    return (
      <span className={cn(box, "bg-secondary text-muted-foreground")}>
        <CreditCard className="w-[70%] h-[70%]" aria-hidden />
      </span>
    );
  }

  return <BrandLogo brand={brand} boxClass={box} />;
}
