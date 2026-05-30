package com.splitify.backend.controller;

import com.splitify.backend.dto.recurring.CreateRecurringExpenseRequest;
import com.splitify.backend.dto.recurring.RecurringExpenseDto;
import com.splitify.backend.service.RecurringExpenseService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@Slf4j
@RestController
@RequestMapping("/api/recurring")
@RequiredArgsConstructor
public class RecurringExpenseController {

    private final RecurringExpenseService recurringExpenseService;

    @PostMapping
    public ResponseEntity<RecurringExpenseDto> create(
            @AuthenticationPrincipal UserDetails userDetails,
            @Valid @RequestBody CreateRecurringExpenseRequest request) {
        log.info("CREATE recurring expense title='{}' frequency={}", request.getTitle(), request.getFrequency());
        return ResponseEntity.status(HttpStatus.CREATED)
            .body(recurringExpenseService.create(currentUserId(userDetails), request));
    }

    @GetMapping
    public ResponseEntity<List<RecurringExpenseDto>> list(@AuthenticationPrincipal UserDetails userDetails) {
        log.info("LIST recurring expenses");
        return ResponseEntity.ok(recurringExpenseService.getMyRecurring(currentUserId(userDetails)));
    }

    @GetMapping("/{id}")
    public ResponseEntity<RecurringExpenseDto> get(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable UUID id) {
        log.info("GET recurring expense id={}", id);
        return ResponseEntity.ok(recurringExpenseService.getById(id, currentUserId(userDetails)));
    }

    @PutMapping("/{id}/toggle")
    public ResponseEntity<RecurringExpenseDto> toggle(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable UUID id) {
        log.info("TOGGLE recurring expense id={}", id);
        return ResponseEntity.ok(recurringExpenseService.toggle(id, currentUserId(userDetails)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable UUID id) {
        log.info("DELETE recurring expense id={}", id);
        recurringExpenseService.delete(id, currentUserId(userDetails));
        return ResponseEntity.noContent().build();
    }

    private UUID currentUserId(UserDetails userDetails) {
        return UUID.fromString(userDetails.getUsername());
    }
}
