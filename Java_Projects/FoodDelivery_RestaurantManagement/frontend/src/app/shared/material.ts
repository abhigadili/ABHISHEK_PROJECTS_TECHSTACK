import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTabsModule } from '@angular/material/tabs';
import { MatDialogModule } from '@angular/material/dialog';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatBadgeModule } from '@angular/material/badge';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { MatChipsModule } from '@angular/material/chips';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatRadioModule } from '@angular/material/radio';
import { MatStepperModule } from '@angular/material/stepper';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonToggleModule } from '@angular/material/button-toggle';

/** One import for every feature component: Angular Material + forms + router links. */
export const UI = [
  CommonModule, ReactiveFormsModule, FormsModule, RouterLink, RouterLinkActive, MatButtonModule, MatIconModule, MatCardModule, MatFormFieldModule,
  MatInputModule, MatSelectModule, MatCheckboxModule, MatSlideToggleModule, MatTabsModule, MatDialogModule, MatSnackBarModule, MatTooltipModule,
  MatProgressBarModule, MatProgressSpinnerModule, MatPaginatorModule, MatBadgeModule, MatMenuModule, MatDividerModule, MatChipsModule,
  MatExpansionModule, MatRadioModule, MatStepperModule, MatAutocompleteModule, MatButtonToggleModule
] as const;
