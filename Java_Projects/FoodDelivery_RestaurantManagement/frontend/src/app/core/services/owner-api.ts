import { Injectable, inject } from '@angular/core';
import { Api } from './api';
import { Ingredient, Menu, MenuItem, Order, OrderSummary, Page, Restaurant, Review } from '../models';

@Injectable({ providedIn: 'root' })
export class OwnerApi {
  private a = inject(Api);
  mine() { return this.a.get<Restaurant[]>('/api/restaurants/mine'); }
  create(b: unknown) { return this.a.post<Restaurant>('/api/restaurants', b); }
  update(id: number, b: unknown) { return this.a.put<Restaurant>(`/api/restaurants/${id}`, b); }
  hours(id: number, hours: unknown[]) { return this.a.put<Restaurant>(`/api/restaurants/${id}/hours`, { hours }); }
  availability(id: number, open: boolean) { return this.a.patch<Restaurant>(`/api/restaurants/${id}/availability`, { open }); }
  logo(id: number, f: File) { return this.a.upload<Restaurant>(`/api/restaurants/${id}/logo`, f); }
  image(id: number, f: File) { return this.a.upload<Restaurant>(`/api/restaurants/${id}/images`, f); }
  sales(id: number) { return this.a.get<any>(`/api/restaurants/${id}/sales`); }
  // menu
  menu(rid: number) { return this.a.get<Menu>(`/api/menu/restaurants/${rid}`); }
  addCategory(rid: number, b: unknown) { return this.a.post<any>(`/api/menu/restaurants/${rid}/categories`, b); }
  updateCategory(id: number, b: unknown) { return this.a.put<any>(`/api/menu/categories/${id}`, b); }
  deleteCategory(id: number) { return this.a.delete<void>(`/api/menu/categories/${id}`); }
  addItem(rid: number, b: unknown) { return this.a.post<MenuItem>(`/api/menu/restaurants/${rid}/items`, b); }
  updateItem(id: number, b: unknown) { return this.a.put<MenuItem>(`/api/menu/items/${id}`, b); }
  itemAvailability(id: number, available: boolean) { return this.a.patch<MenuItem>(`/api/menu/items/${id}/availability`, { available }); }
  deleteItem(id: number) { return this.a.delete<void>(`/api/menu/items/${id}`); }
  itemImage(id: number, f: File) { return this.a.upload<MenuItem>(`/api/menu/items/${id}/image`, f); }
  // orders
  orders(rid: number, q: Record<string, unknown>) { return this.a.get<Page<OrderSummary>>(`/api/orders/restaurant/${rid}`, q); }
  order(id: number) { return this.a.get<Order>(`/api/orders/${id}`); }
  action(id: number, action: 'accept' | 'reject' | 'prepare' | 'ready', reason?: string) { return this.a.post<Order>(`/api/orders/${id}/${action}`, reason ? { reason } : {}); }
  // inventory
  ingredients(rid: number) { return this.a.get<Ingredient[]>(`/api/inventory/restaurants/${rid}/ingredients`); }
  addIngredient(rid: number, b: unknown) { return this.a.post<Ingredient>(`/api/inventory/restaurants/${rid}/ingredients`, b); }
  updateIngredient(id: number, b: unknown) { return this.a.put<Ingredient>(`/api/inventory/ingredients/${id}`, b); }
  restock(id: number, quantity: number, reason?: string) { return this.a.post<Ingredient>(`/api/inventory/ingredients/${id}/restock`, { quantity, reason }); }
  adjust(id: number, newQuantity: number, reason: string) { return this.a.post<Ingredient>(`/api/inventory/ingredients/${id}/adjust`, { newQuantity, reason }); }
  history(id: number) { return this.a.get<Page<any>>(`/api/inventory/ingredients/${id}/history`); }
  recipes(rid: number) { return this.a.get<any[]>(`/api/inventory/restaurants/${rid}/recipes`); }
  setRecipe(rid: number, itemId: number, lines: unknown[]) { return this.a.put<any>(`/api/inventory/restaurants/${rid}/recipes/${itemId}`, { lines }); }
  availability_(rid: number) { return this.a.get<any[]>(`/api/inventory/restaurants/${rid}/availability`); }
  // reviews
  reviews(rid: number, page = 0) { return this.a.get<Page<Review>>(`/api/reviews/restaurant/${rid}`, { page, size: 10 }); }
  reviewSummary(rid: number) { return this.a.get<any>(`/api/reviews/summary/restaurant/${rid}`); }
}
