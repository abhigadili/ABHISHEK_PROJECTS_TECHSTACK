import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import type { CreateUserRequest, UserAccount } from '../models';
import { BaseApiService } from './base-api.service';

/** User administration endpoints of the identity service (`/api/users`, ADMIN only). Login/refresh live in AuthService. */
@Injectable({ providedIn: 'root' })
export class UserApiService extends BaseApiService {
  protected readonly resource = 'users';
  list(): Observable<UserAccount[]> { return this.get<UserAccount[]>(''); }
  create(b: CreateUserRequest): Observable<UserAccount> { return this.post<UserAccount, CreateUserRequest>('', b); }
  setEnabled(id: number, enabled: boolean): Observable<UserAccount> { return this.patch<UserAccount, { enabled: boolean }>(`/${id}/enabled`, { enabled }); }
}
