import { computeTotals, discountPercentOf, readSettings, type Sale, type Settings } from "./store";

function lines(sale: Sale, settings: Settings) {
  const cur = settings.currency;
  const rate = settings.rate > 0 ? settings.rate : 1;
  const f = (n: number) => `${(n * rate).toFixed(2)}`;
  const totals = computeTotals(sale.items, sale.subtotal > 0 ? (sale.discount / sale.subtotal) * 100 : 0, sale.taxMode ?? "intra");
  return { f, cur, totals };
}

/** Builds the PDF document (jsPDF, client-only). */
async function buildDoc(sale: Sale, settings = readSettings()) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: [80, 240] });
  const { f, cur } = lines(sale, settings);
  let y = 9;

  doc.setFontSize(12).setFont("helvetica", "bold");
  doc.text(settings.storeName, 40, y, { align: "center" });
  y += 4.5;
  doc.setFontSize(7).setFont("helvetica", "normal");
  doc.text(settings.address, 40, y, { align: "center", maxWidth: 70 });
  y += 4;
  doc.text(`GSTIN ${settings.gstin}`, 40, y, { align: "center" });
  y += 5;
  doc.setFontSize(8);
  doc.text(`Invoice: ${sale.invoiceNo}`, 5, y);
  y += 4;
  doc.text(`Date: ${new Date(sale.createdAt).toLocaleString("en-IN")}`, 5, y);
  y += 4;
  if (sale.customer) {
    doc.text(`Customer: ${sale.customer}`, 5, y);
    y += 4;
  }
  doc.line(5, y, 75, y);
  y += 4;

  doc.setFont("helvetica", "bold");
  doc.text("Item / Barcode", 5, y);
  doc.text("Amt", 75, y, { align: "right" });
  y += 3;
  doc.line(5, y, 75, y);
  y += 4;
  doc.setFont("helvetica", "normal");

  for (const item of sale.items) {
    doc.text(item.name.slice(0, 30), 5, y);
    doc.text(f(item.price * item.qty), 75, y, { align: "right" });
    y += 3.6;
    doc.setFontSize(6.5).setTextColor(110);
    const mrp = item.mrp || item.price;
    doc.text(
      `${item.barcode || "no barcode"} · ${item.qty} ${item.unit ?? "pcs"} × MRP ${f(mrp)} → ${f(item.price)}` +
        (mrp > item.price ? ` (-${discountPercentOf(mrp, item.price).toFixed(1)}%)` : "") +
        ` · GST ${item.tax}%`,
      5,
      y,
      { maxWidth: 70 },
    );
    doc.setFontSize(8).setTextColor(0);
    y += 4.6;
  }

  doc.line(5, y, 75, y);
  y += 5;
  const row = (label: string, value: string, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.text(label, 5, y);
    doc.text(value, 75, y, { align: "right" });
    y += 4.3;
  };
  row("MRP total", f(sale.mrpTotal ?? sale.subtotal));
  row("Subtotal (selling)", f(sale.subtotal));
  row("Bill discount", `-${f(sale.discount)}`);
  row("Taxable value", f(sale.taxable ?? sale.subtotal - sale.discount));
  if ((sale.taxMode ?? "intra") === "intra") {
    row("CGST", f(sale.cgst ?? sale.tax / 2));
    row("SGST", f(sale.sgst ?? sale.tax / 2));
  } else {
    row("IGST", f(sale.igst ?? sale.tax));
  }
  row("Total GST", f(sale.tax));
  row(`TOTAL (${cur})`, f(sale.total), true);
  row("You saved", f(sale.savings ?? sale.discount));
  row("Paid via", sale.paymentMode);

  y += 4;
  doc.setFontSize(9).setFont("helvetica", "bold");
  doc.text("Thank you for shopping!", 40, y, { align: "center" });
  y += 4;
  doc.setFontSize(6.5).setFont("helvetica", "normal");
  doc.text("SmartCart · Mathematics-powered billing", 40, y, { align: "center" });
  return doc;
}

export async function downloadReceipt(sale: Sale) {
  const doc = await buildDoc(sale);
  doc.save(`${sale.invoiceNo}.pdf`);
}

export async function printReceipt(sale: Sale) {
  const doc = await buildDoc(sale);
  const url = doc.output("bloburl");
  window.open(url as unknown as string, "_blank");
}

export async function shareReceipt(sale: Sale) {
  const doc = await buildDoc(sale);
  const blob = doc.output("blob") as Blob;
  const file = new File([blob], `${sale.invoiceNo}.pdf`, { type: "application/pdf" });
  const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
  if (nav.share && nav.canShare?.({ files: [file] })) {
    await nav.share({ files: [file], title: sale.invoiceNo, text: "Your SmartCart receipt" });
    return true;
  }
  doc.save(`${sale.invoiceNo}.pdf`);
  return false;
}
