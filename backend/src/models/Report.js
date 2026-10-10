import mongoose from 'mongoose';

const { Schema } = mongoose;

const emotionSummarySchema = new Schema(
  {
    dominantEmotion: String,
    distribution: {
      type: Map,
      of: Number // emotion label -> percentage (0..100)
    },
    averageEyeContact: Number,
    averageNervousness: Number,
    timeline: [
      {
        capturedAt: Date,
        emotionLabel: String,
        confidenceScore: Number,
        eyeContactScore: Number,
        nervousnessScore: Number
      }
    ]
  },
  { _id: false }
);

const reportSchema = new Schema(
  {
    session: {
      type: Schema.Types.ObjectId,
      ref: 'InterviewSession',
      required: true,
      unique: true
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    confidenceScore: {
      type: Number, // 0..100
      min: 0,
      max: 100,
      required: true
    },
    competencyScore: {
      type: Number, // 0..100
      min: 0,
      max: 100,
      required: true
    },
    communicationScore: {
      type: Number,
      min: 0,
      max: 100
    },
    emotionalStabilityScore: {
      type: Number,
      min: 0,
      max: 100
    },
    overallReadinessScore: {
      type: Number, // 0..10
      min: 0,
      max: 10,
      required: true
    },
    fillerWordCount: {
      type: Number,
      default: 0
    },
    emotionSummary: emotionSummarySchema,
    sentimentSummary: {
      type: String,
      enum: ['positive', 'neutral', 'negative']
    },
    strengths: {
      type: [String],
      default: []
    },
    improvementAreas: {
      type: [String],
      default: []
    },
    isPartial: {
      type: Boolean,
      default: false
    },
    generatedAt: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

// `unique: true` on the session field above already creates this index.
reportSchema.index({ user: 1, generatedAt: -1 });

export const Report = mongoose.model('Report', reportSchema);
