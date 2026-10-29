package com.springerp.sales;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Collection;

/**
 * Decimal-safe line and document arithmetic shared by orders and invoices.
 *
 * Per line:  gross    = unitPrice x quantity
 *            discount = round(gross x discount% / 100)
 *            net      = gross - discount
 *            tax      = round(net x taxRate / 100)
 *            total    = net + tax
 * Rounding is HALF_UP to 2 decimals at line level; document totals are exact sums
 * of the rounded lines, so a document always equals the sum of its printed lines.
 */
public final class Pricing {

    public static final int SCALE = 2;
    private static final BigDecimal HUNDRED = BigDecimal.valueOf(100);

    private Pricing() {
    }

    public record LineAmounts(BigDecimal gross, BigDecimal discount, BigDecimal net, BigDecimal tax, BigDecimal total) {
    }

    public record Totals(BigDecimal subtotal, BigDecimal discountTotal, BigDecimal taxTotal, BigDecimal total) {
    }

    public static LineAmounts line(int quantity, BigDecimal unitPrice, BigDecimal discountPercent, BigDecimal taxRate) {
        if (quantity <= 0) {
            throw new IllegalArgumentException("quantity must be positive");
        }
        BigDecimal gross = unitPrice.multiply(BigDecimal.valueOf(quantity)).setScale(SCALE, RoundingMode.HALF_UP);
        BigDecimal discount = gross.multiply(discountPercent).divide(HUNDRED, SCALE, RoundingMode.HALF_UP);
        BigDecimal net = gross.subtract(discount);
        BigDecimal tax = net.multiply(taxRate).divide(HUNDRED, SCALE, RoundingMode.HALF_UP);
        return new LineAmounts(gross, discount, net, tax, net.add(tax));
    }

    public static Totals totals(Collection<LineAmounts> lines) {
        BigDecimal subtotal = zero();
        BigDecimal discount = zero();
        BigDecimal tax = zero();
        for (LineAmounts l : lines) {
            subtotal = subtotal.add(l.gross());
            discount = discount.add(l.discount());
            tax = tax.add(l.tax());
        }
        return new Totals(subtotal, discount, tax, subtotal.subtract(discount).add(tax));
    }

    public static BigDecimal zero() {
        return BigDecimal.ZERO.setScale(SCALE);
    }
}
