import mongoose from 'mongoose';

const { Schema } = mongoose;

const speechRecordSchema = new Schema(
  {
    session: {
      type: Schema.Types.ObjectId,
      ref: 'InterviewSession',
      required: true,
      index: true
    },
    questionNumber: {
      type: Number,
      required: true
    },
    transcript: {
      type: String,
      required: true,
      trim: true
    },
    fillerWordCount: {
      type: Number,
      default: 0
    },
    fillerWords: {
      type: [String],
      default: []
    },
    sentimentScore: {
      type: Number, // -1 (negative) .. 1 (positive)
      min: -1,
      max: 1
    },
    sentimentLabel: {
      type: String,
      enum: ['positive', 'neutral', 'negative']
    },
    recordedAt: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

speechRecordSchema.index({ session: 1, questionNumber: 1 }, { unique: true });

export const SpeechRecord = mongoose.model('SpeechRecord', speechRecordSchema);
