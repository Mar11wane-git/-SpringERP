package com.springerp.sales;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.math.BigDecimal;
import java.util.List;

import org.junit.jupiter.api.Test;

class PricingTest {

    private static BigDecimal d(String v) {
        return new BigDecimal(v);
    }

    @Test
    void computesLineWithDiscountAndTax() {
        Pricing.LineAmounts line = Pricing.line(3, d("19.99"), d("10.00"), d("20.00"));

        assertThat(line.gross()).isEqualByComparingTo("59.97");
        assertThat(line.discount()).isEqualByComparingTo("6.00"); // 5.997 rounded half-up
        assertThat(line.net()).isEqualByComparingTo("53.97");
        assertThat(line.tax()).isEqualByComparingTo("10.79"); // 10.794
        assertThat(line.total()).isEqualByComparingTo("64.76");
    }

    @Test
    void roundsHalfUpAtTwoDecimals() {
        // 0.25 x 10% = 0.025 exactly: HALF_UP gives 0.03 (banker's rounding would give 0.02).
        Pricing.LineAmounts line = Pricing.line(1, d("0.25"), BigDecimal.ZERO, d("10.00"));
        assertThat(line.tax()).isEqualByComparingTo("0.03");
        assertThat(line.total()).isEqualByComparingTo("0.28");
    }

    @Test
    void documentTotalsEqualSumOfRoundedLines() {
        Pricing.LineAmounts a = Pricing.line(1, d("0.10"), BigDecimal.ZERO, d("20.00"));
        Pricing.LineAmounts b = Pricing.line(2, d("0.10"), BigDecimal.ZERO, d("20.00"));
        Pricing.Totals totals = Pricing.totals(List.of(a, b));

        assertThat(totals.subtotal()).isEqualByComparingTo("0.30");
        assertThat(totals.taxTotal()).isEqualByComparingTo(a.tax().add(b.tax()));
        assertThat(totals.total()).isEqualByComparingTo(a.total().add(b.total()));
        assertThat(totals.total().scale()).isEqualTo(2);
    }

    @Test
    void fullDiscountGivesZero() {
        Pricing.LineAmounts line = Pricing.line(5, d("12.00"), d("100.00"), d("20.00"));
        assertThat(line.total()).isEqualByComparingTo("0.00");
    }

    @Test
    void rejectsNonPositiveQuantity() {
        assertThatThrownBy(() -> Pricing.line(0, d("1.00"), BigDecimal.ZERO, BigDecimal.ZERO))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
