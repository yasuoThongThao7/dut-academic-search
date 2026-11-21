export type UserRole = 'STUDENT' | 'ADMIN';
export type DocumentStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'HIDDEN';
export type DocumentSort = 'recent' | 'popular' | 'helpful' | 'accessed';
export type TrustCode = 'INSUFFICIENT' | 'LOW' | 'MEDIUM' | 'HIGH';
export type ReportReason =
  | 'WRONG_COURSE'
  | 'WRONG_MAJOR'
  | 'INAPPROPRIATE'
  | 'BROKEN_LINK'
  | 'NO_ACCESS'
  | 'COPYRIGHT'
  | 'OTHER';

export interface ApiEnvelope<T> {
  data: T;
  page?: number;
  size?: number;
  totalElements?: number;
  totalPages?: number;
  message?: string;
}

export interface Page<T> {
  content: T[];
  items?: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

export interface User {
  id: number;
  studentId: string;
  fullName: string;
  email?: string | null;
  role: UserRole;
  forcePasswordChange: boolean;
  faculty?: Faculty | null;
  major?: Major | null;
  active?: boolean;
  status?: 'ACTIVE' | 'LOCKED';
}

export interface LoginResponse {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  user: User;
}

export interface Faculty {
  id: number;
  code?: string;
  name: string;
  status?: 'ACTIVE' | 'INACTIVE';
}

export interface Major {
  id: number;
  facultyId: number;
  code?: string;
  name: string;
  faculty?: Faculty | null;
  status?: 'ACTIVE' | 'INACTIVE';
}

export interface Course {
  id: number;
  code: string;
  name: string;
  credits?: number;
}

export interface Lecturer {
  id: number;
  code?: string;
  fullName: string;
  email?: string;
}

export interface AcademicTerm {
  id: number;
  code: string;
  name: string;
  startDate?: string;
  endDate?: string;
}

export interface CourseOffering {
  id: number;
  classCode: string;
  courseId?: number;
  course?: Course;
  lecturer: Lecturer;
  academicTerm: AcademicTerm;
}

export interface DocumentCategory {
  code: string;
  name: string;
}

export interface TrustInfo {
  code: TrustCode;
  label: string;
}

export interface Document {
  id: number;
  title: string;
  description?: string | null;
  category?: DocumentCategory | null;
  categoryCode?: string;
  status?: DocumentStatus;
  createdAt: string;
  uploader?: User | null;
  major?: Major | null;
  course?: Course | null;
  courseOffering?: CourseOffering | null;
  viewCount?: number | null;
  /** Số lượt mở liên kết tài liệu. */
  accessCount?: number | null;
  /** Chỉ có khi chủ tài liệu hoặc admin xem; người khác lấy link qua POST /documents/{id}/access. */
  externalUrl?: string | null;
  storageSource?: string | null;
  accessNote?: string | null;
  helpfulCount?: number;
  notHelpfulCount?: number;
  /** Tỷ lệ hữu ích từ 0 đến 1, null khi chưa có đánh giá. */
  helpfulRatio?: number | null;
  reviewCount?: number | null;
  trust?: TrustInfo;
  /** Đánh giá của người đang xem: 1 = Hữu ích, 0 = Không hữu ích, null = chưa đánh giá. */
  myRating?: number | null;
  isFavorite?: boolean;
  rejectionReason?: string | null;
}

export interface AccessLink {
  externalUrl: string;
  storageSource?: string | null;
  accessNote?: string | null;
  accessCount: number;
}

export interface DocumentQuery {
  q?: string;
  facultyId?: number;
  majorId?: number;
  courseId?: number;
  lecturerId?: number;
  termId?: number;
  categoryCode?: string;
  minHelpfulPercent?: number;
  sort?: DocumentSort;
  page?: number;
  size?: number;
}

export interface Review {
  id: number;
  /** 1 = Hữu ích, 0 = Không hữu ích. */
  rating: number;
  content: string | null;
  createdAt: string;
  user: User;
}

export interface DocumentReport {
  id: number;
  documentId: number;
  documentTitle: string;
  documentStatus: DocumentStatus;
  reporter: Pick<User, 'id' | 'studentId' | 'fullName'>;
  reason: ReportReason;
  description?: string | null;
  status: 'PENDING' | 'RESOLVED' | 'REJECTED';
  adminId?: number | null;
  resolvedAt?: string | null;
  createdAt: string;
  document?: Document;
}

export interface DocumentMetadata {
  title: string;
  description: string;
  majorId: number;
  courseId: number;
  courseOfferingId: number | null;
  categoryCode: string;
  externalUrl: string;
  accessNote: string;
  isShareConfirmed: boolean;
}

export interface DashboardStats {
  totalStudents: number;
  totalDocuments: number;
  pendingDocuments: number;
  approvedDocuments: number;
  rejectedDocuments?: number;
  totalDownloads: number;
  recentActivities?: { type: string; description: string; createdAt: string; entityId: number }[];
}

export interface PopularCourse {
  id: number;
  code: string;
  name: string;
  documentCount: number;
}
