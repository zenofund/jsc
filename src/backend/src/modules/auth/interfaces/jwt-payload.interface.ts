export interface JwtPayload {
  sub: string; // User ID
  email: string;
  role: string;
  permissions?: string[];
  departmentId?: string;
  staffId?: string;
  sid?: string;
}
