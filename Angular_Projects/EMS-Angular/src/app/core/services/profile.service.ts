import { Injectable, inject } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { Employee, ProfileUpdateRequest } from '../models/employee.models';
import { ApiService } from './api.service';
import { PictureService } from './picture.service';

/** The signed-in user's own profile (`/profile`). Employees may only edit contact, address and emergency-contact fields. */
@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly api = inject(ApiService);
  private readonly pictures = inject(PictureService);

  get(): Observable<Employee> {
    return this.api.get<Employee>('/profile');
  }

  update(body: ProfileUpdateRequest): Observable<Employee> {
    return this.api.patch<Employee>('/profile', body, { skipErrorToast: true });
  }

  uploadPicture(file: File): Observable<unknown> {
    return this.api.upload('put', '/profile/picture', file, { skipErrorToast: true }).pipe(tap(() => this.pictures.invalidateAll()));
  }

  removePicture(): Observable<null> {
    return this.api.delete('/profile/picture').pipe(tap(() => this.pictures.invalidateAll()));
  }
}
