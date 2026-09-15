#!/usr/bin/env python3
"""Merchant-facing 'wallet' (= payout/forwarding destination) -> 'payout address'. Idempotent.

Buyer wallets ("Open in wallet", "your wallet adds a network fee"), the customer-ledger
"Customer Wallets" API, admin platform hot wallets, legal docs and marketing "your own
wallet" lines are intentionally untouched.

Usage: python3 scripts/i18n/rename_wallet_to_payout_address.py [--dry] [--report path]
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DRY = "--dry" in sys.argv
REPORT = Path(sys.argv[sys.argv.index("--report") + 1]) if "--report" in sys.argv else None
LANGS = ["en", "de", "es", "fr", "pt", "nl"]

# ---------------------------------------------------------------- EN rules (ordered)
EN = [
    (r"\bpayout wallet addresses\b", "payout addresses"), (r"\bPayout wallet addresses\b", "Payout addresses"),
    (r"\bpayout wallet address\b", "payout address"), (r"\bPayout wallet address\b", "Payout address"),
    (r"\bPayout-wallet\b", "Payout address"), (r"\bpayout-wallet\b", "payout address"),
    (r"\bYou Don't Have Active Wallets\b", "No active payout addresses"),
    (r"\bbut the payout to your wallet has not completed yet\b", "but it has not reached your payout address yet"),
    (r"\bFailed to add wallet address\b", "Failed to add payout address"),
    (r"\bwallet\(s\)", "payout address(es)"),
    (r"Want to add another wallet for a different cryptocurrency\?", "Want to add a payout address for another cryptocurrency?"),
    (r"You have to have at least one wallet address added in order to proceed\.", "Add at least one payout address to continue."),
    (r"\bThe wallet your funds are forwarded to\b", "The address your funds are forwarded to"),
    (r"\bAdding a wallet takes about 30 seconds\b", "Adding a payout address takes about 30 seconds"),
    (r"\bAcross \{\{count\}\} wallets\b", "Across {{count}} payout addresses"), (r"\bAcross \{\{count\}\} wallet\b", "Across {{count}} payout address"),
    (r"\bPayout-wallet changes\b", "Payout address changes"),
    (r"\bpayout-wallet changes\b", "payout address changes"),
    (r"\bpayout-wallet protection\b", "payout address protection"),
    (r"\bPayout Wallets\b", "Payout Addresses"), (r"\bPayout wallets\b", "Payout addresses"), (r"\bpayout wallets\b", "payout addresses"),
    (r"\bPayout Wallet\b", "Payout Address"), (r"\bPayout wallet\b", "Payout address"), (r"\bpayout wallet\b", "payout address"),
    (r"\bSettlement wallets\b", "Settlement addresses"), (r"\bsettlement wallets\b", "settlement addresses"),
    (r"\bSettlement wallet\b", "Settlement address"), (r"\bsettlement wallet\b", "settlement address"),
    (r"\bSettlement coin & wallets\b", "Settlement coin & addresses"),
    (r"\bWallet change history\b", "Payout address change history"),
    (r"\bWallet changes\b", "Payout address changes"), (r"\bwallet changes\b", "payout address changes"),
    (r"\bWallet change\b", "Payout address change"), (r"\bwallet change\b", "payout address change"),
    (r"\bWallet security\b", "Payout address security"), (r"\bwallet security\b", "payout address security"),
    (r"\bWallet protection\b", "Payout address protection"),
    (r"\bComplete wallet setup\b", "Add a payout address"),
    (r"\bWallet setup\b", "Payout address setup"), (r"\bwallet setup\b", "payout address setup"),
    (r"\bAdd your first wallet\b", "Add your first payout address"),
    (r"\bAdd another wallet\b", "Add another payout address"),
    (r"\bAdd a crypto wallet\b", "Add a payout address"),
    (r"\bAdd a Wallet Address\b", "Add a payout address"),
    (r"\bAdd a cryptocurrency wallet address to receive payments\b", "Add the address your payments should be forwarded to"),
    (r"\bManage your cryptocurrency wallet addresses\b", "Manage the addresses your payments are forwarded to"),
    (r"\bManage your payout wallet addresses for\b", "Manage your payout addresses for"),
    (r"\bat least one crypto wallet address\b", "at least one payout address"),
    (r"\bAdd a wallet\b", "Add a payout address"), (r"\badd a wallet\b", "add a payout address"),
    (r"\bAdd the wallet first\b", "Add the payout address first"),
    (r"\badd the wallet the money should land in\b", "add the payout address the money should land in"),
    (r"\bAdd Wallet Now\b", "Add payout address now"),
    (r"\bAdd Your Wallet\b", "Add your payout address"), (r"\bAdd your wallet\b", "Add your payout address"),
    (r"\bAdd Wallet\b", "Add payout address"), (r"\bAdd wallets\b", "Add payout addresses"),
    (r"\bAdd wallet\b", "Add payout address"), (r"\badd wallet\b", "add payout address"),
    (r"\bWhy add a wallet\?", "Why add a payout address?"),
    (r"\bWithout a wallet\b", "Without a payout address"),
    (r"\bYour wallet is where we'll send\b", "Your payout address is where we'll send"),
    (r"\bManage wallets\b", "Manage payout addresses"), (r"\bmanage wallets\b", "manage payout addresses"),
    (r"\bShow all wallets\b", "Show all payout addresses"), (r"\bShow fewer wallets\b", "Show fewer payout addresses"),
    (r"\bShow wallets\b", "Show payout addresses"),
    (r"\bView Wallets\b", "View payout addresses"), (r"\bGo to Wallets\b", "Go to payout addresses"),
    (r"\bYour wallets, keys and history\b", "Your payout addresses, keys and history"),
    (r"\bYour wallets\b", "Your payout addresses"),
    (r"\bAll Wallets\b", "All payout addresses"), (r"\bAll wallets\b", "All payout addresses"),
    (r"\bActive Wallets\b", "Active payout addresses"), (r"\bActive wallets\b", "Active payout addresses"),
    (r"\bactive wallets\b", "active payout addresses"), (r"\bactive wallet\b", "active payout address"),
    (r"\bYou Don't Have Active Wallets\b", "No active payout addresses"),
    (r"\bBy wallet\b", "By payout address"),
    (r"\bNew wallet\b", "New payout address"),
    (r"\bDelete Wallet\?", "Remove payout address?"), (r"\bDelete Wallet\b", "Remove payout address"), (r"\bDelete wallet\b", "Remove payout address"),
    (r"\bEdit wallet\b", "Edit payout address"),
    (r"\bWallet deleted successfully\b", "Payout address removed"), (r"\bWallet updated successfully\b", "Payout address updated"),
    (r"\bUpdating your wallet…", "Updating your payout address…"), (r"\bSetting up your wallet…", "Saving your payout address…"),
    (r"\bWallet added!", "Payout address added!"), (r"\{\{count\}\} wallets added!", "{{count}} payout addresses added!"),
    (r"\bWallet Added\b", "Payout address added"), (r"\bWallet Updated\b", "Payout address updated"),
    (r"\bWallet Removed\b", "Payout address removed"), (r"\bWallet Active\b", "Payout address active"),
    (r"\bWallet added –", "Payout address added –"), (r"\bWallet updated –", "Payout address updated –"),
    (r"\bWallet removed from your account\b", "Payout address removed from your account"),
    (r"\bConfirm wallet update\b", "Confirm payout address update"), (r"\bConfirm Wallet Update\b", "Confirm payout address update"),
    (r"\bConfirm wallet edit\b", "Confirm payout address edit"), (r"\bConfirm Wallet Edit\b", "Confirm payout address edit"),
    (r"\bConfirm wallet deletion\b", "Confirm payout address removal"), (r"\bConfirm Wallet Deletion\b", "Confirm payout address removal"),
    (r"\bConfirm your wallet address\b", "Confirm your payout address"),
    (r"\bWallet Verification Code\b", "Payout address verification code"),
    (r"\ba new wallet address for\b", "a new payout address for"),
    (r"\bedit a wallet address\b", "edit a payout address"),
    (r"delete</strong> a wallet address", "delete</strong> a payout address"),
    (r"\bWallet name \(optional\)", "Label (optional)"), (r"\bWallet Name\b", "Label"),
    (r"\bWallet name is required\b", "A label is required"), (r"\bWallet address is required\b", "An address is required"),
    (r"\bWallet Address\b", "Address"), (r"\bWallet address\b", "Address"),
    (r"\bEnter the wallet address\b", "Paste the address from your wallet app"),
    (r"\bcheck the wallet address carefully\b", "check the address carefully"),
    (r"\bA wallet has been removed\b", "A payout address has been removed"),
    (r"\bIf you didn't (remove|add|update) this wallet\b", r"If you didn't \1 this payout address"),
    (r"\bforwarded to this wallet\b", "forwarded to this payout address"),
    (r"\bYou can manage your wallets in the dashboard\b", "You can manage your payout addresses in the dashboard"),
    (r"\bcopy wallet addresses\b", "copy payout addresses"), (r"\bwallet addresses\b", "payout addresses"),
    (r"\bReuse wallets\b", "Reuse payout addresses"), (r"\breuse wallets\b", "reuse payout addresses"),
    (r"\bUse these wallets\b", "Use these addresses"),
    (r"\bselected wallet\(s\)", "selected address(es)"), (r"\bselected wallets\b", "selected addresses"), (r"\bselected wallet\b", "selected address"),
    (r"\bWallets copied\b", "Payout addresses copied"), (r"\bwallets copied\b", "payout addresses copied"), (r"\bwallet copied\b", "payout address copied"),
    (r"\bCould not copy (the )?wallets\b", "Could not copy the payout addresses"), (r"\bcopy wallets\b", "copy payout addresses"),
    (r"\bCopy \{\{count\}\} wallets\b", "Copy {{count}} payout addresses"), (r"\bCopy \{\{count\}\} wallet\b", "Copy {{count}} payout address"),
    (r"\bUse the same wallets as\b", "Use the same payout addresses as"),
    (r"\{\{n\}\} wallets share", "{{n}} payout addresses share"), (r"\bN wallets share\b", "N payout addresses share"),
    (r"\bTap to highlight every wallet using this address\b", "Tap to highlight every coin paid out to this address"),
    (r"\bwallets this brand doesn", "payout addresses this brand doesn"),
    (r"\bFinish the new wallet rows\b", "Finish the new address rows"), (r"\bedit a wallet or add a network\b", "edit an address or add a network"),
    (r"\balready has a wallet on this brand\b", "already has a payout address on this brand"),
    (r"\byour first wallet on this (brand|company)\b", r"your first payout address on this \1"),
    (r"\bConnect a wallet to start\b", "Add a payout address to start"),
    (r"\bNo payouts to this wallet yet\b", "No payouts to this address yet"),
    (r"\bWebhook, API key, wallet and profile changes\b", "Webhook, API key, payout address and profile changes"),
    (r"\bsettings, keys, wallets and the team\b", "settings, keys, payout addresses and the team"),
    (r"\bbrands, wallets, payment links\b", "brands, payout addresses, payment links"),
    (r"\bpayment links, wallets, settings\b", "payment links, payout addresses, settings"),
    (r"\bAPI keys, payout wallets and settings\b", "API keys, payout addresses and settings"),
    (r"\bWallet Icon\b", "Payout address icon"),
    (r"\bOpen wallet\b", "Open payout addresses"),
    (r"\*Set up wallet first\b", "*Add a payout address first"),
    (r"\bset up your USDT/USDC wallet first\b", "add a USDT/USDC payout address first"),
    (r"\bAdd a matching stablecoin wallet first\b", "Add a matching stablecoin payout address first"),
    (r"\bSet up a stablecoin wallet first\b", "Add a stablecoin payout address first"),
    (r"\bon this wallet will be converted\b", "to this payout address will be converted"),
    (r"\bPick one USDT \(TRC-20\) wallet\b", "Pick one USDT (TRC-20) payout address"),
    (r"\bUse a wallet you've already saved\b", "Use a payout address you've already saved"),
    (r"\bNo wallet needed\b", "No payout address needed"),
    (r"\bYou change a wallet\b", "You change a payout address"),
    (r"\bWallets · Dynopay\b", "Payout addresses · Dynopay"),
    (r"\bthe \{\{type\}\} wallet\{\{address\}\}", "the {{type}} payout address{{address}}"),
    (r"\bAdd one wallet per coin\b", "Add one payout address per coin"),
    (r"\bundoing a wallet change\b", "undoing a payout address change"),
    (r"\bthis wallet before it's saved\b", "this address before it's saved"), (r"\bthis wallet is saved\b", "this address is saved"),
    (r"\bfor any wallet changes\b", "for any payout address changes"), (r"\bTo add a wallet\b", "To add a payout address"),
    (r"\bbefore adding wallet addresses\b", "before adding payout addresses"),
    (r"\bAdd Funds to Wallet\b", "Add Funds to Wallet"),  # customer-ledger API, keep (no-op guard)
    (r"\bWallets Configured\b", "Payout addresses configured"),
    (r"\bthe payout to your wallet has not completed\b", "the payout to your payout address has not completed"),
]
EN_EXACT = {"Wallet": "Payout address", "Wallets": "Payout addresses", "wallet setup": "payout address setup"}

# ---------------------------------------------------------------- other-language rules
DE = [
    (r"Auszahlungs-Wallets|Auszahlungswallets|Auszahlung-Wallets", "Auszahlungsadressen"),
    (r"Auszahlungs-Wallet|Auszahlungswallet|Auszahlung-Wallet", "Auszahlungsadresse"),
    (r"Wallet-Änderungen|Walletänderungen", "Änderungen an Auszahlungsadressen"),
    (r"Wallet-Änderung|Walletänderung", "Änderung der Auszahlungsadresse"),
    (r"Wallet-Sicherheit|Walletsicherheit", "Sicherheit der Auszahlungsadressen"),
    (r"Wallet-Schutz", "Schutz der Auszahlungsadressen"),
    (r"Wallet-Einrichtung|Wallet-Setup", "Einrichtung der Auszahlungsadresse"),
    (r"Wallet-Namen?", "Bezeichnung"), (r"Wallet-Adressen", "Auszahlungsadressen"), (r"Wallet-Adresse", "Auszahlungsadresse"),
    (r"\bdas Wallet\b", "die Auszahlungsadresse"), (r"\bein Wallet\b", "eine Auszahlungsadresse"), (r"\bkein Wallet\b", "keine Auszahlungsadresse"),
    (r"\bIhrem Wallet\b", "Ihrer Auszahlungsadresse"), (r"\bdeinem Wallet\b", "deiner Auszahlungsadresse"),
    (r"\bIhr Wallet\b", "Ihre Auszahlungsadresse"), (r"\bdein Wallet\b", "deine Auszahlungsadresse"),
    (r"\bdieses Wallet\b", "diese Auszahlungsadresse"), (r"\bdiesem Wallet\b", "dieser Auszahlungsadresse"),
    (r"\bdes Wallets\b", "der Auszahlungsadresse"), (r"\bzum Wallet\b", "zur Auszahlungsadresse"),
    (r"\bWallets\b", "Auszahlungsadressen"), (r"\bwallets\b", "Auszahlungsadressen"),
    (r"\bWallet\b", "Auszahlungsadresse"), (r"\bwallet\b", "Auszahlungsadresse"),
    (r"Ihres Auszahlungsadressen\b", "Ihrer Auszahlungsadresse"),
    (r"Auszahlungsadresse-Adressen", "Auszahlungsadressen"), (r"Auszahlungsadresse-Adresse", "Auszahlungsadresse"),
    (r"Auszahlungsadresse-Änderungen", "Änderungen an Auszahlungsadressen"),
    (r"Adresse einer Auszahlungsadresse geändert", "Auszahlungsadresse geändert"),
    (r"\bein (Stablecoin-|USDT/USDC-)?Auszahlungsadresse\b", r"eine \1Auszahlungsadresse"), (r"\bdas Auszahlungsadresse\b", "die Auszahlungsadresse"),
    (r"\bIhr (USDT/USDC-)?Auszahlungsadresse\b", r"Ihre \1Auszahlungsadresse"), (r"\bdein Auszahlungsadresse\b", "deine Auszahlungsadresse"),
    (r"\b(ausgewählt|aktiv)es Auszahlungsadresse\b", r"\1e Auszahlungsadresse"),
    (r"Verbinden Sie eine Auszahlungsadresse, um", "Fügen Sie eine Auszahlungsadresse hinzu, um"),
    (r"Auszahlungsadresse-Löschung bestätigen", "Entfernen der Auszahlungsadresse bestätigen"),
    (r"Auszahlungsadresse-Bearbeitung bestätigen", "Bearbeitung der Auszahlungsadresse bestätigen"),
    (r"Auszahlungsadresse-Aktualisierung bestätigen", "Aktualisierung der Auszahlungsadresse bestätigen"),
    (r"Auszahlungsadresse-Bestätigungscode", "Bestätigungscode für die Auszahlungsadresse"),
]
NL = [
    (r"Uitbetaalwallets|Uitbetalingswallets", "Uitbetalingsadressen"), (r"uitbetaalwallets|uitbetalingswallets", "uitbetalingsadressen"),
    (r"Uitbetaalwallet|Uitbetalingswallet", "Uitbetalingsadres"), (r"uitbetaalwallet|uitbetalingswallet", "uitbetalingsadres"),
    (r"Walletwijzigingen", "Wijzigingen aan uitbetalingsadressen"), (r"walletwijzigingen", "wijzigingen aan uitbetalingsadressen"),
    (r"Walletwijziging", "Wijziging van het uitbetalingsadres"), (r"walletwijziging", "wijziging van het uitbetalingsadres"),
    (r"Walletbeveiliging", "Beveiliging van uitbetalingsadressen"), (r"Walletbescherming", "Bescherming van uitbetalingsadressen"),
    (r"Walletnaam", "Naam"), (r"Walletadressen", "Uitbetalingsadressen"), (r"Walletadres", "Uitbetalingsadres"),
    (r"walletadressen", "uitbetalingsadressen"), (r"walletadres", "uitbetalingsadres"),
    (r"\bde wallet\b", "het uitbetalingsadres"), (r"\bDe wallet\b", "Het uitbetalingsadres"),
    (r"\bdeze wallet\b", "dit uitbetalingsadres"), (r"\bDeze wallet\b", "Dit uitbetalingsadres"),
    (r"\bde portemonnee\b", "het uitbetalingsadres"), (r"\bdeze portemonnee\b", "dit uitbetalingsadres"),
    (r"\bPortemonnees\b", "Uitbetalingsadressen"), (r"\bportemonnees\b", "uitbetalingsadressen"),
    (r"\bPortemonnee\b", "Uitbetalingsadres"), (r"\bportemonnee\b", "uitbetalingsadres"),
    (r"\bWallets\b", "Uitbetalingsadressen"), (r"\bwallets\b", "uitbetalingsadressen"),
    (r"\bWallet\b", "Uitbetalingsadres"), (r"\bwallet\b", "uitbetalingsadres"),
    (r"uitbetalings-uitbetalingsadres", "uitbetalingsadres"), (r"uitbetalingsadres-adressen", "uitbetalingsadressen"),
    (r"geselecteerde uitbetalingsadres\b", "geselecteerd uitbetalingsadres"), (r"actieve uitbetalingsadres\b", "actief uitbetalingsadres"),
    (r"passende stablecoin-uitbetalingsadres", "passend stablecoin-uitbetalingsadres"),
    (r"Adres van een uitbetalingsadres gewijzigd", "Uitbetalingsadres gewijzigd"),
    (r"Verbind een uitbetalingsadres om", "Voeg een uitbetalingsadres toe om"),
    (r"\bde uitbetalingsadres\b", "het uitbetalingsadres"), (r"\bDe uitbetalingsadres\b", "Het uitbetalingsadres"),
    (r"Open uitbetalingsadres\b", "Open uitbetalingsadressen"),
]
ES = [
    (r"\b(wallets|billeteras|carteras) de (cobro|pago|pagos)\b", "direcciones de cobro"),
    (r"\b(Wallets|Billeteras|Carteras) de (cobro|pago|pagos)\b", "Direcciones de cobro"),
    (r"\b(wallet|billetera|cartera) de (cobro|pago|pagos)\b", "dirección de cobro"),
    (r"\b(Wallet|Billetera|Cartera) de (cobro|pago|pagos)\b", "Dirección de cobro"),
    (r"\b(wallets|billeteras|carteras) de liquidación\b", "direcciones de liquidación"),
    (r"\b(wallet|billetera|cartera) de liquidación\b", "dirección de liquidación"),
    (r"Nombre de la (Billetera|billetera|Cartera|cartera|Wallet|wallet)", "Nombre"),
    (r"Dirección de la (Billetera|billetera|Cartera|cartera|Wallet|wallet)", "Dirección"),
    (r"\bcambios de (wallet|billetera|cartera)\b", "cambios de dirección de cobro"), (r"\bcambio de (wallet|billetera|cartera)\b", "cambio de dirección de cobro"),
    (r"\bSeguridad de (wallets|billeteras|carteras)\b", "Seguridad de las direcciones de cobro"),
    (r"\b(Wallets|Billeteras|Carteras)\b", "Direcciones de cobro"), (r"\b(wallets|billeteras|carteras)\b", "direcciones de cobro"),
    (r"\b(Wallet|Billetera|Cartera)\b", "Dirección de cobro"), (r"\b(wallet|billetera|cartera)\b", "dirección de cobro"),
    (r"direcci(ó|o)n de (la |una |tu |su )?direcci(ó|o)n de cobro", "dirección de cobro"), (r"Direcci(ó|o)n de (la |una |su )?direcci(ó|o)n de cobro", "Dirección de cobro"),
    (r"direcciones de (las |sus |tus )?direcci(ó|o)n(es)? de cobro", "direcciones de cobro"),
    (r"direcci(ó|o)n de cobro de cobros?", "dirección de cobro"), (r"direcci(ó|o)n de cobro de retiro", "dirección de cobro"), (r"direcciones de cobro de retiro", "direcciones de cobro"),
    (r"direcci(ó|o)n de cobro de liquidaci(ó|o)n", "dirección de liquidación"), (r"Direcci(ó|o)n de cobro de liquidaci(ó|o)n", "Dirección de liquidación"),
    (r"direcciones de cobro de liquidaci(ó|o)n", "direcciones de liquidación"), (r"Direcciones de cobro de liquidaci(ó|o)n", "Direcciones de liquidación"),
    (r"Direcciones de cobro Activas", "Direcciones de cobro activas"), (r"Todas las Direcciones de cobro", "Todas las direcciones de cobro"),
    (r"Agregar Dirección de cobro", "Agregar dirección de cobro"),
    (r"El nombre de la dirección de cobro es obligatorio", "El nombre es obligatorio"),
    (r"Conecta una dirección de cobro", "Añade una dirección de cobro"),
    (r"Se cambió la dirección de una dirección de cobro", "Se cambió una dirección de cobro"),
    (r"Abrir dirección de cobro\b", "Abrir direcciones de cobro"),
]
FR = [
    (r"\b(portefeuilles|wallets) de (versement|paiement|réception)\b", "adresses de versement"),
    (r"\b(Portefeuilles|Wallets) de (versement|paiement|réception)\b", "Adresses de versement"),
    (r"\b(portefeuille|wallet) de (versement|paiement|réception)\b", "adresse de versement"),
    (r"\b(Portefeuille|Wallet) de (versement|paiement|réception)\b", "Adresse de versement"),
    (r"\b(portefeuilles|wallets) de règlement\b", "adresses de règlement"), (r"\b(portefeuille|wallet) de règlement\b", "adresse de règlement"),
    (r"Nom du (Portefeuille|portefeuille|Wallet|wallet)", "Nom"), (r"Adresse du (Portefeuille|portefeuille|Wallet|wallet)", "Adresse"),
    (r"\bmodifications? de (wallet|portefeuille)\b", "modifications d'adresse de versement"),
    (r"\bSécurité des (wallets|portefeuilles)\b", "Sécurité des adresses de versement"),
    (r"\bun (portefeuille|wallet)\b", "une adresse de versement"), (r"\bUn (portefeuille|wallet)\b", "Une adresse de versement"),
    (r"\ble (portefeuille|wallet)\b", "l'adresse de versement"), (r"\bLe (portefeuille|wallet)\b", "L'adresse de versement"),
    (r"\bdu (portefeuille|wallet)\b", "de l'adresse de versement"), (r"\bau (portefeuille|wallet)\b", "à l'adresse de versement"),
    (r"\bce (portefeuille|wallet)\b", "cette adresse de versement"), (r"\bCe (portefeuille|wallet)\b", "Cette adresse de versement"),
    (r"\baucun (portefeuille|wallet)\b", "aucune adresse de versement"), (r"\bAucun (portefeuille|wallet)\b", "Aucune adresse de versement"),
    (r"\bnouveau (portefeuille|wallet)\b", "nouvelle adresse de versement"), (r"\bNouveau (portefeuille|wallet)\b", "Nouvelle adresse de versement"),
    (r"\bpremier (portefeuille|wallet)\b", "première adresse de versement"),
    (r"\b(Portefeuilles|Wallets)\b", "Adresses de versement"), (r"\b(portefeuilles|wallets)\b", "adresses de versement"),
    (r"\b(Portefeuille|Wallet)\b", "Adresse de versement"), (r"\b(portefeuille|wallet)\b", "adresse de versement"),
    (r"adresse de versement (ajouté|supprimé|modifié|configuré|mis à jour|actif|vérifié|activé|enregistré)\b",
     lambda m: "adresse de versement " + {"actif": "active", "mis à jour": "mise à jour"}.get(m.group(1), m.group(1) + "e")),
    (r"adresses de versement (ajoutés|supprimés|modifiés|configurés|actifs|vérifiés|activés|enregistrés)\b", lambda m: "adresses de versement " + m.group(1)[:-1] + "es"),
    (r"adresses? de (l')?adresses? de versement", "adresse de versement"), (r"adresses de (vos |les )?adresses? de versement", "adresses de versement"),
    (r"Adresses? de (l')?adresses? de versement", "Adresse de versement"),
    (r"adresse de versement de retrait", "adresse de versement"), (r"adresses de versement de retrait", "adresses de versement"),
    (r"adresse de versement de règlement", "adresse de règlement"), (r"Adresse de versement de règlement", "Adresse de règlement"),
    (r"adresses de versement de règlement", "adresses de règlement"), (r"Adresses de versement de règlement", "Adresses de règlement"),
    (r"\bun (autre )?adresse de", r"une \1adresse de"), (r"\bUn (autre )?adresse de", r"Une \1adresse de"),
    (r"\bun Adresse de versement", "une adresse de versement"),
    (r"\baucun adresse de", "aucune adresse de"), (r"\bAucun adresse de", "Aucune adresse de"),
    (r"\ble adresse de", "l'adresse de"), (r"\bLe adresse de", "L'adresse de"),
    (r"\bde adresse", "d'adresse"), (r"\bDe adresse", "D'adresse"),
    (r"\bnouveau adresse", "nouvelle adresse"), (r"\bNouveau adresse", "Nouvelle adresse"), (r"\bnouveau adresse", "nouvelle adresse"),
    (r"\bpremier adresse", "première adresse"), (r"\btous les adresses", "toutes les adresses"), (r"\bTous les Adresses", "Toutes les adresses"),
    (r"Ajoutez-en un\b", "Ajoutez-en une"), (r"ajoutez le premier pour", "ajoutez la première pour"),
    (r"([Aa]dresses? de (?:versement|règlement)(?: en stablecoin| stablecoin| USDT/USDC| USDT \(TRC-20\))?) (ajouté|supprimé|copié|sélectionné|configuré|enregistré|modifié|retiré|vérifié|activé|requis)\b(?!e)",
     lambda m: m.group(1) + " " + ("requise" if m.group(2) == "requis" else m.group(2) + "e")),
    (r"([Aa]dresses de (?:versement|règlement)) (ajoutés|supprimés|copiés|sélectionnés|configurés|enregistrés|modifiés|protégés|associés)\b", lambda m: m.group(1) + " " + m.group(2)[:-1] + "es"),
    (r"([Aa]dresses de versement) (actifs|Actifs|actifes)", r"\1 actives"), (r"adresses de versement sont protégés", "adresses de versement sont protégées"),
    (r"\bUn nouvelle adresse", "Une nouvelle adresse"), (r"adresse de versement a été ajouté\b", "adresse de versement a été ajoutée"), (r"adresse de versement mis à jour", "adresse de versement mise à jour"),
    (r"Adresse d'un adresse de versement modifiée", "Adresse de versement modifiée"),
    (r"Connectez une adresse de versement", "Ajoutez une adresse de versement"),
    (r"Le nom de l'adresse de versement est obligatoire", "Le nom est obligatoire"),
    (r"Toute modifications d'adresse de versement demande", "Toute modification d'adresse de versement demande"),
    (r"Ouvrir l'adresse de versement\b", "Ouvrir les adresses de versement"),
    (r"Un nouveau adresse de versement a été ajouté", "Une nouvelle adresse de versement a été ajoutée"),
    (r"Une adresse de versement a été supprimé\b", "Une adresse de versement a été supprimée"),
]
PT = [
    (r"\b(carteiras|wallets) de (recebimento|pagamento|pagamentos|levantamento)\b", "endereços de recebimento"),
    (r"\b(Carteiras|Wallets) de (recebimento|pagamento|pagamentos|levantamento)\b", "Endereços de recebimento"),
    (r"\b(carteira|wallet) de (recebimento|pagamento|pagamentos|levantamento)\b", "endereço de recebimento"),
    (r"\b(Carteira|Wallet) de (recebimento|pagamento|pagamentos|levantamento)\b", "Endereço de recebimento"),
    (r"\b(carteiras|wallets) de liquidação\b", "endereços de liquidação"), (r"\b(carteira|wallet) de liquidação\b", "endereço de liquidação"),
    (r"Nome da (Carteira|carteira|Wallet|wallet)", "Nome"), (r"Endereço da (Carteira|carteira|Wallet|wallet)", "Endereço"),
    (r"\balterações (de|da|às|nas) (wallet|carteira)s?\b", "alterações do endereço de recebimento"),
    (r"\balteração (de|da) (wallet|carteira)\b", "alteração do endereço de recebimento"),
    (r"\bSegurança d(as|e) (wallets|carteiras)\b", "Segurança dos endereços de recebimento"),
    (r"\ba (carteira|wallet)\b", "o endereço de recebimento"), (r"\bA (carteira|wallet)\b", "O endereço de recebimento"),
    (r"\bas (carteiras|wallets)\b", "os endereços de recebimento"), (r"\bAs (carteiras|wallets)\b", "Os endereços de recebimento"),
    (r"\buma (carteira|wallet)\b", "um endereço de recebimento"), (r"\bUma (carteira|wallet)\b", "Um endereço de recebimento"),
    (r"\bsua (carteira|wallet)\b", "seu endereço de recebimento"), (r"\bSua (carteira|wallet)\b", "Seu endereço de recebimento"),
    (r"\bsuas (carteiras|wallets)\b", "seus endereços de recebimento"), (r"\bSuas (carteiras|wallets)\b", "Seus endereços de recebimento"),
    (r"\bda (carteira|wallet)\b", "do endereço de recebimento"), (r"\bdas (carteiras|wallets)\b", "dos endereços de recebimento"),
    (r"\bna (carteira|wallet)\b", "no endereço de recebimento"), (r"\bnas (carteiras|wallets)\b", "nos endereços de recebimento"),
    (r"\bà (carteira|wallet)\b", "ao endereço de recebimento"), (r"\bàs (carteiras|wallets)\b", "aos endereços de recebimento"),
    (r"\besta (carteira|wallet)\b", "este endereço de recebimento"), (r"\bEsta (carteira|wallet)\b", "Este endereço de recebimento"),
    (r"\bessa (carteira|wallet)\b", "esse endereço de recebimento"), (r"\bnenhuma (carteira|wallet)\b", "nenhum endereço de recebimento"),
    (r"\bNenhuma (carteira|wallet)\b", "Nenhum endereço de recebimento"),
    (r"\bNova (Carteira|carteira|Wallet|wallet)\b", "Novo endereço de recebimento"), (r"\bnova (carteira|wallet)\b", "novo endereço de recebimento"),
    (r"\bprimeira (carteira|wallet)\b", "primeiro endereço de recebimento"),
    (r"\b(Carteiras|Wallets)\b", "Endereços de recebimento"), (r"\b(carteiras|wallets)\b", "endereços de recebimento"),
    (r"\b(Carteira|Wallet)\b", "Endereço de recebimento"), (r"\b(carteira|wallet)\b", "endereço de recebimento"),
    (r"endereço de recebimento (adicionada|removida|atualizada|eliminada|configurada|ativa|verificada|excluída|apagada|guardada)\b",
     lambda m: "endereço de recebimento " + m.group(1)[:-1] + "o"),
    (r"endereços de recebimento (adicionadas|removidas|atualizadas|eliminadas|configuradas|ativas|verificadas|excluídas|copiadas)\b",
     lambda m: "endereços de recebimento " + m.group(1)[:-2] + "os"),
    (r"Gerencie os endereços da seu endereço de recebimento de criptomoedas\.", "Gerencie os seus endereços de recebimento."),
    (r"Gerencie os endereços das suas endereços de recebimento para", "Gerencie os seus endereços de recebimento para"),
    (r"endereços? d[oa]s? (suas? |seus? )?endereços? de recebimento", "endereço de recebimento"),
    (r"endereços? de (um |uma )?endereços? de recebimento", "endereço de recebimento"),
    (r"os oito endereço de recebimento", "os oito endereços de recebimento"), (r"copie o endereço de recebimento que", "copie os endereços de recebimento que"),
    (r"endereço de recebimento de saque", "endereço de recebimento"), (r"endereços de recebimento de saque", "endereços de recebimento"),
    (r"[Ee]ndereço de recebimento de liquidação", "endereço de liquidação"), (r"[Ee]ndereços de recebimento de liquidação", "endereços de liquidação"),
    (r"Adicionar Novo endereço de recebimento", "Adicionar endereço de recebimento"), (r"Adicionar Endereço de recebimento", "Adicionar endereço de recebimento"),
    (r"Endereço de uma endereço de recebimento alterado", "Endereço de recebimento alterado"),
    (r"Conecte um endereço de recebimento", "Adicione um endereço de recebimento"),
    (r"O nome do endereço de recebimento é obrigatório", "O nome é obrigatório"), (r"antes de a guardar", "antes de o guardar"),
    (r"\b[Aa] sua primeiro endereço", "o seu primeiro endereço"), (r"\ba primeiro endereço", "o primeiro endereço"),
    (r"\ba (sua|seu) endereço", "o seu endereço"), (r"\bA (sua|seu) endereço", "O seu endereço"), (r"\ba tua endereço", "o teu endereço"),
    (r"\bsua endereço", "seu endereço"), (r"\bSua endereço", "Seu endereço"), (r"\btua endereço", "teu endereço"),
    (r"\bas (suas|tuas) endereços", lambda m: "os " + ("seus" if m.group(1) == "suas" else "teus") + " endereços"),
    (r"\bsuas endereços", "seus endereços"), (r"\btuas endereços", "teus endereços"),
    (r"\buma endereço", "um endereço"), (r"\bUma endereço", "Um endereço"), (r"\bnenhuma endereço", "nenhum endereço"), (r"\bNenhuma endereço", "Nenhum endereço"),
    (r"\bUma nova endereço", "Um novo endereço"), (r"\buma nova endereço", "um novo endereço"), (r"\bnova endereço", "novo endereço"), (r"\bNova endereço", "Novo endereço"),
    (r"\boutra endereço", "outro endereço"), (r"\bprimeira endereço", "primeiro endereço"), (r"adiciona a primeira para", "adiciona o primeiro para"),
    (r"\bestas endereços", "estes endereços"), (r"\bas mesmas endereços", "os mesmos endereços"), (r"\bàs endereços", "aos endereços"),
    (r"\bas endereços", "os endereços"), (r"\bAs endereços", "Os endereços"), (r"\ba endereço", "o endereço"), (r"\bA endereço", "O endereço"),
    (r"\bda endereço", "do endereço"), (r"\bdas endereços", "dos endereços"), (r"\bna endereço", "no endereço"), (r"\bnas endereços", "nos endereços"),
    (r"\btodas os endereços", "todos os endereços"), (r"\bTodas as Endereços", "Todos os endereços"), (r"Endereços de recebimento Ativas", "Endereços de recebimento ativos"),
    (r"([Ee]ndereços? de (?:recebimento|liquidação)(?: em stablecoin| stablecoin| USDT/USDC)?) (adicionada|removida|atualizada|eliminada|configurada|ativa|verificada|excluída|copiada|selecionada|salva|necessária|guardada|protegida|atribuída)\b",
     lambda m: m.group(1) + " " + m.group(2)[:-1] + "o"),
    (r"([Ee]ndereços de (?:recebimento|liquidação)) (adicionadas|removidas|atualizadas|configuradas|ativas|copiadas|selecionadas|protegidas|atribuídas|salvas)\b",
     lambda m: m.group(1) + " " + m.group(2)[:-2] + "os"),
    (r"(endereço de recebimento[^.]{0,40}?) (foi|está|será) (adicionada|removida|atualizada|verificada|eliminada)\b", lambda m: f"{m.group(1)} {m.group(2)} {m.group(3)[:-1]}o"),
    (r"está agora ativa\b", "está agora ativo"), (r"\bda seu endereço", "do seu endereço"), (r"\bna seu endereço", "no seu endereço"), (r"\bnuma endereço", "num endereço"), (r"Adicione uma nas Configurações", "Adicione um nas Configurações"), (r"adicione uma para os pagamentos", "adicione um para os pagamentos"),
    (r"Abrir endereço de recebimento\b", "Abrir endereços de recebimento"),
]
LANG_RULES = {"de": DE, "nl": NL, "es": ES, "fr": FR, "pt": PT}


def apply(rules, s):
    for pat, rep in rules:
        s = re.sub(pat, rep, s)
    return s


def apply_en(s):
    if s in EN_EXACT:
        return EN_EXACT[s]
    return apply(EN, s)


# ---------------------------------------------------------------- targets
FE_LOCALE_FILES = {
    "walletScreen.json": None,  # None = every key
    "dashboardLayout.json": None,
    "pageTitles.json": ("wallet_title", "wallet_desc", "walletSecurity_title", "walletSecurity_desc"),
    "transactions.json": ("allWallets", "settlementWallet"),
    "notifications.json": None,
    "createPaymentLinkScreen.json": None,
    "companySettings.json": None,
    "companyDialog.json": None,
    "auth.json": ("twoFactor.resetConsequences",),
    "apiScreen.json": ("keys.liveUnlockHint", "pk.allowedCurrenciesPlaceholder"),
    "paymentLinks.json": None,
    "referrals.json": None,
    "common.json": ("pageTips.", "EmptyWallet", "addWallet", "deleteWallet", "whatIsPayoutWallet", "team.", "activityLog.wallet.",
                    "setupPrompt.addWallet", "payouts.", "walletSecurityLanding.", "stepUp.scope.wallet"),
}
BE_LOCALE_SKIP_PREFIXES = ("merchant.subscriptionPaymentFailed", "merchant.conversionFailed", "overpayment.buyerIntro", "chrome.whyBuyer",
                          "merchant.welcome.intro2", "merchant.companyContactWelcome", "referral.why2")

TSX_DENY = {
    "pages/documentation.tsx", "pages/_app.tsx", "pages/how-to.tsx", "pages/payment/success.tsx", "utils/blogData.ts",
    "Components/Modals/DemoVideoModal.tsx", "Components/UI/AuthLayout/BrandContent/LiveBrandContent.tsx",
    "Components/UI/DisplayCurrencySelector/index.tsx", "Components/Page/Customers/index.tsx", "Components/Common/SupportChatWidget/index.tsx",
    "Components/Page/GetStarted/WalletHelp.tsx",
}
BE_TS_FILES = [
    "backend/services/email/walletEmails.ts", "backend/services/email/walletSecurityEmails.ts", "backend/services/email/orderEmails.ts",
    "backend/services/email/adminOpsEmails.ts", "backend/services/email/securityEmails.ts", "backend/services/email/referralEmails.ts",
    "backend/services/email/adminNotificationEmails.ts", "backend/services/conversionService.ts",
]

STRING_RE = re.compile(r'"((?:[^"\\\n]|\\.)*)"|\'((?:[^\'\\\n]|\\.)*)\'|`((?:[^`\\]|\\.)*)`', re.S)

report = []


def log(kind, where, before, after):
    if before != after:
        report.append((kind, where, before, after))


def walk_set(obj, path, fn):
    """Apply fn(dotted_key, value) -> new value to every string leaf; returns set of changed keys."""
    changed = set()
    if isinstance(obj, dict):
        for k, v in obj.items():
            p = f"{path}.{k}" if path else k
            if isinstance(v, str):
                nv = fn(p, v)
                if nv != v:
                    obj[k] = nv
                    changed.add(p)
            else:
                changed |= walk_set(v, p, fn)
    return changed


def key_allowed(key, allowed):
    if allowed is None:
        return True
    return any(key == a or key.startswith(a) for a in allowed)


def get_key(obj, dotted):
    for part in dotted.split("."):
        if not isinstance(obj, dict) or part not in obj:
            return None, None
        parent, obj = obj, obj[part]
    return parent, part


def process_locale_set(base_dir, filename, allowed, skip_prefixes=()):
    en_path = base_dir / "en" / filename
    if not en_path.exists():
        return
    en = json.loads(en_path.read_text())

    def en_fn(key, v):
        if not key_allowed(key, allowed) or key.startswith(skip_prefixes):
            return v
        nv = apply_en(v)
        log("en", f"{filename}::{key}", v, nv)
        return nv

    changed = walk_set(en, "", en_fn)
    if not changed:
        return
    if not DRY:
        en_path.write_text(json.dumps(en, ensure_ascii=False, indent=2) + "\n")
    for lang, rules in LANG_RULES.items():
        p = base_dir / lang / filename
        if not p.exists():
            continue
        data = json.loads(p.read_text())
        touched = False
        for key in sorted(changed):
            parent, leaf = get_key(data, key)
            if parent is None or not isinstance(parent.get(leaf), str):
                continue
            nv = apply(rules, parent[leaf])
            if nv != parent[leaf]:
                log(lang, f"{filename}::{key}", parent[leaf], nv)
                parent[leaf] = nv
                touched = True
        if touched and not DRY:
            p.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")


def process_source(path):
    src = path.read_text()

    def sub(m):
        raw = m.group(0)
        inner = m.group(1) if m.group(1) is not None else (m.group(2) if m.group(2) is not None else m.group(3))
        if " " not in inner or not re.search(r"wallet", inner, re.I):
            return raw
        nv = apply(EN, inner)
        log("src", str(path.relative_to(ROOT)), inner, nv)
        return raw[0] + nv + raw[-1]

    out = STRING_RE.sub(sub, src)
    if out != src and not DRY:
        path.write_text(out)


def main():
    fe = ROOT / "langs" / "locales"
    for filename, allowed in FE_LOCALE_FILES.items():
        process_locale_set(fe, filename, allowed)
    process_locale_set(ROOT / "backend" / "locales", "emails.json", None, BE_LOCALE_SKIP_PREFIXES)

    for pattern in ("pages/**/*.tsx", "Components/**/*.tsx", "Components/**/*.ts", "hooks/**/*.ts", "utils/**/*.ts", "constants/**/*.ts"):
        for p in ROOT.glob(pattern):
            rel = str(p.relative_to(ROOT))
            if rel in TSX_DENY or "/Admin/" in rel or "node_modules" in rel or "Pay3Components" in rel:
                continue
            if not re.search(r"wallet", p.read_text(), re.I):
                continue
            process_source(p)
    for rel in BE_TS_FILES:
        p = ROOT / rel
        src = p.read_text()
        out = apply(EN, src)
        if out != src:
            log("src", rel, "(whole file)", f"{sum(1 for a, b in zip(src.splitlines(), out.splitlines()) if a != b)} lines")
            if not DRY:
                p.write_text(out)

    if REPORT:
        lines = ["# Wallet → Payout address rename report", ""]
        for kind, where, before, after in report:
            lines.append(f"- **{kind}** `{where}`\n  - − {before}\n  - + {after}")
        REPORT.write_text("\n".join(lines) + "\n")
    print(f"{'DRY ' if DRY else ''}changed {len(report)} strings")


if __name__ == "__main__":
    main()
