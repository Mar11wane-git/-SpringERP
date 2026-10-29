package com.springerp.invoicing;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.text.DecimalFormat;
import java.text.DecimalFormatSymbols;
import java.time.LocalDate;
import java.util.List;
import java.util.Locale;

import com.lowagie.text.Document;
import com.lowagie.text.Element;
import com.lowagie.text.Font;
import com.lowagie.text.FontFactory;
import com.lowagie.text.PageSize;
import com.lowagie.text.Paragraph;
import com.lowagie.text.Phrase;
import com.lowagie.text.Rectangle;
import com.lowagie.text.pdf.PdfPCell;
import com.lowagie.text.pdf.PdfPTable;
import com.lowagie.text.pdf.PdfWriter;
import com.springerp.company.CompanySettings;
import org.springframework.stereotype.Component;

/** Renders a printable A4 invoice from the persisted snapshot (never from live product data). */
@Component
public class InvoicePdfRenderer {

    private static final Color INK = new Color(17, 24, 39);
    private static final Color MUTED = new Color(107, 114, 128);
    private static final Color RULE = new Color(229, 231, 235);
    private static final Color ACCENT = new Color(37, 99, 235);

    private final Font title = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 20, INK);
    private final Font heading = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 10, INK);
    private final Font body = FontFactory.getFont(FontFactory.HELVETICA, 9, INK);
    private final Font muted = FontFactory.getFont(FontFactory.HELVETICA, 8, MUTED);
    private final Font strong = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 10, INK);

    public byte[] render(Invoice invoice, List<Payment> payments, CompanySettings company, LocalDate today) {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        Document doc = new Document(PageSize.A4, 42, 42, 48, 48);
        PdfWriter.getInstance(doc, out);
        doc.addTitle("Invoice " + invoice.getInvoiceNumber());
        doc.addCreator("SpringERP");
        doc.open();

        PdfPTable header = table(new float[] {3, 2});
        PdfPCell from = cell(Element.ALIGN_LEFT);
        from.addElement(new Paragraph(company.getName(), heading));
        addIfPresent(from, company.getLegalName());
        addIfPresent(from, company.formattedAddress());
        addIfPresent(from, company.getEmail());
        addIfPresent(from, company.getTaxId() == null ? null : "Tax ID: " + company.getTaxId());
        header.addCell(from);
        PdfPCell meta = cell(Element.ALIGN_RIGHT);
        Paragraph t = new Paragraph(invoice.getStatus() == Invoice.Status.CANCELLED ? "INVOICE (CANCELLED)" : "INVOICE",
                title);
        t.setAlignment(Element.ALIGN_RIGHT);
        meta.addElement(t);
        meta.addElement(right(invoice.getInvoiceNumber(), strong));
        meta.addElement(right("Issued " + invoice.getIssueDate() + "   Due " + invoice.getDueDate(), body));
        meta.addElement(right("Order " + invoice.getSalesOrder().getOrderNumber(), muted));
        header.addCell(meta);
        doc.add(header);

        Paragraph billTo = new Paragraph();
        billTo.setSpacingBefore(18);
        billTo.add(new Phrase("BILL TO\n", muted));
        billTo.add(new Phrase(invoice.getBillToName() + "\n", heading));
        if (invoice.getBillToAddress() != null) {
            billTo.add(new Phrase(invoice.getBillToAddress(), body));
        }
        doc.add(billTo);

        PdfPTable lines = table(new float[] {0.5f, 4.5f, 1, 1.6f, 1, 1, 1.8f});
        lines.setSpacingBefore(16);
        for (String h : new String[] {"#", "Description", "Qty", "Unit price", "Disc. %", "Tax %", "Amount"}) {
            PdfPCell c = new PdfPCell(new Phrase(h, muted));
            c.setBorder(Rectangle.BOTTOM);
            c.setBorderColor(RULE);
            c.setPaddingBottom(6);
            c.setHorizontalAlignment("Description".equals(h) || "#".equals(h) ? Element.ALIGN_LEFT : Element.ALIGN_RIGHT);
            lines.addCell(c);
        }
        String cur = invoice.getCurrency();
        for (InvoiceLine l : invoice.getLines()) {
            lines.addCell(lineCell(String.valueOf(l.getLineNo()), Element.ALIGN_LEFT));
            lines.addCell(lineCell(l.getDescription(), Element.ALIGN_LEFT));
            lines.addCell(lineCell(String.valueOf(l.getQuantity()), Element.ALIGN_RIGHT));
            lines.addCell(lineCell(money(l.getUnitPrice()), Element.ALIGN_RIGHT));
            lines.addCell(lineCell(money(l.getDiscountPercent()), Element.ALIGN_RIGHT));
            lines.addCell(lineCell(money(l.getTaxRate()), Element.ALIGN_RIGHT));
            lines.addCell(lineCell(money(l.getLineSubtotal()), Element.ALIGN_RIGHT));
        }
        doc.add(lines);

        PdfPTable totals = table(new float[] {5, 2, 2});
        totals.setSpacingBefore(12);
        totalRow(totals, "Subtotal", money(invoice.getSubtotal()) + " " + cur, body);
        if (invoice.getDiscountTotal().signum() != 0) {
            totalRow(totals, "Discount", "-" + money(invoice.getDiscountTotal()) + " " + cur, body);
        }
        totalRow(totals, "Tax", money(invoice.getTaxTotal()) + " " + cur, body);
        totalRow(totals, "Total", money(invoice.getTotal()) + " " + cur, strong);
        if (invoice.getAmountPaid().signum() != 0) {
            totalRow(totals, "Paid", "-" + money(invoice.getAmountPaid()) + " " + cur, body);
        }
        totalRow(totals, "Balance due", money(invoice.balanceDue()) + " " + cur,
                FontFactory.getFont(FontFactory.HELVETICA_BOLD, 11, ACCENT));
        doc.add(totals);

        if (!payments.isEmpty()) {
            Paragraph p = new Paragraph("Payments received", heading);
            p.setSpacingBefore(18);
            doc.add(p);
            for (Payment pay : payments) {
                doc.add(new Paragraph(pay.getPaymentDate() + "  " + pay.getMethod().name().replace('_', ' ').toLowerCase()
                        + "  " + money(pay.getAmount()) + " " + cur
                        + (pay.getReference() == null ? "" : "  (ref. " + pay.getReference() + ")"), body));
            }
        }
        if (invoice.getNotes() != null && !invoice.getNotes().isBlank()) {
            Paragraph n = new Paragraph(invoice.getNotes(), body);
            n.setSpacingBefore(18);
            doc.add(n);
        }
        if (invoice.isOverdue(today)) {
            Paragraph o = new Paragraph("This invoice is past due.", FontFactory.getFont(FontFactory.HELVETICA_BOLD, 9,
                    new Color(185, 28, 28)));
            o.setSpacingBefore(12);
            doc.add(o);
        }
        if (company.getInvoiceFooter() != null && !company.getInvoiceFooter().isBlank()) {
            Paragraph f = new Paragraph(company.getInvoiceFooter(), muted);
            f.setSpacingBefore(28);
            doc.add(f);
        }
        doc.close();
        return out.toByteArray();
    }

    private static PdfPTable table(float[] widths) {
        PdfPTable t = new PdfPTable(widths);
        t.setWidthPercentage(100);
        return t;
    }

    private static PdfPCell cell(int align) {
        PdfPCell c = new PdfPCell();
        c.setBorder(Rectangle.NO_BORDER);
        c.setHorizontalAlignment(align);
        return c;
    }

    private Paragraph right(String text, Font font) {
        Paragraph p = new Paragraph(text, font);
        p.setAlignment(Element.ALIGN_RIGHT);
        return p;
    }

    private void addIfPresent(PdfPCell cell, String text) {
        if (text != null && !text.isBlank()) {
            cell.addElement(new Paragraph(text, body));
        }
    }

    private PdfPCell lineCell(String text, int align) {
        PdfPCell c = new PdfPCell(new Phrase(text, body));
        c.setBorder(Rectangle.BOTTOM);
        c.setBorderColor(RULE);
        c.setPaddingTop(5);
        c.setPaddingBottom(6);
        c.setHorizontalAlignment(align);
        return c;
    }

    private static void totalRow(PdfPTable t, String label, String value, Font font) {
        PdfPCell spacer = cell(Element.ALIGN_LEFT);
        t.addCell(spacer);
        PdfPCell l = new PdfPCell(new Phrase(label, font));
        l.setBorder(Rectangle.NO_BORDER);
        l.setPadding(3);
        t.addCell(l);
        PdfPCell v = new PdfPCell(new Phrase(value, font));
        v.setBorder(Rectangle.NO_BORDER);
        v.setHorizontalAlignment(Element.ALIGN_RIGHT);
        v.setPadding(3);
        t.addCell(v);
    }

    private static String money(BigDecimal value) {
        DecimalFormat f = new DecimalFormat("#,##0.00", DecimalFormatSymbols.getInstance(Locale.ROOT));
        return f.format(value);
    }
}
