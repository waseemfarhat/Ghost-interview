import mongoose from 'mongoose';

const { Schema } = mongoose;

const adminNotificationSchema = new Schema(
  {
    recipient: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    type: {
      type: String,
      enum: ['job-role-created'],
      required: true
    },
    title: {
      type: String,
      required: true
    },
    message: {
      type: String,
      required: true
    },
    jobRole: {
      type: Schema.Types.ObjectId,
      ref: 'JobRole',
      required: true
    },
    isRead: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
);

adminNotificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });

export const AdminNotification = mongoose.model('AdminNotification', adminNotificationSchema);
