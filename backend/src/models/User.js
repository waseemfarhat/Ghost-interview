import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { env } from '../config/env.js';

const { Schema } = mongoose;

const userSchema = new Schema(
  {
    fullName: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
      minlength: 2,
      maxlength: 100
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Invalid email address'],
      index: true
    },
    passwordHash: {
      type: String,
      required: true,
      select: false
    },
    role: {
      type: String,
      enum: ['candidate', 'admin'],
      default: 'candidate'
    },
    status: {
      type: String,
      enum: ['active', 'suspended', 'deleted'],
      default: 'active'
    },
    isEmailVerified: {
      type: Boolean,
      default: false
    },
    // Incremented on password change / logout-all to invalidate outstanding refresh tokens.
    tokenVersion: {
      type: Number,
      default: 0
    },
    passwordResetTokenHash: {
      type: String,
      select: false
    },
    passwordResetExpires: {
      type: Date,
      select: false
    },
    lastLoginAt: Date,
    failedLoginAttempts: {
      type: Number,
      default: 0
    },
    lockUntil: Date,
    deletedAt: Date
  },
  { timestamps: true }
);

// `unique: true` on the email field above already creates this index.
userSchema.index({ status: 1 });

userSchema.virtual('isLocked').get(function isLocked() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

userSchema.methods.comparePassword = async function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.passwordHash);
};

userSchema.methods.toSafeJSON = function toSafeJSON() {
  return {
    id: this._id,
    fullName: this.fullName,
    email: this.email,
    role: this.role,
    status: this.status,
    isEmailVerified: this.isEmailVerified,
    createdAt: this.createdAt
  };
};

userSchema.statics.hashPassword = async function hashPassword(plain) {
  return bcrypt.hash(plain, env.bcryptSaltRounds);
};

export const User = mongoose.model('User', userSchema);
