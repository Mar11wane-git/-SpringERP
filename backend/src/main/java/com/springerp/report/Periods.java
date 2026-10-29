package com.springerp.report;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import com.springerp.common.error.BusinessException;

/** Date-range helpers shared by the dashboard and reports. */
public final class Periods {

    public static final int MAX_RANGE_DAYS = 3 * 366;

    private Periods() {
    }

    public record Range(LocalDate from, LocalDate to) {

        public long days() {
            return to.toEpochDay() - from.toEpochDay() + 1;
        }

        /** The equally long period immediately before this one, for period-over-period comparison. */
        public Range previous() {
            return new Range(from.minusDays(days()), from.minusDays(1));
        }
    }

    public static Range resolve(LocalDate from, LocalDate to, LocalDate today) {
        LocalDate end = to != null ? to : today;
        LocalDate start = from != null ? from : end.withDayOfMonth(1);
        if (start.isAfter(end)) {
            throw BusinessException.rule("INVALID_RANGE", "The start date must be on or before the end date.");
        }
        if (end.toEpochDay() - start.toEpochDay() > MAX_RANGE_DAYS) {
            throw BusinessException.rule("RANGE_TOO_LONG", "The date range cannot exceed three years.");
        }
        return new Range(start, end);
    }

    /** Ordered month buckets covering the range, initialized to zero. */
    public static Map<YearMonth, BigDecimal[]> monthBuckets(Range range, int width) {
        Map<YearMonth, BigDecimal[]> buckets = new LinkedHashMap<>();
        for (YearMonth m = YearMonth.from(range.from()); !m.isAfter(YearMonth.from(range.to())); m = m.plusMonths(1)) {
            BigDecimal[] values = new BigDecimal[width];
            java.util.Arrays.fill(values, BigDecimal.ZERO.setScale(2));
            buckets.put(m, values);
        }
        return buckets;
    }

    /** Adds rows shaped [year, month, ..., value] (value at valueIndex) into bucket column {@code column}. */
    public static void accumulate(Map<YearMonth, BigDecimal[]> buckets, List<Object[]> rows, int valueIndex,
            int column) {
        for (Object[] r : rows) {
            YearMonth m = YearMonth.of(((Number) r[0]).intValue(), ((Number) r[1]).intValue());
            BigDecimal[] values = buckets.get(m);
            if (values != null) {
                values[column] = values[column].add(toDecimal(r[valueIndex]));
            }
        }
    }

    public static BigDecimal toDecimal(Object value) {
        if (value == null) {
            return BigDecimal.ZERO.setScale(2);
        }
        if (value instanceof BigDecimal bd) {
            return bd.setScale(2, java.math.RoundingMode.HALF_UP);
        }
        return new BigDecimal(value.toString()).setScale(2, java.math.RoundingMode.HALF_UP);
    }
}
