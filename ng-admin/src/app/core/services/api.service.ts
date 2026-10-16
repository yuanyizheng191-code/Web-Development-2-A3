/**
 * app/core/services/api.service.ts
 * A thin, typed wrapper around Angular's HttpClient.
 *
 * Why wrap HttpClient at all?
 *   1. Every API response uses the same envelope
 *      `{ success, count?, message?, data }`, so `unwrap()` removes it once
 *      here instead of in every component.
 *   2. Errors are converted into a single `ApiError` shape carrying the HTTP
 *      status and the human-readable message the Express error handler sent -
 *      components can then show `error.message` straight to the user.
 *
 */
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import { environment } from '../../../environments/environment';
import { ApiEnvelope } from '../models/event.model';

/** A normalised error that every component can display. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Query-string values accepted by the API. */
export type QueryValue = string | number | boolean | null | undefined;

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiBase;

  /** Build an HttpParams object, dropping empty values. */
  private static params(query?: Record<string, QueryValue>): HttpParams {
    let params = new HttpParams();
    if (!query) return params;
    for (const [key, value] of Object.entries(query)) {
      if (value !== null && value !== undefined && value !== '') {
        params = params.set(key, String(value));
      }
    }
    return params;
  }

  /** GET that returns the unwrapped `data` member of the envelope. */
  get<T>(path: string, query?: Record<string, QueryValue>): Observable<T> {
    return this.http
      .get<ApiEnvelope<T>>(`${this.baseUrl}${path}`, { params: ApiService.params(query) })
      .pipe(map((response) => response.data), catchError(this.handleError));
  }

  /**
   * GET that keeps the whole envelope, for endpoints where `count` or
   * `message` matters as well as `data`.
   */
  getEnvelope<T>(path: string, query?: Record<string, QueryValue>): Observable<ApiEnvelope<T>> {
    return this.http
      .get<ApiEnvelope<T>>(`${this.baseUrl}${path}`, { params: ApiService.params(query) })
      .pipe(catchError(this.handleError));
  }

  /** POST that returns the unwrapped `data`, plus the success message. */
  post<T>(path: string, body: unknown): Observable<{ data: T; message: string }> {
    return this.http.post<ApiEnvelope<T>>(`${this.baseUrl}${path}`, body).pipe(
      map((response) => ({ data: response.data, message: response.message ?? 'Saved successfully.' })),
      catchError(this.handleError),
    );
  }

  /** PUT / PATCH returning the unwrapped `data`. */
  put<T>(path: string, body: unknown): Observable<T> {
    return this.http
      .put<ApiEnvelope<T>>(`${this.baseUrl}${path}`, body)
      .pipe(map((response) => response.data), catchError(this.handleError));
  }

  /** DELETE returning the success message. */
  delete<T>(path: string): Observable<{ data: T; message: string }> {
    return this.http.delete<ApiEnvelope<T>>(`${this.baseUrl}${path}`).pipe(
      map((response) => ({ data: response.data, message: response.message ?? 'Deleted successfully.' })),
      catchError(this.handleError),
    );
  }

  /**
   * Turn any HttpErrorResponse into an ApiError.
   *
   * Two very different failures have to be handled here:
   *   * the server answered with our JSON error envelope  -> use its message
   *     (this is what makes "cannot be deleted because it has 3 registrations"
   *     appear in the UI)
   *   * the request never reached the API (server down, wrong URL, CORS)
   *     -> explain how to fix it
   */
  private handleError = (error: HttpErrorResponse): Observable<never> => {
    if (error.error && typeof error.error === 'object' && 'error' in error.error) {
      const payload = error.error.error as { status?: number; message?: string; details?: unknown };
      return throwError(
        () => new ApiError(payload.status ?? error.status, payload.message ?? 'Request failed.', payload.details),
      );
    }

    let message: string;
    switch (error.status) {
      case 0:
        message =
          `Could not reach the API at ${this.baseUrl}. ` +
          'Make sure the Express server is running (npm start in the api folder).';
        break;
      case 404:
        message = 'The requested resource was not found.';
        break;
      case 500:
        message = 'The API reported an internal server error.';
        break;
      default:
        message = error.message || `Request failed with status ${error.status}.`;
    }
    return throwError(() => new ApiError(error.status, message));
  };
}
