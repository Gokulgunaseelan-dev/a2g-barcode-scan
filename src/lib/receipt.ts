import type { Sale } from "./store";

/** Generates and downloads a printable A5-style PDF receipt (jsPDF, client-only). */
export async function downloadReceipt(sale: Sale, storeName = "A2G Barcode Scan") {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: [80, 200] });
  let y = 10;

  doc.setFontSize(12).setFont("helvetica", "bold");
  doc.text(storeName, 40, y, { align: "center" });
  y += 5;
  doc.setFontSize(8).setFont("helvetica", "normal");
  doc.text("GSTIN 29ABCDE1234F1Z5 · +91 98765 43210", 40, y, { align: "center" });
  y += 6;
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
  doc.text("Item", 5, y);
  doc.text("Qty", 48, y);
  doc.text("Amount", 75, y, { align: "right" });
  y += 3;
  doc.line(5, y, 75, y);
  y += 4;
  doc.setFont("helvetica", "normal");

  for (const item of sale.items) {
    doc.text(item.name.slice(0, 26), 5, y);
    doc.text(String(item.qty), 48, y);
    doc.text((item.price * item.qty).toFixed(2), 75, y, { align: "right" });
    y += 4.5;
  }

  doc.line(5, y, 75, y);
  y += 5;
  const row = (label: string, value: string, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.text(label, 5, y);
    doc.text(value, 75, y, { align: "right" });
    y += 4.5;
  };
  row("Subtotal", sale.subtotal.toFixed(2));
  row("Discount", `-${sale.discount.toFixed(2)}`);
  row("GST", sale.tax.toFixed(2));
  row("TOTAL", sale.total.toFixed(2), true);
  row("Paid via", sale.paymentMode);

  y += 4;
  doc.setFontSize(8);
  doc.text("Thank you for shopping with us!", 40, y, { align: "center" });

  doc.save(`${sale.invoiceNo}.pdf`);
}