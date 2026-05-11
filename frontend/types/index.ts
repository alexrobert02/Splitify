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

export interface GroupMemberDto {
  userId: string;
  name: string;
  email: string;
  role: string;
  joinedAt: string;
}

export interface GroupDto {
  id: string;
  name: string;
  description: string;
  createdById: string;
  createdByName: string;
  createdAt: string;
  members: GroupMemberDto[];
}

export type SplitType = 'EQUAL' | 'PERCENTAGE' | 'FIXED' | 'COUNT';
export type ReceiptStatus = 'PROCESSING' | 'PROCESSED' | 'FAILED';

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
  status: ReceiptStatus;
  finalized: boolean;
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
