export interface Page<T> { content: T[]; page: number; size: number; totalElements: number; totalPages: number; }
export interface UserDto { id: number; username: string; email: string; fullName: string; phone?: string; status: string; roles: string[]; createdAt?: string; lastLoginAt?: string; }
export interface AuthResponse { accessToken: string; refreshToken: string; tokenType: string; expiresInSeconds: number; user: UserDto; }
export type Role = 'CUSTOMER' | 'RESTAURANT_OWNER' | 'RESTAURANT_STAFF' | 'DELIVERY_PARTNER' | 'ADMIN' | 'SUPER_ADMIN';

export interface Hour { dayOfWeek: string; opensAt?: string; closesAt?: string; closed: boolean; }
export interface Restaurant {
  id: number; ownerUserId: number; name: string; description?: string; category?: string; cuisines: string[]; pureVeg: boolean; status: string;
  acceptingOrders: boolean; openNow: boolean; phone?: string; email?: string; addressLine: string; city: string; state?: string; postalCode?: string;
  latitude?: number; longitude?: number; logoUrl?: string; imageUrls: string[]; avgRating: number; ratingCount: number; minOrderAmount: number;
  deliveryFee: number; prepTimeMinutes: number; hours: Hour[]; distanceKm?: number; statusReason?: string;
}
export interface Variant { id?: number; name: string; extraPrice: number; }
export interface AddOn { id?: number; name: string; price: number; available: boolean; }
export interface MenuItem {
  id: number; restaurantId: number; categoryId: number; category: string; name: string; description?: string; basePrice: number; vegetarian: boolean;
  available: boolean; imageUrl?: string; prepTimeMinutes: number; tags?: string; variants: Variant[]; addOns: AddOn[];
}
export interface MenuCategory { id: number; name: string; description?: string; displayOrder: number; items: MenuItem[]; }
export interface Menu { restaurantId: number; categories: MenuCategory[]; totalItems: number; }

export interface CartLine { id: number; menuItemId: number; name: string; variant?: string; addOns: string[]; quantity: number; unitPrice: number; lineTotal: number; instructions?: string; vegetarian: boolean; }
export interface Cart {
  restaurantId?: number; restaurantName?: string; lines: CartLine[]; subtotal: number; discount: number; couponCode?: string; couponMessage?: string; deliveryFee: number;
  tax: number; total: number; minOrderAmount: number; minOrderSatisfied: boolean; restaurantOpen: boolean; issues: string[]; orderable: boolean;
}
export interface Address { id: number; label: string; line1: string; line2?: string; city: string; state?: string; postalCode: string; latitude?: number; longitude?: number; defaultAddress: boolean; }
export interface OrderSummary { id: number; orderNumber: string; status: string; totalAmount: number; createdAt: string; restaurantId: number; restaurantName: string; customerId: number; customerName: string; itemCount: number; }
export interface OrderItem { menuItemId: number; name: string; variant?: string; addOns?: string; quantity: number; unitPrice: number; lineTotal: number; instructions?: string; }
export interface OrderHistory { from?: string; to: string; reason?: string; actor: string; at: string; }
export interface Order {
  id: number; orderNumber: string; status: string; customerId: number; customerName: string; restaurantId: number; restaurantName: string; pickupAddress: string;
  deliveryAddress: string; deliveryCity: string; subtotal: number; discountAmount: number; couponCode?: string; deliveryFee: number; taxAmount: number; totalAmount: number;
  paymentMethod: string; specialInstructions?: string; cancelReason?: string; estimatedPrepMinutes: number; createdAt: string; items: OrderItem[]; history: OrderHistory[]; allowedActions: string[];
}
export interface Payment { id: number; orderId: number; orderNumber: string; amount: number; currency: string; method: string; status: string; provider: string; sandbox: boolean; transactionRef?: string; failureReason?: string; expiresAt: string; paidAt?: string; createdAt: string; notice?: string; }
export interface Refund { id: number; paymentId: number; orderId: number; amount: number; status: string; reason?: string; providerRef?: string; failureReason?: string; attempts: number; createdAt: string; completedAt?: string; }
export interface SavedMethod { id: number; type: string; label: string; maskedValue: string; defaultMethod: boolean; }
export interface Notification { id: number; title: string; message: string; type: string; channel: string; status: string; read: boolean; referenceType?: string; referenceId?: number; createdAt: string; }
export interface Review { id: number; orderId: number; reviewerName: string; restaurantId: number; restaurantRating: number; deliveryRating?: number; comment?: string; status: string; moderationNote?: string; createdAt: string; itemRatings: { menuItemId: number; itemName: string; rating: number }[]; }
export interface Summary { subjectId: number; average: number; count: number; distribution: Record<string, number>; }
export interface Coupon { id: number; code: string; description?: string; discountType: string; discountValue: number; minOrderValue: number; maxDiscount?: number; validFrom: string; validTo: string; active: boolean; totalUsageLimit?: number; perUserLimit?: number; usedCount: number; restaurantId?: number; eligibleUserId?: number; campaignId?: number; }
export interface Delivery { id: number; orderId: number; orderNumber: string; status: string; partnerUserId?: number; customerName?: string; pickupAddress: string; deliveryAddress: string; deliveryCity?: string; assignedAt?: string; acceptedAt?: string; pickedUpAt?: string; deliveredAt?: string; offerExpiresAt?: string; offerCount: number; }
export interface Partner { userId: number; fullName: string; phone?: string; vehicleType?: string; vehicleNumber?: string; online: boolean; busy: boolean; suspended: boolean; ratingAvg: number; ratingCount: number; completedDeliveries: number; rejectedOffers: number; availability: string; }
export interface Ingredient { id: number; restaurantId: number; name: string; unit: string; quantity: number; lowStockThreshold: number; lowStock: boolean; version: number; }
