package com.hrportal.payroll.pdf;

import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.text.NumberFormat;
import java.util.List;
import java.util.Locale;

import org.springframework.stereotype.Component;

import com.hrportal.payroll.entity.Enums.ComponentType;
import com.hrportal.payroll.entity.PayrollEntry;
import com.hrportal.payroll.entity.PayrollEntryLine;
import com.lowagie.text.Document;
import com.lowagie.text.DocumentException;
import com.lowagie.text.Element;
import com.lowagie.text.Font;
import com.lowagie.text.FontFactory;
import com.lowagie.text.PageSize;
import com.lowagie.text.Paragraph;
import com.lowagie.text.Phrase;
import com.lowagie.text.pdf.PdfPCell;
import com.lowagie.text.pdf.PdfPTable;
import com.lowagie.text.pdf.PdfWriter;

/** Builds the payslip PDF with OpenPDF. No bank account / tax identifier is printed - only name, code, month, days and the pay lines. */
@Component
public class PayslipPdfGenerator {
    private static final Font TITLE = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 16);
    private static final Font BOLD = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 10);
    private static final Font NORMAL = FontFactory.getFont(FontFactory.HELVETICA, 10);
    private static final Font SMALL = FontFactory.getFont(FontFactory.HELVETICA_OBLIQUE, 8);
    private final NumberFormat money = NumberFormat.getNumberInstance(new Locale("en", "IN"));

    public PayslipPdfGenerator() {
        money.setMinimumFractionDigits(2);
        money.setMaximumFractionDigits(2);
    }

    public byte[] generate(PayrollEntry entry, List<PayrollEntryLine> lines) {
        try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Document doc = new Document(PageSize.A4, 40, 40, 40, 40);
            PdfWriter.getInstance(doc, out);
            doc.open();
            doc.add(new Paragraph("PAYSLIP - " + entry.getPayrollMonth(), TITLE));
            doc.add(new Paragraph(" "));
            PdfPTable info = new PdfPTable(new float[]{1, 2, 1, 2});
            info.setWidthPercentage(100);
            cell(info, "Employee", BOLD);
            cell(info, nullSafe(entry.getEmployeeName()), NORMAL);
            cell(info, "Employee code", BOLD);
            cell(info, nullSafe(entry.getEmployeeCode()), NORMAL);
            cell(info, "Working days", BOLD);
            cell(info, entry.getWorkingDays().toPlainString(), NORMAL);
            cell(info, "Paid days", BOLD);
            cell(info, entry.getPaidDays().toPlainString() + " (LOP " + entry.getLopDays().toPlainString() + ")", NORMAL);
            doc.add(info);
            doc.add(new Paragraph(" "));
            PdfPTable pay = new PdfPTable(new float[]{3, 1, 3, 1});
            pay.setWidthPercentage(100);
            cell(pay, "Earnings", BOLD);
            cell(pay, "Amount", BOLD);
            cell(pay, "Deductions", BOLD);
            cell(pay, "Amount", BOLD);
            List<PayrollEntryLine> earn = lines.stream().filter(l -> l.getType() == ComponentType.EARNING).toList();
            List<PayrollEntryLine> ded = lines.stream().filter(l -> l.getType() == ComponentType.DEDUCTION).toList();
            for (int i = 0; i < Math.max(earn.size(), ded.size()); i++) {
                cell(pay, i < earn.size() ? earn.get(i).getComponentName() : "", NORMAL);
                cellRight(pay, i < earn.size() ? format(earn.get(i).getAmount()) : "", NORMAL);
                cell(pay, i < ded.size() ? ded.get(i).getComponentName() : "", NORMAL);
                cellRight(pay, i < ded.size() ? format(ded.get(i).getAmount()) : "", NORMAL);
            }
            cell(pay, "Gross earnings", BOLD);
            cellRight(pay, format(entry.getGross()), BOLD);
            cell(pay, "Total deductions", BOLD);
            cellRight(pay, format(entry.getDeductions()), BOLD);
            doc.add(pay);
            doc.add(new Paragraph(" "));
            Paragraph net = new Paragraph("NET PAY: " + format(entry.getNet()), TITLE);
            net.setAlignment(Element.ALIGN_RIGHT);
            doc.add(net);
            doc.add(new Paragraph("This is a computer generated payslip and does not require a signature. Statutory values are configuration driven.", SMALL));
            doc.close();
            return out.toByteArray();
        } catch (DocumentException | java.io.IOException e) {
            throw new IllegalStateException("Could not build the payslip PDF", e);
        }
    }

    private String format(BigDecimal v) {
        return money.format(v);
    }

    private static String nullSafe(String s) {
        return s == null ? "" : s;
    }

    private static void cell(PdfPTable t, String text, Font f) {
        PdfPCell c = new PdfPCell(new Phrase(text, f));
        c.setPadding(4);
        t.addCell(c);
    }

    private static void cellRight(PdfPTable t, String text, Font f) {
        PdfPCell c = new PdfPCell(new Phrase(text, f));
        c.setPadding(4);
        c.setHorizontalAlignment(Element.ALIGN_RIGHT);
        t.addCell(c);
    }
}
