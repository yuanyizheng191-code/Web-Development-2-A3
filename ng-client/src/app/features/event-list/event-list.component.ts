/**
 * features/event-list/event-list.component.ts
 * The Events listing AND search page.
 *
 * Implements the search / filtering requirement:
 *   * free-text search across the event name, description, purpose, location,
 *     category and charity (the API performs a SQL LIKE across those columns)
 *   * category, status and sort dropdowns
 *   * the search box is debounced by 350ms so typing does not fire a request
 *     per keystroke
 *   * every filter change re-runs the API call through `resource()`
 *   * the current search text is mirrored into the URL (?search=gala) so a
 *     filtered result can be shared or bookmarked
 *
 */
import { Component, computed, inject, resource, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { EventService } from '../../core/services/event.service';
import { EventCardComponent } from '../event-card/event-card.component';

@Component({
  selector: 'app-event-list',
  imports: [EventCardComponent],
  templateUrl: './event-list.component.html',
  styleUrl: './event-list.component.scss',
})
export class EventListComponent {
  private readonly events = inject(EventService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  // ---- filter state (signals) ---------------------------------------------

  /** Free text typed in the search box. */
  protected readonly searchTerm = signal('');

  /** The debounced value that is actually sent to the API. */
  private readonly appliedSearch = signal('');

  protected readonly categoryId = signal<number | null>(null);
  protected readonly status = signal<string>('');
  protected readonly sort = signal<string>('date');

  /** Bump to re-run the query (the "Reset" / "Try again" buttons). */
  private readonly reload = signal(0);

  private debounceHandle: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    // Deep link support: /events?search=gala&categoryId=2
    const params = this.route.snapshot.queryParamMap;
    const initialSearch = params.get('search') ?? '';
    if (initialSearch) {
      this.searchTerm.set(initialSearch);
      this.appliedSearch.set(initialSearch);
    }
    const initialCategory = params.get('categoryId');
    if (initialCategory) this.categoryId.set(Number(initialCategory));
    const initialStatus = params.get('status');
    if (initialStatus) this.status.set(initialStatus);
  }

  // ---- data ----------------------------------------------------------------

  protected readonly categories = resource({
    params: () => ({ reload: this.reload() }),
    loader: async () => firstValueFrom(this.events.getCategories()),
  });

  /**
   * The event list.  `resource()` re-runs this loader automatically whenever any
   * of the signals read inside `params` change - that single mechanism replaces
   * the subscribe/unsubscribe boilerplate of an RxJS pipeline.
   */
  protected readonly results = resource({
    params: () => ({
      search: this.appliedSearch(),
      categoryId: this.categoryId(),
      status: this.status(),
      sort: this.sort(),
      reload: this.reload(),
    }),
    loader: async ({ params }) =>
      firstValueFrom(
        this.events.listEvents({
          search: params.search || undefined,
          categoryId: params.categoryId,
          status: params.status || undefined,
          sort: params.sort,
        }),
      ),
  });

  /** Convenience signal for the template. */
  protected readonly events$ = computed(() => this.results.value() ?? []);

  protected readonly resultCount = computed(() => this.events$().length);

  /** True when at least one filter is not at its default. */
  protected readonly hasFilters = computed(
    () =>
      this.appliedSearch() !== '' ||
      this.categoryId() !== null ||
      this.status() !== '' ||
      this.sort() !== 'date',
  );

  /** A short human description of what is currently being shown. */
  protected readonly summary = computed(() => {
    const parts: string[] = [];
    if (this.appliedSearch()) parts.push(`matching "${this.appliedSearch()}"`);
    const category = this.categories.value()?.find((c) => c.categoryId === this.categoryId());
    if (category) parts.push(`in ${category.categoryName}`);
    if (this.status()) parts.push(`with status ${this.status()}`);
    return parts.length ? ` ${parts.join(' ')}` : '';
  });

  // ---- actions -------------------------------------------------------------

  /**
   * Called on every keystroke.  The signal updates immediately so the input
   * stays responsive, but the API call is delayed by 350ms.
   */
  protected onSearchInput(value: string): void {
    this.searchTerm.set(value);
    if (this.debounceHandle) clearTimeout(this.debounceHandle);
    this.debounceHandle = setTimeout(() => {
      this.appliedSearch.set(value.trim());
      this.syncUrl();
    }, 350);
  }

  protected onCategoryChange(value: string): void {
    this.categoryId.set(value === '' ? null : Number(value));
    this.syncUrl();
  }

  protected onStatusChange(value: string): void {
    this.status.set(value);
    this.syncUrl();
  }

  protected onSortChange(value: string): void {
    this.sort.set(value);
    this.syncUrl();
  }

  protected resetFilters(): void {
    if (this.debounceHandle) clearTimeout(this.debounceHandle);
    this.searchTerm.set('');
    this.appliedSearch.set('');
    this.categoryId.set(null);
    this.status.set('');
    this.sort.set('date');
    this.syncUrl();
  }

  protected retry(): void {
    this.reload.update((n) => n + 1);
  }

  /** Keep the address bar in step with the filters without adding history noise. */
  private syncUrl(): void {
    const queryParams: Record<string, string | null> = {
      search: this.appliedSearch() || null,
      categoryId: this.categoryId() ? String(this.categoryId()) : null,
      status: this.status() || null,
    };
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: '',
      replaceUrl: true,
    });
  }
}
