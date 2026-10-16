// utils/paymentLinkData.ts
//
// ==============================================================================
// PAYMENT LINK — TEST DATA (SWB / DWB)
// ==============================================================================

// SWB SSS QRpay link — manual PRN input page (the landing page's "Yes, I have
// a PRN" answer leads here).
export const swbSssInputPrnUrl =
  'https://test-new-sss.billeroo.com/1722b098-aa14-4728-af69-e0803671d4c3/inputprn';

// What the Payment Checkout Summary shows for a PRN (values exactly as rendered).
export type SssCheckoutSummary = {
  prn: string;
  payeeName: string;
  ssNumber: string;
  memberType: string;
  monthStart: string; // MMYYYY
  monthEnd: string;   // MMYYYY
  billAmount: string;
  dueDate: string;    // MM/DD/YYYY
};

// LIMITED test data — each PRN can be PAID only once. Looking one up (PRN ->
// Next -> Checkout Summary) does NOT use it up; only completing payment does.
// Checked unpaid on 2026-10-15. Remove a PRN from here once a test pays it.
export const swbSssAvailablePrns: SssCheckoutSummary[] = [
  {
    prn: 'VC250000001177',
    payeeName: 'SURNM28, GIVNM28 MIDNM28',
    ssNumber: '0102710612',
    memberType: 'Voluntary',
    monthStart: '012026',
    monthEnd: '062026',
    billAmount: '4500.00',
    dueDate: '01/07/2027',
  },
];

// PRNs the full e2e / benchmark run PAYS — one per run, consumed in order.
// Confirmed unpaid on 2026-10-15. Paid ones are logged (and skipped
// automatically) in benchmarks/swb-sss-input-prn/used-prns.json. Kept separate
// from swbSssAvailablePrns so the Checkout Summary test's PRN is never paid.
// Self Employed (SC) PRNs are last: SC250000001915 and SC250000002011 both paid
// but got "Payment Posting Failed" on 2026-10-15 (an NF PRN posted fine).
export const swbSssPaymentPrnPool: string[] = [
  'VC250000001119', 'VC250000001355', 'VC250000001517',
  'OC250000001193', 'OC250000001229', 'OC250000001274', 'OC250000001300',
  'OC250000001407', 'OC250000001410',
  'SC250000001915', 'SC250000002011', 'SC250000002257', 'SC250000002299',
  'SC250000002419', 'SC250000002503',
];

// TLPE Transaction Info — Customer Details (name is prefilled from the PRN).
// Email is filled per account from paymentConsoleContext.email.
export const tlpeCustomerDetails = {
  mobile: '9171234567',
  address: '123 Test Street',
  city: 'Makati City',
  zip: '1200',
  stateProvince: 'Metro Manila',
};

// Visa test card for the TLPE test environment (3DS Simulator -> Approve).
export const tlpeTestVisaCard = {
  number: '4111111111111111',
  holderName: 'Justine Agner',
  expiry: '0331',
  cvv: '123',
};

// PAID by our runs (no longer usable for a successful payment):
//   NF260000036870 — 2026-10-15, full flow via TLPE + Visa 3DS (txn 261015081728QPE7140)

// ==============================================================================
// DWB (Dynamic Web Biller) — MANILA WATER COMPANY (ECPay - Bills Payment)
// ==============================================================================

export const dwbManilaWaterUrl =
  'https://test-pay.billeroo.com/7227265c-e920-470b-9dec-295dbe216c16/payment';

// Add-on fee the DWB page shows for Manila Water (Total = amount + this).
export const dwbManilaWaterAddOnFee = 10;

// Manila Water contract account number for DWB runs. Reusable — it can be
// paid any number of times (confirmed by QA, 2026-10-16), so both the free
// tests and the paid e2e/benchmark use it.
export const dwbManilaWaterAccount = '24312673';
