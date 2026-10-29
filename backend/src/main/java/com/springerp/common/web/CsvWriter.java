package com.springerp.common.web;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.stream.Collectors;

import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;

/** Minimal RFC 4180 CSV builder with spreadsheet formula-injection protection. */
public final class CsvWriter {

    private final StringBuilder out = new StringBuilder();

    public CsvWriter row(Object... values) {
        out.append(java.util.Arrays.stream(values).map(CsvWriter::escape).collect(Collectors.joining(",")))
                .append("\r\n");
        return this;
    }

    public CsvWriter rows(List<Object[]> rows) {
        rows.forEach(this::row);
        return this;
    }

    public ResponseEntity<byte[]> toResponse(String filename) {
        // BOM so Excel detects UTF-8 correctly.
        byte[] body = ("﻿" + out).getBytes(StandardCharsets.UTF_8);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .contentType(new MediaType("text", "csv", StandardCharsets.UTF_8))
                .body(body);
    }

    static String escape(Object value) {
        if (value == null) {
            return "";
        }
        String s = value.toString();
        // Cells starting with these characters are executed as formulas by spreadsheet apps.
        if (!s.isEmpty() && "=+-@\t\r".indexOf(s.charAt(0)) >= 0 && !(value instanceof Number)) {
            s = "'" + s;
        }
        if (s.contains(",") || s.contains("\"") || s.contains("\n") || s.contains("\r")) {
            s = "\"" + s.replace("\"", "\"\"") + "\"";
        }
        return s;
    }
}
