// utils/logTransactionSummary.ts
//
// ==============================================================================
// TRANSACTION SUMMARY LOGGER
// ==============================================================================
//
// Prints a clean, boxed, aligned summary of a payment's key details + fee
// breakdown to the console so every run leaves a human-readable record next to
// the screenshots. Purely cosmetic logging — no assertions, no side effects.
//
// USAGE:
//   logTransactionSummary('Bayad — Maynilad Water', {
//     'Processor':          'BAYAD',
//     'Service Provider':   'MAYNILAD WATER',
//     'Account Number':     accountNumber,
//     'Merchant Reference': merchantReference,
//     'Bill Amount':        `PHP ${amount}`,
//     'Add-on Fee':         `PHP ${addOnFee}`,
//     'Service Fee':        `PHP ${serviceFee}`,
//     'Total Amount':       `PHP ${total}`,
//     'Status':             'Payment Posted',
//   });
//
// ==============================================================================

/**
 * Logs a titled, boxed key/value summary with values right-aligned to a common
 * column. Keys keep their given order.
 */
export function logTransactionSummary(title: string, fields: Record<string, string | number | undefined>): void {
  const entries = Object.entries(fields).filter(([, v]) => v !== undefined && v !== '') as [string, string | number][];
  const labelWidth = Math.max(title.length, ...entries.map(([k]) => k.length));
  const lineWidth = Math.max(
    title.length,
    ...entries.map(([k, v]) => labelWidth + 3 + String(v).length),
  );
  const border = '─'.repeat(lineWidth + 2);

  const lines: string[] = [];
  lines.push(`┌${border}┐`);
  lines.push(`│ ${title.padEnd(lineWidth)} │`);
  lines.push(`├${border}┤`);
  for (const [key, value] of entries) {
    const row = `${key.padEnd(labelWidth)} : ${String(value)}`;
    lines.push(`│ ${row.padEnd(lineWidth)} │`);
  }
  lines.push(`└${border}┘`);

  // Single console.log call so the block stays together in parallel-worker output.
  console.log('\n' + lines.join('\n') + '\n');
}
