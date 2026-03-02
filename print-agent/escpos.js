/**
 * Build ESC/POS buffer untuk struk thermal (sama dengan Hisabia web).
 * Input: receipt object { orderId, outletName, date, items, subtotal, discount, total, paymentMethod, notes }
 * date bisa ISO string atau Date.
 */

const PAYMENT_LABELS = {
  cash: "Tunai",
  credit: "Hutang",
  transfer: "Transfer",
  qris: "QRIS",
  ewallet: "E-Wallet",
};

function formatIdr(n) {
  const v = Math.round(Number(n));
  return "Rp " + v.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function formatDate(date) {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" });
}

function buildEscPosBuffer(receipt) {
  const ESC = 0x1b;
  const GS = 0x1d;
  const LF = 0x0a;
  const buf = [];

  function add(...arr) {
    buf.push(...arr);
  }
  function addStr(s) {
    const b = Buffer.from(s, "utf8");
    for (let i = 0; i < b.length; i++) buf.push(b[i]);
  }
  function addLine(s) {
    addStr(s);
    add(LF);
  }

  add(ESC, 0x40);
  add(ESC, 0x61, 1);
  addLine(receipt.outletName);
  add(ESC, 0x61, 0);
  addLine(formatDate(receipt.date));
  addLine("#" + receipt.orderId);
  addLine("--------------------------------");
  add(ESC, 0x61, 0);
  for (const i of receipt.items) {
    addLine(i.name.length > 28 ? i.name.slice(0, 25) + "..." : i.name);
    addStr(`  ${i.qty} ${i.unit} x ${formatIdr(i.price)}`);
    add(LF);
    addStr("  " + formatIdr(i.lineTotal));
    add(LF);
  }
  addLine("--------------------------------");
  addLine(`Subtotal   ${formatIdr(receipt.subtotal)}`);
  if (Number(receipt.discount) > 0) addLine(`Diskon     -${formatIdr(receipt.discount)}`);
  add(ESC, 0x45, 1);
  addLine(`TOTAL      ${formatIdr(receipt.total)}`);
  add(ESC, 0x45, 0);
  addLine(`Bayar      ${PAYMENT_LABELS[receipt.paymentMethod] ?? receipt.paymentMethod}`);
  add(LF);
  add(ESC, 0x61, 1);
  addLine("Terima kasih");
  add(ESC, 0x61, 0);
  add(LF, LF, LF);
  add(GS, 0x56, 0);

  return Buffer.from(buf);
}

module.exports = { buildEscPosBuffer };
