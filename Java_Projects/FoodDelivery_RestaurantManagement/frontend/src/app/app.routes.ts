import { Routes } from '@angular/router';
import { authGuard, roleGuard } from './core/guards/guards';
import { ShellComponent } from './layout/shell.component';

const ADMIN = ['ADMIN', 'SUPER_ADMIN'] as const;

/** Lazy-loaded feature areas (each loadComponent() becomes its own bundle). Role guards protect the UI; the APIs enforce the same rules. */
export const routes: Routes = [
  { path: 'login', loadComponent: () => import('./features/authentication/auth.pages').then(m => m.LoginComponent) },
  { path: 'register', loadComponent: () => import('./features/authentication/auth.pages').then(m => m.RegisterComponent) },
  { path: 'forgot-password', loadComponent: () => import('./features/authentication/auth.pages').then(m => m.ForgotPasswordComponent) },
  {
    path: '', component: ShellComponent, canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'customer/home' },
      {
        path: 'customer', canActivate: [roleGuard('CUSTOMER')], children: [
          { path: 'home', loadComponent: () => import('./features/customer/discover.pages').then(m => m.CustomerHomeComponent) },
          { path: 'restaurants', loadComponent: () => import('./features/customer/discover.pages').then(m => m.RestaurantsComponent) },
          { path: 'restaurants/:id', loadComponent: () => import('./features/customer/discover.pages').then(m => m.RestaurantDetailComponent) },
          { path: 'cart', loadComponent: () => import('./features/customer/order.pages').then(m => m.CartComponent) },
          { path: 'checkout', loadComponent: () => import('./features/customer/order.pages').then(m => m.CheckoutComponent) },
          { path: 'orders', loadComponent: () => import('./features/customer/order.pages').then(m => m.OrdersComponent) },
          { path: 'orders/:id', loadComponent: () => import('./features/customer/order.pages').then(m => m.OrderDetailComponent) },
          { path: 'profile', loadComponent: () => import('./features/customer/account.pages').then(m => m.ProfileComponent) },
          { path: 'addresses', loadComponent: () => import('./features/customer/account.pages').then(m => m.AddressesComponent) },
          { path: 'payment-methods', loadComponent: () => import('./features/customer/account.pages').then(m => m.PaymentMethodsComponent) },
          { path: 'notifications', loadComponent: () => import('./features/customer/account.pages').then(m => m.NotificationsComponent) }
        ]
      },
      {
        path: 'owner', canActivate: [roleGuard('RESTAURANT_OWNER', 'RESTAURANT_STAFF')], children: [
          { path: 'dashboard', loadComponent: () => import('./features/restaurant-admin/owner.pages').then(m => m.OwnerDashboardComponent) },
          { path: 'restaurant', loadComponent: () => import('./features/restaurant-admin/owner.pages').then(m => m.OwnerRestaurantComponent) },
          { path: 'menu', loadComponent: () => import('./features/restaurant-admin/owner.pages').then(m => m.OwnerMenuComponent) },
          { path: 'orders', loadComponent: () => import('./features/restaurant-admin/owner.pages').then(m => m.OwnerOrdersComponent) },
          { path: 'inventory', loadComponent: () => import('./features/restaurant-admin/owner.pages').then(m => m.OwnerInventoryComponent) },
          { path: 'reviews', loadComponent: () => import('./features/restaurant-admin/owner.pages').then(m => m.OwnerReviewsComponent) },
          { path: 'notifications', loadComponent: () => import('./features/customer/account.pages').then(m => m.NotificationsComponent) }
        ]
      },
      {
        path: 'delivery', canActivate: [roleGuard('DELIVERY_PARTNER')], children: [
          { path: 'dashboard', loadComponent: () => import('./features/delivery/delivery.pages').then(m => m.DeliveryDashboardComponent) },
          { path: 'history', loadComponent: () => import('./features/delivery/delivery.pages').then(m => m.DeliveryHistoryComponent) },
          { path: 'profile', loadComponent: () => import('./features/delivery/delivery.pages').then(m => m.DeliveryProfileComponent) },
          { path: 'notifications', loadComponent: () => import('./features/customer/account.pages').then(m => m.NotificationsComponent) }
        ]
      },
      {
        path: 'admin', canActivate: [roleGuard(...ADMIN)], children: [
          { path: 'dashboard', loadComponent: () => import('./features/system-admin/admin.pages').then(m => m.AdminDashboardComponent) },
          { path: 'users', loadComponent: () => import('./features/system-admin/admin.pages').then(m => m.AdminUsersComponent) },
          { path: 'restaurants', loadComponent: () => import('./features/system-admin/admin.pages').then(m => m.AdminRestaurantsComponent) },
          { path: 'orders', loadComponent: () => import('./features/system-admin/admin.pages').then(m => m.AdminOrdersComponent) },
          { path: 'payments', loadComponent: () => import('./features/system-admin/admin.pages').then(m => m.AdminPaymentsComponent) },
          { path: 'refunds', loadComponent: () => import('./features/system-admin/admin.pages').then(m => m.AdminRefundsComponent) },
          { path: 'delivery', loadComponent: () => import('./features/system-admin/admin.pages').then(m => m.AdminDeliveryComponent) },
          { path: 'coupons', loadComponent: () => import('./features/system-admin/admin.pages').then(m => m.AdminCouponsComponent) },
          { path: 'reviews', loadComponent: () => import('./features/system-admin/admin.pages').then(m => m.AdminReviewsComponent) },
          { path: 'inventory', loadComponent: () => import('./features/system-admin/admin.pages').then(m => m.AdminInventoryComponent) },
          { path: 'system', loadComponent: () => import('./features/system-admin/admin.pages').then(m => m.AdminSystemComponent) },
          { path: 'notifications', loadComponent: () => import('./features/customer/account.pages').then(m => m.NotificationsComponent) }
        ]
      },
      {
        path: 'kafka', canActivate: [roleGuard(...ADMIN)], children: [
          { path: 'topics', loadComponent: () => import('./features/kafka-monitoring/kafka.pages').then(m => m.KafkaTopicsComponent) },
          { path: 'topics/:name', loadComponent: () => import('./features/kafka-monitoring/kafka.pages').then(m => m.KafkaTopicComponent) },
          { path: 'audit', loadComponent: () => import('./features/kafka-monitoring/kafka.pages').then(m => m.KafkaAuditComponent) },
          { path: 'flow', loadComponent: () => import('./features/kafka-monitoring/kafka.pages').then(m => m.KafkaFlowComponent) },
          { path: 'groups', loadComponent: () => import('./features/kafka-monitoring/kafka.pages').then(m => m.KafkaGroupsComponent) },
          { path: 'failed', loadComponent: () => import('./features/kafka-monitoring/kafka.pages').then(m => m.KafkaFailedComponent) }
        ]
      },
      {
        path: 'logs', canActivate: [roleGuard(...ADMIN)], children: [
          { path: 'health', loadComponent: () => import('./features/logging/logging.pages').then(m => m.ObservabilityComponent) },
          { path: 'search', loadComponent: () => import('./features/logging/logging.pages').then(m => m.LogSearchComponent) }
        ]
      }
    ]
  },
  { path: '**', redirectTo: '' }
];
