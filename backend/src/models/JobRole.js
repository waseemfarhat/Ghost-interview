import mongoose from 'mongoose';

const { Schema } = mongoose;

const questionSchema = new Schema(
  {
    text: { type: String, required: true, trim: true },
    order: { type: Number, required: true }
  },
  { _id: false }
);

/**
 * Interview questions are cached per job role instead of calling the
 * question-generation provider on every session: keeps sessions fast,
 * reliable when the AI provider is briefly unavailable, and avoids
 * re-paying for generation on every single interview.
 */
const jobRoleSchema = new Schema(
  {
    roleName: {
      type: String,
      required: true,
      trim: true,
      unique: true
    },
    category: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      trim: true,
      maxlength: 1000
    },
    questionBank: {
      type: [questionSchema],
      default: []
    },
    isAiGenerated: {
      type: Boolean,
      default: false
    },
    isActive: {
      type: Boolean,
      default: true
    },
    questionsGeneratedAt: Date,
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  { timestamps: true }
);

// `unique: true` on the roleName field above already creates this index.
jobRoleSchema.index({ isActive: 1, category: 1 });

export const JobRole = mongoose.model('JobRole', jobRoleSchema);
