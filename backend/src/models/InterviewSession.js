import mongoose from 'mongoose';

const { Schema } = mongoose;

const sessionQuestionSchema = new Schema(
  {
    text: { type: String, required: true },
    order: { type: Number, required: true },
    askedAt: Date,
    // Generated from the candidate's previous answer rather than the role's question bank.
    isFollowUp: { type: Boolean, default: false }
  },
  { _id: false }
);

const interviewSessionSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    jobRole: {
      type: Schema.Types.ObjectId,
      ref: 'JobRole',
      required: true
    },
    questions: {
      type: [sessionQuestionSchema],
      default: []
    },
    currentQuestionIndex: {
      type: Number,
      default: 0
    },
    status: {
      type: String,
      enum: ['idle', 'initializing', 'active', 'processing', 'completed', 'terminated', 'error'],
      default: 'idle'
    },
    startTime: Date,
    endTime: Date,
    errorReason: String
  },
  { timestamps: true }
);

interviewSessionSchema.index({ user: 1, createdAt: -1 });
interviewSessionSchema.index({ status: 1 });

export const InterviewSession = mongoose.model('InterviewSession', interviewSessionSchema);
