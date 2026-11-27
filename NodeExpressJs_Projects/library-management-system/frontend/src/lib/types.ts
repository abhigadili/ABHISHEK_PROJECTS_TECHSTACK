export type Role = 'admin' | 'librarian' | 'member';
export interface Membership {
  membershipId: number; memberTypeId: number; typeName: string; startDate: string; endDate: string; membershipStatus: string; expired: boolean;
  maxLoans: number; loanDays: number; maxRenewals: number; renewalDays: number; maxReservations: number; finePerDay: number; graceDays: number; maxFinePerLoan: number | null;
}
export interface User {
  id: number; email: string; fullName: string; phone: string | null; status: 'pending' | 'active' | 'suspended' | 'inactive'; role: Role;
  memberCode: string | null; registrationDate: string | null; hasPicture: boolean; pictureUpdatedAt: string | null; membership: Membership | null;
}
export interface Book {
  id: number; title: string; subtitle: string | null; isbn10: string | null; isbn13: string | null; publicationYear: number | null; language: string; format: string;
  coverUrl: string | null; location: string | null; status: string; pages: number | null; edition: string | null; publisherId: number | null; publisherName: string | null;
  authors: string | null; categories: string | null; totalCopies: number; availableCopies: number; borrowedCopies: number; reservedCopies: number; damagedCopies: number; lostCopies: number;
  timesBorrowed: number; avgRating: number | null; ratingCount: number; availability: 'available' | 'borrowed' | 'unavailable';
  description?: string | null; acquisitionDate?: string | null; acquisitionCost?: number | null;
  authorList?: { id: number; name: string }[]; categoryList?: { id: number; name: string; slug: string }[]; related?: Book[];
  isFavorite?: boolean; myReservation?: { id: number; status: string; expiresAt: string | null } | null; myActiveLoan?: { id: number; dueDate: string } | null;
}
export interface Loan {
  id: number; userId: number; memberName: string; memberCode: string; bookId: number; bookTitle: string; authors: string | null; copyId: number; accessionNumber: string;
  issuedAt: string; dueDate: string; returnedAt: string | null; renewalCount: number; status: 'active' | 'returned' | 'lost'; returnCondition: string | null;
  isOverdue: boolean; daysLate: number; estimatedFine: number; displayStatus: 'active' | 'overdue' | 'returned' | 'lost'; issuedBy: string | null; returnedProcessedBy: string | null;
}
export interface Reservation {
  id: number; userId: number; memberName: string; memberCode: string; bookId: number; bookTitle: string; coverUrl: string | null; status: string;
  createdAt: string; readyAt: string | null; expiresAt: string | null; heldCopy: string | null; queuePosition: number | null; authors: string | null;
}
export interface Fine {
  id: number; userId: number; memberName: string; memberCode: string; loanId: number | null; fineType: string; amount: number; waivedAmount: number; paidAmount: number;
  outstanding: number; status: string; reason: string | null; waiverReason: string | null; createdAt: string; createdBy: string | null; waivedBy: string | null; bookTitle: string | null;
}
export interface Payment {
  id: number; receiptNumber: string; userId: number; memberName: string; memberCode: string; kind: 'payment' | 'refund'; amount: number; method: string;
  reference: string | null; notes: string | null; reversesPaymentId: number | null; isRefunded: boolean; receivedBy: string | null; createdAt: string;
}
export interface Notification { id: number; type: string; title: string; message: string; link: string | null; isRead: boolean; createdAt: string }
export interface MemberType {
  id: number; name: string; description: string | null; maxLoans: number; loanDays: number; maxRenewals: number; renewalDays: number; maxReservations: number;
  finePerDay: number; graceDays: number; maxFinePerLoan: number | null; membershipDays: number; membershipFee: number; isActive: boolean; activeMembers?: number;
}
export interface LibraryInfo { name: string; address: string; phone: string; email: string; hours: string; about: string; currency: string }
