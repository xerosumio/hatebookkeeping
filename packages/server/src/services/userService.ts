import { User, type IUser } from '../models/User.js';
import { getConfig } from '../config/env.js';
import { AppError } from '../middleware/errorHandler.js';

export interface OidcProfile {
  sub: string;
  email: string;
  name?: string;
  groups?: string[];
}

export async function upsertFromOidc(profile: OidcProfile): Promise<IUser> {
  const cfg = getConfig();
  const emailLower = profile.email.toLowerCase();
  const adminGroup = cfg.OIDC_ADMIN_GROUP.trim();
  const isAdmin = adminGroup.length > 0 && (profile.groups ?? []).includes(adminGroup);

  const bySub = await User.findOne({ authentikId: profile.sub });
  if (bySub) {
    if (!bySub.active) {
      throw new AppError(403, 'This account has been disabled. Ask an administrator to enable it.');
    }
    bySub.email = emailLower;
    if (profile.name) bySub.name = profile.name;
    if (adminGroup.length > 0) bySub.role = isAdmin ? 'admin' : 'user';
    await bySub.save();
    return bySub;
  }

  const byEmail = await User.findOne({ email: emailLower });
  if (byEmail) {
    if (!byEmail.active) {
      throw new AppError(403, 'This account has been disabled. Ask an administrator to enable it.');
    }
    byEmail.authentikId = profile.sub;
    if (profile.name) byEmail.name = profile.name;
    if (adminGroup.length > 0) byEmail.role = isAdmin ? 'admin' : 'user';
    await byEmail.save();
    return byEmail;
  }

  let role: 'admin' | 'user' = isAdmin ? 'admin' : 'user';
  if (adminGroup.length === 0 && role !== 'admin') {
    const admins = await User.countDocuments({ role: 'admin', active: true });
    if (admins === 0) role = 'admin';
  }

  return User.create({
    authentikId: profile.sub,
    email: emailLower,
    name: profile.name ?? profile.email,
    role,
    active: true,
  });
}
