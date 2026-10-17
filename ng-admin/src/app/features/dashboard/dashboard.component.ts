/**
 * features/dashboard/dashboard.component.ts
 * The admin dashboard: the first page staff see.
 *
 * Data comes from two API calls:
 *   GET /api/dashboard  -> summary counts, the five most recent events and the
 *                          current storage mode (mysql or demo fallback)
 *   GET /api/events     -> used to show the delete-protection status of events
 *
 */
import { Component, computed, inject, resource, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { AdminEventService } from '../../core/services/admin-event.service';
import { formatCurrency, formatCurrencyWhole, formatDateTime, statusClass } from '../../core/utils/format';

@Component({
  selector: 'app-admin-dashboard',
  imports: [RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent {
  private readonly admin = inject(AdminEventService);

  private readonly reload = signal(0);

  /** GET /api/dashboard */
  protected readonly dashboard = resource({
    params: () => ({ reload: this.reload() }),
    loader: async () => firstValueFrom(this.admin.getDashboard()),
  });

  protected readonly summary = computed(() => this.dashboard.value()?.summary ?? null);

  protected readonly recentEvents = computed(() => this.dashboard.value()?.recentEvents ?? []);

  protected readonly storage = computed(() => this.dashboard.value()?.storage ?? '');

  /** A friendly label for the storage mode reported by the API. */
  protected readonly storageLabel = computed(() => {
    const mode = this.storage().toLowerCase();
    if (mode.startsWith('demo')) return 'Read-only demo data (MySQL unreachable)';
    if (mode.startsWith('mysql')) return 'MySQL database';
    return this.storage();
  });

  protected readonly isDemoMode = computed(() => this.storage().toLowerCase().startsWith('demo'));

  protected retry(): void {
    this.reload.update((n) => n + 1);
  }

  // Exposed for the template.
  protected readonly formatCurrency = formatCurrency;
  protected readonly formatCurrencyWhole = formatCurrencyWhole;
  protected readonly formatDateTime = formatDateTime;
  protected readonly statusClass = statusClass;
}
