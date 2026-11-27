export type RoleKey = 'PASSENGER' | 'ADMIN' | 'BOOKING_STAFF' | 'TRAIN_OPERATOR';
export interface User { id: number; name: string; email: string; mobile: string; status: string; roles: RoleKey[]; lastLoginAt?: string | null; createdAt: string }
export interface Station { id: number; code: string; name: string; city: string; state: string; active: boolean; _count?: { routeStops: number } }
export interface CoachType { id: number; code: string; name: string; farePerKm: string; seatsPerCoach: number; berthLayout: string }
export interface PageMeta { page: number; size: number; total: number; totalPages: number }
export interface Paged<T> { data: T[]; meta: PageMeta }
export interface Envelope<T> { success: boolean; data: T; meta?: PageMeta }
export interface TrainLite { id: number; number: string; name: string; type: string; status?: string }
export interface SearchResult {
  train: TrainLite; runDate: string; from: { station: Station; departure: string; seq: number }; to: { station: Station; arrival: string; seq: number };
  durationMinutes: number; distanceKm: number; classes: { coachTypeId: number; code: string; name: string; fare: number; available: number; total: number }[];
}
export interface SeatCell { id: number; number: number; type: string; status: 'AVAILABLE' | 'BOOKED' | 'HELD' | 'BLOCKED' }
export interface SeatMap { runDate: string; fare: number; coachType: CoachType; coaches: { id: number; number: string; seats: SeatCell[] }[] }
export interface BookingPassenger { id: number; name: string; age: number; gender: string; fare: string; status: string; seat?: { status: string; seat?: { seatNumber: number; seatType?: { code: string; name: string }; coach?: { number: string } } } | null }
export interface Booking {
  id: number; reference?: string; status: string; totalAmount: string; journeyDate: string; departureAt: string; arrivalAt?: string; createdAt: string; expiresAt?: string | null;
  train: TrainLite; fromStation: Station; toStation: Station; coachType?: CoachType; pnr?: { pnr: string } | null; passengers: BookingPassenger[]; payments?: Payment[]; user?: { id: number; name: string; email: string };
}
export interface Payment { id: number; reference: string; method: string; amount: string; status: string; cardLast4?: string | null; createdAt: string; confirmedAt?: string | null; booking?: Booking; refunds?: Refund[] }
export interface Refund { id: number; reference: string; amount: string; status: string; createdAt: string; bookingId: number; paymentId: number; processedAt?: string | null }
export interface CancellationQuote { hoursBefore: number; rule: { label: string; chargePercent: number }; grossFare: number; chargeAmount: number; refundAmount: number; passengers: { id: number; name: string; fare: string }[] }
export interface SavedPassenger { id: number; name: string; age: number; gender: 'MALE' | 'FEMALE' | 'OTHER'; mobile?: string | null; idType?: string | null; idLast4?: string | null }
export interface NotificationItem { id: number; type: string; title: string; message: string; link?: string | null; readAt?: string | null; createdAt: string }
export interface Stats {
  users: number; trains: number; stations: number; todayBookings: number; bookingsByStatus: { status: string; count: number }[];
  payments: { count: number; gross: number; refunded: number; net: number; refundCount: number }; cancellations: { count: number; charges: number };
  perDay: { date: string; count: number }[]; topTrains: { id: number; number: string; name: string; bookings: number }[];
}
export interface ApiErrorBody { code: string; message: string; fields?: Record<string, string> }
