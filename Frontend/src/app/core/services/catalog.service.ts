import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { AcademicTerm, Course, CourseOffering, DocumentCategory, Faculty, Lecturer, Major, Page, PopularCourse } from '../models/api.models';

@Injectable({ providedIn: 'root' })
export class CatalogService {
  private readonly api = inject(ApiService);

  faculties(): Observable<Faculty[]> { return this.api.get<Faculty[]>('/faculties'); }
  majors(facultyId: number): Observable<Major[]> { return this.api.get<Major[]>(`/faculties/${facultyId}/majors`); }
  courses(majorId: number, q?: string): Observable<Course[]> { return this.api.get<Course[]>(`/majors/${majorId}/courses`, { q }); }
  offerings(courseId: number, termId?: number): Observable<CourseOffering[]> {
    return this.api.get<CourseOffering[]>(`/courses/${courseId}/offerings`, { termId });
  }
  lecturers(query?: string, courseId?: number, termId?: number): Observable<Lecturer[]> {
    return this.api.get<Lecturer[]>('/lecturers', { q: query, courseId, termId });
  }
  terms(): Observable<AcademicTerm[]> { return this.api.get<AcademicTerm[]>('/academic-terms'); }
  categories(): Observable<DocumentCategory[]> { return this.api.get<DocumentCategory[]>('/document-categories'); }
  popularCourses(limit = 6): Observable<PopularCourse[]> { return this.api.get<PopularCourse[]>('/dashboard/popular-courses', { limit }); }

  adminList<T>(resource: string, query?: Record<string, string | number | undefined | null>): Observable<Page<T> | T[]> {
    return this.api.get<Page<T> | T[]>(`/admin/${resource}`, query);
  }

  adminSave<T>(resource: string, id: number | null, body: unknown): Observable<T> {
    return id === null
      ? this.api.post<T>(`/admin/${resource}`, body)
      : this.api.patch<T>(`/admin/${resource}/${id}`, body);
  }

  adminDelete(resource: string, id: number): Observable<void> {
    return this.api.delete<void>(`/admin/${resource}/${id}`);
  }
}
