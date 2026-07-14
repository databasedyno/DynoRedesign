/**
 * Phase 3.3 P1 sanity: contribution vs standard subject/heading branching
 * across all locales. Run: `yarn ts-node --transpile-only tests/test_email_branching.ts`
 */
import { t, normalizeLang } from '../utils/emailI18n';
const langs = ['en', 'es', 'fr', 'de', 'nl', 'pt'];
for (const L of langs) {
  const norm = normalizeLang(L);
  console.log(`\n=== ${L.toUpperCase()} ===`);
  console.log(
    '  merchant standard  :',
    t('paymentReceived.subject', norm, { amount: '25.00', currency: 'USD' })
  );
  console.log(
    '  merchant contribute:',
    t('contributionReceived.subject', norm, { amount: '25.00', currency: 'USD', campaignName: 'Support Dynopay' })
  );
  console.log(
    '  donor standard     :',
    t('customerPaymentConfirmation.subject', norm, { companyName: 'hostbay' })
  );
  console.log(
    '  donor contribute   :',
    t('contributionThankYou.subject', norm, { campaignName: 'Support Dynopay' })
  );
  console.log(
    '  merchant heading   :',
    t('contributionReceived.heading', norm)
  );
  console.log(
    '  donor heading      :',
    t('contributionThankYou.heading', norm, { campaignName: 'Support Dynopay' })
  );
}
