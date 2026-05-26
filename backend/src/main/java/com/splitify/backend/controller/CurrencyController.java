package com.splitify.backend.controller;

import com.splitify.backend.service.CurrencyService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.Map;

@RestController
@RequestMapping("/api/currency")
@RequiredArgsConstructor
public class CurrencyController {

    private final CurrencyService currencyService;

    @GetMapping("/rates")
    public ResponseEntity<Map<String, BigDecimal>> getRates(
            @RequestParam(defaultValue = "RON") String base) {
        return ResponseEntity.ok(currencyService.getRates(base));
    }
}
