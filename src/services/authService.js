/**
 * DDevUltraHome — Authentication & Role-Based Authorization Service
 * Native Node.js crypto authentication with secure password verification and token generation.
 */

import crypto from 'node:crypto';
import { roleHasPermission, Roles, Permissions } from '../../config/rbac.js';

export class AuthService {
  constructor(dbConnection) {
    this.db = dbConnection;
    this.activeSessions = new Map(); // token -> { user, expiresAt }
  }

  /**
   * Securely hash password using PBKDF2 with random 16-byte salt
   */
  static hashPassword(password, existingSalt = null) {
    const salt = existingSalt || crypto.randomBytes(16).toString('hex');
    const iterations = 10000;
    const keylen = 32;
    const digest = 'sha256';
    const hash = crypto.pbkdf2Sync(password, salt, iterations, keylen, digest).toString('hex');
    return `pbkdf2$${salt}$${hash}`;
  }

  /**
   * Verify password against stored hash (supports both pbkdf2 and legacy sha256 seeded format)
   */
  static verifyPassword(password, storedHash) {
    if (!storedHash || !password) return false;

    if (storedHash.startsWith('pbkdf2$')) {
      const parts = storedHash.split('$');
      if (parts.length !== 3) return false;
      const salt = parts[1];
      const expectedHash = parts[2];
      const computed = crypto.pbkdf2Sync(password, salt, 10000, 32, 'sha256').toString('hex');
      return crypto.timingSafeEqual(Buffer.from(expectedHash, 'hex'), Buffer.from(computed, 'hex'));
    }

    if (storedHash.startsWith('sha256$')) {
      const parts = storedHash.split('$');
      const salt = parts[1];
      const expectedHash = parts[2];
      const computed = crypto.createHash('sha256').update(password + salt).digest('hex');
      return expectedHash === computed;
    }

    return false;
  }

  /**
   * Authenticate user with email and password
   */
  login(email, password) {
    const user = this.db.queryOne(
      'SELECT id, email, password_hash, full_name, role, assigned_project_ids, is_active FROM users WHERE email = ? AND deleted_at IS NULL;',
      [email.toLowerCase().trim()]
    );

    if (!user) {
      throw new Error('Invalid email or password.');
    }

    if (!user.is_active) {
      throw new Error('User account is deactivated. Please contact the company owner.');
    }

    const isValid = AuthService.verifyPassword(password, user.password_hash);
    if (!isValid) {
      throw new Error('Invalid email or password.');
    }

    // Update last login timestamp
    this.db.run('UPDATE users SET last_login_at = datetime(\'now\') WHERE id = ?;', [user.id]);

    // Generate secure session token
    const token = 'ddev_tok_' + crypto.randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const sessionUser = {
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      role: user.role,
      assignedProjectIds: user.assigned_project_ids ? JSON.parse(user.assigned_project_ids) : []
    };

    this.activeSessions.set(token, {
      user: sessionUser,
      expiresAt
    });

    return {
      token,
      expiresAt: expiresAt.toISOString(),
      user: sessionUser
    };
  }

  /**
   * Verify session token and return user
   */
  verifySession(token) {
    if (!token) return null;
    const session = this.activeSessions.get(token);
    if (!session) return null;

    if (new Date() > session.expiresAt) {
      this.activeSessions.delete(token);
      return null;
    }

    return session.user;
  }

  /**
   * Logout user and invalidate token
   */
  logout(token) {
    if (token) {
      this.activeSessions.delete(token);
    }
    return true;
  }

  /**
   * Authorize a user action based on RBAC and optional project context
   */
  authorize(user, permission, projectContext = null) {
    if (!user || !user.role) return false;

    // 1. Role permission check
    const hasBasePermission = roleHasPermission(user.role, permission);
    if (!hasBasePermission) return false;

    // 2. Project scope restriction for Site Managers, Engineers, and Clients
    if (projectContext && projectContext.projectId) {
      if (user.role === Roles.SITE_MANAGER || user.role === Roles.ENGINEER || user.role === Roles.CLIENT) {
        if (Array.isArray(user.assignedProjectIds) && user.assignedProjectIds.length > 0) {
          return user.assignedProjectIds.includes(projectContext.projectId);
        }
      }
    }

    return true;
  }
}
