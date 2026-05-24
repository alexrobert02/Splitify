export interface AuthResponse {
  token: string;
  userId: string;
  email: string;
  name: string;
}

export interface UserDto {
  id: string;
  email: string;
  name: string;
  revolutTag?: string;
}

export interface GroupDto {
  id: string;
  name: string;
  description: string;
  createdById: string;
  createdByName: string;
  createdAt: string;
  members: UserDto[];
}

export type SplitType = 'EQUAL' | 'PERCENTAGE' | 'FIXED' | 'COUNT';
export type ReceiptCategory = 'GROCERIES' | 'DINING' | 'TRANSPORT' | 'ENTERTAINMENT' | 'SHOPPING' | 'UTILITIES' | 'HEALTH' | 'OTHER';
export type ReceiptStatus = 'PENDING_REVIEW' | 'PENDING_ASSIGNMENT' | 'FINALIZED';

export interface AssignmentDto {
  id: string;
  userId: string;
  userName: string;
  splitType: SplitType;
  splitValue: number;
  amountOwed: number;
}

export interface ReceiptItemDto {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  position: number;
  assignments: AssignmentDto[];
}

export interface ReceiptDto {
  id: string;
  title: string;
  scannedById: string;
  scannedByName: string;
  scannedByRevolutTag?: string;
  groupId: string | null;
  groupName: string | null;
  totalAmount: number;
  currency: string;
  category: ReceiptCategory;
  finalized: boolean;
  status: ReceiptStatus;
  scannedAt: string;
  items: ReceiptItemDto[];
}

export interface ItemContributionDto {
  itemId: string;
  itemName: string;
  amountOwed: number;
}

export interface ParticipantSummaryDto {
  userId: string;
  name: string;
  email: string;
  totalOwed: number;
  itemBreakdown: ItemContributionDto[];
  paid: boolean;
}

export interface ReceiptSummaryDto {
  receiptId: string;
  title: string;
  totalAmount: number;
  currency: string;
  participants: ParticipantSummaryDto[];
}

export interface AssigneeEntry {
  userId: string;
  splitType: SplitType;
  splitValue?: number;
}

export type NotificationType = 'GROUP_ADDED' | 'PAYMENT_REQUESTED' | 'PAYMENT_RECEIVED';

export interface NotificationDto {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  relatedEntityId: string | null;
  read: boolean;
  createdAt: string;
}
