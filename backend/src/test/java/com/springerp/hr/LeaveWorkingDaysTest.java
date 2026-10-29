package com.springerp.hr;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;

import org.junit.jupiter.api.Test;

class LeaveWorkingDaysTest {

    @Test
    void countsWeekdaysInclusive() {
        // Mon 2026-03-02 .. Fri 2026-03-06
        assertThat(LeaveService.workingDays(LocalDate.of(2026, 3, 2), LocalDate.of(2026, 3, 6))).isEqualTo(5);
    }

    @Test
    void skipsWeekends() {
        // Fri 2026-03-06 .. Mon 2026-03-09
        assertThat(LeaveService.workingDays(LocalDate.of(2026, 3, 6), LocalDate.of(2026, 3, 9))).isEqualTo(2);
    }

    @Test
    void weekendOnlyPeriodHasNoWorkingDays() {
        assertThat(LeaveService.workingDays(LocalDate.of(2026, 3, 7), LocalDate.of(2026, 3, 8))).isZero();
    }
}
