package com.splitify.backend.controller;

import com.splitify.backend.dto.receipt.*;
import com.splitify.backend.service.ReceiptService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.UUID;

@Slf4j
@RestController
@RequestMapping("/api/receipts")
@RequiredArgsConstructor
public class ReceiptController {

    private final ReceiptService receiptService;

    @PostMapping("/create")
    public ResponseEntity<ReceiptDto> createReceipt(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestParam String title,
            @RequestParam(required = false) UUID groupId,
            @RequestParam(required = false) String category) {
        log.info("CREATE receipt title='{}' groupId={} category={}", title, groupId, category);
        return ResponseEntity.status(HttpStatus.CREATED)
            .body(receiptService.createManualReceipt(currentUserId(userDetails), title, groupId, category));
    }

    @PostMapping(value = "/scan", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ReceiptDto> scanReceipt(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestPart("image") MultipartFile image,
            @RequestPart("title") String title,
            @RequestPart(value = "groupId", required = false) String groupId) {
        log.info("SCAN receipt title='{}' groupId={} imageSize={}B", title, groupId, image.getSize());
        return ResponseEntity.status(HttpStatus.CREATED)
            .body(receiptService.scanReceipt(currentUserId(userDetails), image, title,
                groupId != null ? UUID.fromString(groupId) : null));
    }

    @GetMapping
    public ResponseEntity<List<ReceiptDto>> getMyReceipts(@AuthenticationPrincipal UserDetails userDetails) {
        log.info("GET receipts");
        return ResponseEntity.ok(receiptService.getMyReceipts(currentUserId(userDetails)));
    }

    @GetMapping("/group/{groupId}")
    public ResponseEntity<List<ReceiptDto>> getGroupReceipts(@AuthenticationPrincipal UserDetails userDetails,
                                                              @PathVariable UUID groupId,
                                                              @RequestParam(required = false, defaultValue = "false") boolean unpaidOnly) {
        log.info("GET receipts groupId={} unpaidOnly={}", groupId, unpaidOnly);
        return ResponseEntity.ok(receiptService.getGroupReceipts(groupId, currentUserId(userDetails), unpaidOnly));
    }

    @GetMapping("/{receiptId}")
    public ResponseEntity<ReceiptDto> getReceipt(@AuthenticationPrincipal UserDetails userDetails,
                                                  @PathVariable UUID receiptId) {
        log.info("GET receipt receiptId={}", receiptId);
        return ResponseEntity.ok(receiptService.getReceipt(receiptId, currentUserId(userDetails)));
    }

    @PostMapping("/{receiptId}/items")
    public ResponseEntity<ReceiptItemDto> addItem(@AuthenticationPrincipal UserDetails userDetails,
                                                   @PathVariable UUID receiptId,
                                                   @Valid @RequestBody AddReceiptItemRequest request) {
        log.info("ADD item receiptId={} item='{}'", receiptId, request.getName());
        return ResponseEntity.status(HttpStatus.CREATED)
            .body(receiptService.addReceiptItem(receiptId, currentUserId(userDetails), request));
    }

    @DeleteMapping("/{receiptId}/items/{itemId}")
    public ResponseEntity<Void> deleteItem(@AuthenticationPrincipal UserDetails userDetails,
                                            @PathVariable UUID receiptId,
                                            @PathVariable UUID itemId) {
        log.info("DELETE item receiptId={} itemId={}", receiptId, itemId);
        receiptService.deleteReceiptItem(receiptId, itemId, currentUserId(userDetails));
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/{receiptId}/items/{itemId}")
    public ResponseEntity<ReceiptItemDto> updateItem(@AuthenticationPrincipal UserDetails userDetails,
                                                      @PathVariable UUID receiptId,
                                                      @PathVariable UUID itemId,
                                                      @Valid @RequestBody UpdateReceiptItemRequest request) {
        log.info("UPDATE item receiptId={} itemId={}", receiptId, itemId);
        return ResponseEntity.ok(
            receiptService.updateReceiptItem(receiptId, itemId, currentUserId(userDetails), request));
    }

    @PostMapping("/{receiptId}/items/{itemId}/assign")
    public ResponseEntity<ReceiptItemDto> assignItem(@AuthenticationPrincipal UserDetails userDetails,
                                                      @PathVariable UUID receiptId,
                                                      @PathVariable UUID itemId,
                                                      @Valid @RequestBody AssignItemRequest request) {
        log.info("ASSIGN item receiptId={} itemId={} assignees={}", receiptId, itemId,
            request.getAssignees() != null ? request.getAssignees().size() : 0);
        return ResponseEntity.ok(
            receiptService.assignItem(receiptId, itemId, currentUserId(userDetails), request));
    }

    @GetMapping("/{receiptId}/summary")
    public ResponseEntity<ReceiptSummaryDto> getSummary(@AuthenticationPrincipal UserDetails userDetails,
                                                         @PathVariable UUID receiptId) {
        log.info("GET summary receiptId={}", receiptId);
        return ResponseEntity.ok(receiptService.getSummary(receiptId, currentUserId(userDetails)));
    }

    @PostMapping("/{receiptId}/confirm-review")
    public ResponseEntity<ReceiptDto> confirmReview(@AuthenticationPrincipal UserDetails userDetails,
                                                     @PathVariable UUID receiptId) {
        log.info("CONFIRM review receiptId={}", receiptId);
        return ResponseEntity.ok(receiptService.confirmReview(receiptId, currentUserId(userDetails)));
    }

    @PostMapping("/{receiptId}/finalize")
    public ResponseEntity<ReceiptDto> finalizeReceipt(@AuthenticationPrincipal UserDetails userDetails,
                                                       @PathVariable UUID receiptId) {
        log.info("FINALIZE receipt receiptId={}", receiptId);
        return ResponseEntity.ok(receiptService.finalizeReceipt(receiptId, currentUserId(userDetails)));
    }

    @PostMapping("/{receiptId}/participants/{userId}/pay")
    public ResponseEntity<Void> markPaid(@AuthenticationPrincipal UserDetails userDetails,
                                          @PathVariable UUID receiptId,
                                          @PathVariable UUID userId) {
        log.info("MARK paid receiptId={} payerId={}", receiptId, userId);
        receiptService.markPaid(receiptId, currentUserId(userDetails), userId);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{receiptId}")
    public ResponseEntity<Void> deleteReceipt(@AuthenticationPrincipal UserDetails userDetails,
                                               @PathVariable UUID receiptId) {
        log.info("DELETE receipt receiptId={}", receiptId);
        receiptService.deleteReceipt(receiptId, currentUserId(userDetails));
        return ResponseEntity.noContent().build();
    }

    private UUID currentUserId(UserDetails userDetails) {
        return UUID.fromString(userDetails.getUsername());
    }
}
