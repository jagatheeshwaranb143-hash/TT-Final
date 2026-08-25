export type UserRole = 'PRINCIPAL' | 'HOD' | 'FACULTY' | 'STUDENT';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  departmentId?: string;
}

export interface Department {
  id: string;
  name: string;
  code: string;
  headId: string;
}

export interface Faculty {
  id: string;
  userId: string;
  departmentId: string;
  name: string;
  code: string;
  designation: string;
  maxWorkload: number;
}

export interface Room {
  id: string;
  name: string;
  capacity: number;
  type: 'LECTURE' | 'LAB' | 'SEMINAR';
  departmentId?: string;
}

export interface Subject {
  id: string;
  code: string;
  name: string;
  type: 'THEORY' | 'PRACTICAL';
  credits: number;
  departmentId: string;
}

export interface Class {
  id: string;
  name: string;
  semester: number;
  departmentId: string;
}

export type TimetableStatus = 'DRAFT' | 'GENERATED' | 'APPROVED' | 'PUBLISHED';

export interface TimetableVersion {
  id: string;
  classId: string;
  status: TimetableStatus;
  qualityScore: number;
  createdAt: string;
  updatedAt: string;
}
