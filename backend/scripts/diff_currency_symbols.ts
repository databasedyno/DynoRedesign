/* Verify the consolidated getCurrencySymbol variants reproduce the ORIGINAL
 * per-context output byte-for-byte. Read-only, no DB writes. */
import { getCurrencySymbol } from "../utils/currencyUtils";
import { getCurrencySymbol as emailWrapper } from "../utils/emailTemplate";

// ── ORIGINAL implementations (verbatim copies of the pre-refactor code) ──
const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$', EUR: '€', GBP: '£', AUD: 'A$', CAD: 'C$', INR: '₹', NGN: '₦', VND: '₫',
  PKR: '₨', BRL: 'R$', ARS: 'ARS$', PHP: '₱', SGD: 'S$', AED: 'د.إ',
  CHF: 'CHF', CNY: '¥', JPY: '¥', HKD: 'HK$', NZD: 'NZ$',
  ZAR: 'R', KES: 'KSh', GHS: 'GH₵', MXN: 'MX$', XOF: 'CFA', XAF: 'FCFA', EGP: 'E£', MAD: 'DH',
  BTC: '₿', ETH: 'Ξ', USDT: '₮', USDC: 'USDC',
};
const origDefault = (currency: string) => CURRENCY_SYMBOLS[currency?.toUpperCase()] || currency || '';

const EMAIL: Record<string, string> = {
  USD: '$', EUR: '€', GBP: '£', AUD: 'A$', CAD: 'C$', CHF: 'CHF ',
  CNY: '¥', JPY: '¥', HKD: 'HK$', NZD: 'NZ$', SGD: 'S$',
  BRL: 'R$', ARS: 'ARS ', COP: 'COP ', CLP: 'CLP ', PEN: 'S/', MXN: 'MX$', VES: 'Bs.', UYU: '$U',
  NGN: '₦', ZAR: 'R', KES: 'KSh', GHS: 'GH₵', TZS: 'TSh', XAF: 'FCFA ', XOF: 'CFA ', EGP: 'E£', MAD: 'MAD ',
  UGX: 'USh', RWF: 'FRw', ETB: 'Br', ZMW: 'ZK', BWP: 'P', MUR: '₨', AOA: 'Kz', MZN: 'MT', CDF: 'FC'
};
const origEmail = (currency: string) => EMAIL[currency?.toUpperCase()] || `${currency} `;

const PDF: Record<string, string> = {
  USD: '$', EUR: '€', GBP: '£', AUD: 'A$', CAD: 'C$', CHF: 'CHF ',
  CNY: '¥', JPY: '¥', HKD: 'HK$', NZD: 'NZ$', SGD: 'S$',
  BRL: 'R$', NGN: '₦', ZAR: 'R', KES: 'KSh', MXN: 'MX$'
};
const origPdf = (currency: string) => PDF[currency?.toUpperCase()] || '';

const codes = new Set<string>([
  ...Object.keys(CURRENCY_SYMBOLS), ...Object.keys(EMAIL), ...Object.keys(PDF),
  'FOO', 'foo', 'usd', '',
]);

let fails = 0;
for (const c of codes) {
  const checks: [string, string, string][] = [
    ['default', getCurrencySymbol(c, 'default'), origDefault(c)],
    ['email(direct)', getCurrencySymbol(c, 'email'), origEmail(c)],
    ['email(wrapper)', emailWrapper(c), origEmail(c)],
    ['pdf', getCurrencySymbol(c, 'pdf'), origPdf(c)],
  ];
  for (const [variant, got, want] of checks) {
    if (got !== want) {
      fails++;
      console.log(`FAIL ${variant} "${c}": got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);
    }
  }
}
// no-arg default still works (existing callers)
if (getCurrencySymbol('EUR') !== '€') { fails++; console.log("FAIL default no-variant EUR"); }

console.log(fails === 0 ? "\nALL VARIANTS BYTE-IDENTICAL ✅" : `\n${fails} FAILURES ❌`);
process.exit(fails === 0 ? 0 : 1);
