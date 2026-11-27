// Contracts mirror the existing Express/Prisma backend responses (Decimal columns are serialised as strings).
export type RoleKey = 'PASSENGER' | 'ADMIN' | 'BOOKING_STAFF' | 'TRAIN_OPERATOR';
export type PermissionKey = 'user:read' | 'user:manage' | 'station:manage' | 'train:manage' | 'train:operate' | 'schedule:manage' | 'booking:create' | 'booking:read-own' | 'booking:read-all' | 'booking:cancel-any' | 'payment:read-all' | 'stats:read' | 'settings:manage' | 'notification:read';
export type Money = string | number;
export type Gender = 'MALE' | 'FEMALE' | 'OTHER';

export interface PageMeta { page: number; size: number; total: number; totalPages: number }
export interface Envelope<T> { success: boolean; data: T; meta?: PageMeta }
export interface Paged<T> { items: T[]; meta: PageMeta }
export interface ApiErrorBody { code: string; message: string; fields?: Record<string, string> }
export interface PageQuery { page?: number; size?: number; q?: string; sort?: string; dir?: 'asc' | 'desc'; [k: string]: string | number | boolean | undefined }

export interface User { id: number; name: string; email: string; mobile: string; status: 'ACTIVE' | 'SUSPENDED' | 'PENDING'; roles: RoleKey[]; lastLoginAt?: string | null; createdAt: string }
export interface Session { user: User; accessToken: string }
export interface Station { id: number; code: string; name: string; city: string; state: string; active: boolean; createdAt?: string; _count?: { routeStops: number } }
export interface StationDetail extends Station { routeStops?: { seq: number; arrivalTime: string | null; departureTime: string | null; route: { id: number; name: string; train: { id: number; number: string; name: string } } }[] }
export interface CoachType { id: number; code: string; name: string; farePerKm: Money; seatsPerCoach: number; berthLayout: string }
export interface SeatType { id: number; code: string; name: string }
export type TrainType = 'EXPRESS' | 'SUPERFAST' | 'SUBURBAN' | 'PASSENGER' | 'PREMIUM';
export type TrainStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
export interface TrainLite { id: number; number: string; name: string; type: TrainType; status?: TrainStatus }
export interface RouteStop { id?: number; seq: number; stationId: number; arrivalTime: string | null; departureTime: string | null; dayOffset: number; distanceKm: number; station: Station }
export interface TrainRoute { id: number; trainId: number; name: string; stops: RouteStop[]; train?: { id: number; number: string; name: string; status: TrainStatus } }
export interface OperatingDay { id: number; dayOfWeek: number }
export interface TrainSchedule { id: number; trainId: number; validFrom: string; validTo: string | null; active: boolean; notes: string | null; operatingDays: OperatingDay[]; train?: { id: number; number: string; name: string } }
export interface DateOverride { id: number; trainId: number; date: string; cancelled: boolean; reason: string | null }
export interface Train extends TrainLite { status: TrainStatus; createdAt: string; route: TrainRoute | null; schedules: TrainSchedule[]; overrides?: DateOverride[]; _count?: { coaches: number; bookings: number } }
export interface TrainCoach { id: number; trainId: number; number: string; coachTypeId: number; coachType: CoachType; _count?: { seats: number } }
export interface CoachSeat { id: number; coachId: number; seatNumber: number; seatTypeId: number; seatType: SeatType; status: 'ACTIVE' | 'BLOCKED' }

export interface SearchClass { coachTypeId: number; code: string; name: string; total: number; available: number; fare: number; status: 'AVAILABLE' | 'SOLD_OUT' }
export interface SearchResult {
  train: TrainLite; runDate: string; from: { station: Station; departure: string; seq: number }; to: { station: Station; arrival: string; seq: number };
  distanceKm: number; durationMinutes: number; classes: SearchClass[]; minFare: number;
}
export interface SearchParams { from: number; to: number; date: string; coachTypeId?: number; type?: string; departAfter?: string; sort: 'departure' | 'duration' | 'fare' | 'name'; minSeats: number }
export interface TrainAvailability { trainId: number; date: string; from: Station; to: Station; departure: string; arrival: string; holdMinutes: number; classes: { coachType: string; code: string; total: number; available: number; fare: number }[] }
export type SeatState = 'AVAILABLE' | 'BOOKED' | 'BLOCKED';
export interface SeatCell { id: number; number: number; type: string; status: SeatState }
export interface SeatMap { runDate: string; fare: number; coachType: CoachType; coaches: { id: number; number: string; seats: SeatCell[] }[] }

export interface SavedPassenger { id: number; name: string; age: number; gender: Gender; mobile?: string | null; idType?: string | null; idLast4?: string | null }
export type BookingStatus = 'PENDING_PAYMENT' | 'CONFIRMED' | 'PARTIALLY_CANCELLED' | 'CANCELLED' | 'EXPIRED' | 'FAILED';
export interface BookingSeatInfo { status: string; seat?: { seatNumber: number; seatType?: { code: string; name: string }; coach?: { number: string } } }
export interface BookingPassenger { id: number; passengerId?: number | null; name: string; age: number; gender: Gender; mobile?: string | null; fare: Money; status: 'CONFIRMED' | 'CANCELLED' | string; seat?: BookingSeatInfo | null }
export interface CancellationRecord { id: number; bookingId: number; hoursBefore: number; chargePercent: Money; grossFare: Money; chargeAmount: Money; refundAmount: Money; reason?: string | null; createdAt: string; passengerIds: number[] }
export interface Booking {
  id: number; status: BookingStatus; totalAmount: Money; journeyDate: string; departureAt: string; createdAt: string; expiresAt?: string | null;
  train: TrainLite; fromStation: Station; toStation: Station; coachType?: CoachType; pnr?: { pnr: string } | null; passengers: BookingPassenger[];
  payments?: Payment[]; refunds?: Refund[]; cancellations?: CancellationRecord[]; user?: { id: number; name: string; email: string };
  cancellationSummary?: { chargeAmount: number; refundAmount: number; grossFare: number; hoursBefore: number; rule: { label: string; chargePercent: number } };
}
export type PaymentMethod = 'CARD' | 'UPI' | 'NET_BANKING' | 'WALLET';
export type PaymentStatus = 'INITIATED' | 'SUCCEEDED' | 'FAILED' | 'REFUNDED' | 'PARTIALLY_REFUNDED' | string;
export interface Payment { id: number; bookingId: number; reference: string; method: PaymentMethod; amount: Money; status: PaymentStatus; cardLast4?: string | null; failureReason?: string | null; provider?: string; createdAt: string; confirmedAt?: string | null; booking?: Booking; refunds?: Refund[] }
export interface Refund { id: number; reference: string; amount: Money; status: string; createdAt: string; bookingId: number; paymentId: number; processedAt?: string | null; booking?: Booking; payment?: { reference: string; method: string }; cancellation?: CancellationRecord }
export interface CancellationQuote { hoursBefore: number; rule: { label: string; chargePercent: number }; grossFare: number; chargeAmount: number; refundAmount: number; passengers: { id: number; name: string; fare: Money }[] }
export interface CancellationRow extends CancellationRecord { booking: Booking; refund?: Refund | null }
export interface CancellationRule { id?: number; minHoursBefore: number; chargePercent: Money; label: string }
export interface Receipt { receiptNo: string; issuedAt: string | null; payment: { reference: string; method: string; cardLast4?: string | null; amount: Money; status: string }; booking: { id: number; pnr?: string; train: { number: string; name: string }; from: Station; to: Station; departureAt: string; passengers: { name: string; age: number; gender: string; fare: Money; status: string }[] }; customer?: { id: number; name: string; email: string }; refunds: Refund[] }
export interface NotificationItem { id: number; type: string; title: string; message: string; link?: string | null; readAt?: string | null; createdAt: string }
export interface NotificationPage { items: NotificationItem[]; unread: number }
export interface NotificationPrefs { inApp: boolean; email: boolean }
export interface Stats {
  users: number; trains: number; stations: number; todayBookings: number; bookingsByStatus: { status: string; count: number }[];
  payments: { count: number; gross: number; refunded: number; net: number; refundCount: number }; cancellations: { count: number; charges: number };
  perDay: { date: string; count: number }[]; topTrains: { id: number; number: string; name: string; bookings: number }[]; asOf: string;
}

export interface RoutePayload { name: string; stops: { stationId: number; arrivalTime: string | null; departureTime: string | null; dayOffset: number; distanceKm: number }[] }
export interface TrainPayload { number: string; name: string; type: TrainType; status: TrainStatus; route?: RoutePayload; coaches?: { coachTypeId: number; count: number }[]; operatingDays?: number[] }
export interface BookingPayload { trainId: number; date: string; fromStationId: number; toStationId: number; coachTypeId: number; passengers: { passengerId?: number; name: string; age: number; gender: Gender; mobile?: string; seatId?: number }[] }
