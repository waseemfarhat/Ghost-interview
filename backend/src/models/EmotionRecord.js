import mongoose from 'mongoose';

const { Schema } = mongoose;

const emotionRecordSchema = new Schema(
  {
    session: {
      type: Schema.Types.ObjectId,
      ref: 'InterviewSession',
      required: true,
      index: true
    },
    emotionLabel: {
      type: String,
      enum: ['happy', 'neutral', 'confused', 'anxious', 'angry', 'sad', 'surprised'],
      required: true
    },
    confidenceScore: {
      type: Number, // AI model's confidence in the emotion label, 0..1
      min: 0,
      max: 1,
      required: true
    },
    eyeContactScore: {
      type: Number, // 0..1
      min: 0,
      max: 1
    },
    nervousnessScore: {
      type: Number, // 0..1
      min: 0,
      max: 1
    },
    capturedAt: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

emotionRecordSchema.index({ session: 1, capturedAt: 1 });

export const EmotionRecord = mongoose.model('EmotionRecord', emotionRecordSchema);
