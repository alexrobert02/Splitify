package com.splitify.backend.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import tools.jackson.databind.json.JsonMapper;

import java.math.BigDecimal;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
@Slf4j
@RequiredArgsConstructor
public class CurrencyService {

    private static final String FRANKFURTER_URL = "https://api.frankfurter.app/latest?from=";
    private static final long CACHE_TTL_SECONDS = 3600;

    private final JsonMapper jsonMapper;
    private final HttpClient httpClient = HttpClient.newHttpClient();
    private final Map<String, CachedRates> cache = new ConcurrentHashMap<>();

    private record CachedRates(Map<String, BigDecimal> rates, Instant fetchedAt) {
        boolean isExpired() {
            return Instant.now().isAfter(fetchedAt.plusSeconds(CACHE_TTL_SECONDS));
        }
    }

    private record FrankfurterResponse(String base, Map<String, BigDecimal> rates) {}

    public Map<String, BigDecimal> getRates(String base) {
        String normalizedBase = base.toUpperCase();
        CachedRates cached = cache.get(normalizedBase);
        if (cached != null && !cached.isExpired()) {
            return cached.rates;
        }
        try {
            HttpRequest httpRequest = HttpRequest.newBuilder()
                    .uri(URI.create(FRANKFURTER_URL + normalizedBase))
                    .GET()
                    .build();
            HttpResponse<String> response = httpClient.send(httpRequest, HttpResponse.BodyHandlers.ofString());
            FrankfurterResponse parsed = jsonMapper.readValue(response.body(), FrankfurterResponse.class);
            Map<String, BigDecimal> rates = new HashMap<>(parsed.rates() != null ? parsed.rates() : Map.of());
            rates.put(normalizedBase, BigDecimal.ONE);
            cache.put(normalizedBase, new CachedRates(rates, Instant.now()));
            return rates;
        } catch (Exception e) {
            log.error("Failed to fetch exchange rates for base {}", normalizedBase, e);
            return Map.of(normalizedBase, BigDecimal.ONE);
        }
    }
}
