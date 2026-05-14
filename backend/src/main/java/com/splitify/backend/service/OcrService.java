package com.splitify.backend.service;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.ObjectMapper;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@Service
@Slf4j
@RequiredArgsConstructor
public class OcrService {

    private final ObjectMapper objectMapper;

    @Value("${app.gemini.api-key}")
    private String apiKey;

    @Value("${app.gemini.base-url}")
    private String baseUrl;

    @Value("${app.gemini.model}")
    private String model;

    private static final String PROMPT = """
        Analyze this receipt image carefully. Extract every line item visible on the receipt.
        Return ONLY a valid JSON object with this exact structure (no markdown, no extra text):
        {
          "currency": "RON",
          "total": 0.00,
          "category": "OTHER",
          "items": [
            {
              "name": "Product name as printed",
              "quantity": 1.0,
              "unit_price": 0.00,
              "total_price": 0.00
            }
          ]
        }
        Rules:
        - currency: 3-letter ISO code if visible, otherwise "RON"
        - total: the grand total from the receipt; 0 if not visible
        - category: classify the overall receipt into exactly one of: GROCERIES, DINING, TRANSPORT, ENTERTAINMENT, SHOPPING, UTILITIES, HEALTH, OTHER
        - quantity: numeric value (default 1 if not shown)
        - unit_price: price per unit; equal to total_price if quantity is 1
        - total_price: line total for that item
        - Use null only if a value is completely unreadable
        """;

    public OcrResult extractFromImage(String base64Image, String mimeType) {
        if (apiKey == null || apiKey.isBlank()) {
            throw new IllegalStateException("GEMINI_API_KEY is not configured");
        }

        Map<String, Object> requestBody = buildRequest(base64Image, mimeType);
        String url = baseUrl + "/v1beta/models/" + model + ":generateContent?key=" + apiKey;

        RestClient client = RestClient.create();

        GeminiResponse response = client.post()
            .uri(url)
            .header("Content-Type", "application/json")
            .body(requestBody)
            .retrieve()
            .body(GeminiResponse.class);

        return parseResponse(response);
    }

    private Map<String, Object> buildRequest(String base64Image, String mimeType) {
        return Map.of(
            "contents", List.of(
                Map.of(
                    "role", "user",
                    "parts", List.of(
                        Map.of(
                            "inline_data", Map.of(
                                "mime_type", mimeType,
                                "data", base64Image
                            )
                        ),
                        Map.of("text", PROMPT)
                    )
                )
            ),
            "generationConfig", Map.of(
                "temperature", 0.1,
                "responseMimeType", "application/json"
            )
        );
    }

    private OcrResult parseResponse(GeminiResponse response) {
        if (response == null || response.getCandidates() == null || response.getCandidates().isEmpty()) {
            log.error("Empty response from Gemini API");
            return OcrResult.empty();
        }

        try {
            String text = response.getCandidates().getFirst()
                .getContent()
                .getParts().getFirst()
                .getText();

            // Strip markdown code blocks if present despite responseMimeType setting
            text = text.strip();
            if (text.startsWith("```")) {
                text = text.replaceAll("^```[a-z]*\\n?", "").replaceAll("```$", "").strip();
            }

            return objectMapper.readValue(text, OcrResult.class);
        } catch (Exception e) {
            log.error("Failed to parse Gemini response", e);
            return OcrResult.empty();
        }
    }

    // ---- Response types ----

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class GeminiResponse {
        private List<Candidate> candidates;

        @Data
        @JsonIgnoreProperties(ignoreUnknown = true)
        public static class Candidate {
            private Content content;
        }

        @Data
        @JsonIgnoreProperties(ignoreUnknown = true)
        public static class Content {
            private List<Part> parts;
        }

        @Data
        @JsonIgnoreProperties(ignoreUnknown = true)
        public static class Part {
            private String text;
        }
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class OcrResult {
        private String currency;
        private BigDecimal total;
        private String category;
        private List<OcrItem> items;

        public static OcrResult empty() {
            OcrResult r = new OcrResult();
            r.setCurrency("RON");
            r.setTotal(BigDecimal.ZERO);
            r.setItems(List.of());
            return r;
        }
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class OcrItem {
        private String name;
        private BigDecimal quantity;
        @JsonProperty("unit_price")
        private BigDecimal unitPrice;
        @JsonProperty("total_price")
        private BigDecimal totalPrice;
    }
}
