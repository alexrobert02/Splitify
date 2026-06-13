# Splitify
Master's Project 2026

## Overview
A mobile app for splitting bills with friends and family — down to the individual item on a receipt.

Scan a receipt, assign each item to whoever ordered it, and Splitify calculates exactly who owes what. No more "just split it equally" when someone only had a salad.

Most bill-splitting apps treat a shared expense as a single number to divide. Splitify works at the item level — each product on a receipt can be assigned to a different person or shared between several, so the final amounts actually reflect what everyone consumed. It supports multiple currencies, spending categories, and recurring expenses for things like rent or subscriptions that repeat every month.

## Features

**Receipt scanning with AI**
Take a photo of any receipt and the app reads it automatically — items, quantities, and prices are extracted in seconds. You can review and correct anything before moving on.

**Per-item assignment**
Assign each item on a receipt to one or more people. Split a single item equally, by percentage, or by a fixed amount. Everyone only pays for what they actually had.

**Groups**
Organize expenses by group — family, roommates, a trip with friends. Each group has its own receipt history and a running total of who owes whom.

**Settle Up**
See the outstanding balance across all receipts in a group at a glance, then mark debts as paid with one tap.

**Recurring expenses**
Set up repeating expenses (rent, subscriptions, shared bills) on a daily, weekly, monthly, or yearly schedule so they get added automatically without having to re-enter them every time.

**Spending statistics**
Browse your spending history broken down by category — Groceries, Dining, Shopping, Utilities, and more — across any time range.

**Push notifications**
Get notified when someone adds you to a group or requests payment for a receipt.

**Dark mode**
Full light and dark theme support, following your system preference or set manually.

## Pages

### Groups & Receipts

| Groups                                                                                                                | Receipts (Light)                                                                                                      | Receipts (Dark)                                                                                                       |
|-----------------------------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------|
| <img width="200" alt="Image" src="https://github.com/user-attachments/assets/3b900d52-d502-4144-8b11-65242b65bf6f" /> | <img width="200" alt="Image" src="https://github.com/user-attachments/assets/6b2a19f3-307f-4e7b-b39c-d184a58c575e" /> | <img width="200" alt="Image" src="https://github.com/user-attachments/assets/6644d843-92f5-4a25-8117-dffcc4685205" /> |

### Adding a Receipt

| New Receipt                                                                                                           | Scan Receipt                                                                                                          | Review Items                                                                                                          |
|-----------------------------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------|
| <img width="200" alt="Image" src="https://github.com/user-attachments/assets/ec6e20e0-806a-4d8e-b7bc-6c6df8c75455" /> | <img width="200" alt="Image" src="https://github.com/user-attachments/assets/1d0e0cef-76e1-4002-a72a-e7557cc3a599" /> | <img width="200" alt="Image" src="https://github.com/user-attachments/assets/a3b165cb-28c9-4954-8f16-543d35423f85" /> |

### Assigning & Settling

| Assign Items                                                                                                          | Settle Up                                                                                                             |
|-----------------------------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------|
| <img width="200" alt="Image" src="https://github.com/user-attachments/assets/26421e2e-8f79-49d0-bdaa-984f769d6a25" /> | <img width="200" alt="Image" src="https://github.com/user-attachments/assets/7a2f823f-0400-4cb8-94a8-556e11516969" /> |

### Recurring & Statistics

| Recurring Expenses                                                                                                    | Create Recurring                                                                                                      | Statistics                                                                                                            |
|-----------------------------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------|
| <img width="200" alt="Image" src="https://github.com/user-attachments/assets/09c16d74-9ac2-4442-8386-2da32d2c6f69" /> | <img width="200" alt="Image" src="https://github.com/user-attachments/assets/741d6d2e-347b-4cdc-8d09-c45116e30419" /> | <img width="200" alt="Image" src="https://github.com/user-attachments/assets/253da9e2-d690-4a6d-be48-d4c86161c6f3" /> |

### Notifications & Profile

| Notifications                                                                                                         | Profile                                                                                                               |
|-----------------------------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------|
| <img width="200" alt="Image" src="https://github.com/user-attachments/assets/1814090b-9075-45a6-a710-5b36d3593fde" /> | <img width="200" alt="Image" src="https://github.com/user-attachments/assets/44e9ff88-e22c-4b66-9213-70e69c89e2d9" /> |

## Tech Stack

- **Mobile:** React Native with Expo — runs on Android and iOS from a single codebase
- **Backend:** Spring Boot (Java 21) — REST API handling all business logic, split calculations, and push notifications
- **Database:** PostgreSQL — stores users, groups, receipts, items, assignments, and notifications
- **OCR:** Google Gemini AI — reads receipt photos and returns structured item data
- **Auth:** JWT — stateless authentication, tokens stored securely on device
- **Push notifications:** Expo Push Notification service (FCM-backed)
