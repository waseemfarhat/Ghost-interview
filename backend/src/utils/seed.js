/**
 * Creates the initial administrator account from ADMIN_EMAIL/ADMIN_PASSWORD
 * env vars. Safe to re-run: no-ops if that admin already exists.
 * Usage: npm run seed
 */
import { connectDB, disconnectDB } from '../config/db.js';
import { User } from '../models/User.js';
import { logger } from '../config/logger.js';

async function seed() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const fullName = process.env.ADMIN_NAME || 'System Administrator';

  if (!email || !password) {
    logger.error('Set ADMIN_EMAIL and ADMIN_PASSWORD env vars before seeding.');
    process.exit(1);
  }

  await connectDB();

  const existing = await User.findOne({ email });
  if (existing) {
    logger.info(`Admin ${email} already exists, skipping.`);
  } else {
    const passwordHash = await User.hashPassword(password);
    await User.create({
      fullName,
      email,
      passwordHash,
      role: 'admin',
      status: 'active',
      isEmailVerified: true
    });
    logger.info(`Admin account created: ${email}`);
  }

  await disconnectDB();
  process.exit(0);
}

seed().catch((err) => {
  logger.error(`Seed failed: ${err.message}`);
  process.exit(1);
});
