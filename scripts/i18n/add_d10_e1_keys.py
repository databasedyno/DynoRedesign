#!/usr/bin/env python3
"""One-off: D10 physical-goods copy (common.productEditor) + E1 Duplicate (paymentLinks)."""
import json, os

ROOT = os.path.join(os.path.dirname(__file__), "..", "..", "langs", "locales")

PHYS = {
  "en": "Physical goods (no shipping address collected)",
  "de": "Physische Waren (keine Lieferadresse erfasst)",
  "es": "Bienes físicos (no se recoge dirección de envío)",
  "fr": "Biens physiques (aucune adresse de livraison collectée)",
  "nl": "Fysieke goederen (geen verzendadres verzameld)",
  "pt": "Bens físicos (sem morada de envio recolhida)",
}
PHYS_HINT = {
  "en": "Heads-up: the store checkout is built for digital goods and services — it doesn't collect a shipping address. Tax uses the buyer's detected location; arrange delivery details with the buyer by email.",
  "de": "Hinweis: Der Shop-Checkout ist für digitale Waren und Dienstleistungen ausgelegt – es wird keine Lieferadresse erfasst. Die Steuer richtet sich nach dem erkannten Standort des Käufers; Lieferdetails klärst du per E-Mail.",
  "es": "Aviso: el checkout de la tienda está pensado para bienes digitales y servicios; no recoge dirección de envío. El impuesto usa la ubicación detectada del comprador; acuerda los detalles de entrega por correo.",
  "fr": "Attention : le checkout de la boutique est conçu pour les biens numériques et les services — il ne collecte pas d'adresse de livraison. La taxe se base sur la localisation détectée de l'acheteur ; convenez de la livraison par e-mail.",
  "nl": "Let op: de winkelcheckout is gemaakt voor digitale goederen en diensten — er wordt geen verzendadres verzameld. Belasting gebruikt de gedetecteerde locatie van de koper; regel de bezorging per e-mail.",
  "pt": "Atenção: o checkout da loja foi feito para bens digitais e serviços — não recolhe morada de envio. O imposto usa a localização detetada do comprador; combina a entrega por e-mail.",
}
DUP = {"en": "Duplicate", "de": "Duplizieren", "es": "Duplicar", "fr": "Dupliquer", "nl": "Dupliceren", "pt": "Duplicar"}

for lang in PHYS:
    fp = os.path.join(ROOT, lang, "common.json")
    d = json.load(open(fp, encoding="utf-8"))
    pe = d.setdefault("productEditor", {})
    pe["categoryPhysical"] = PHYS[lang]
    pe["categoryPhysicalHint"] = PHYS_HINT[lang]
    json.dump(d, open(fp, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    open(fp, "a", encoding="utf-8").write("\n")

    fp = os.path.join(ROOT, lang, "paymentLinks.json")
    if os.path.exists(fp):
        d = json.load(open(fp, encoding="utf-8"))
        d.setdefault("duplicateLink", DUP[lang])
        json.dump(d, open(fp, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
        open(fp, "a", encoding="utf-8").write("\n")
    print(lang, "ok")
