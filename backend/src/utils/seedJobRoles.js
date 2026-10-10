/**
 * Seeds a curated default question bank per job role - the admin-managed
 * question source decided during Phase 3, in place of a live LLM call per
 * session. Admins can add/edit more roles and questions afterward via the
 * admin panel (uses the same JobRole model and question bank shape).
 * Usage: npm run seed:roles
 */
import { connectDB, disconnectDB } from '../config/db.js';
import { JobRole } from '../models/JobRole.js';
import { logger } from '../config/logger.js';

const DEFAULT_JOB_ROLES = [
  {
    roleName: 'Software Engineer',
    category: 'Technology',
    description: 'General software engineering interview covering technical fundamentals and problem solving.',
    questionBank: [
      'Tell me about yourself and your experience as a software engineer.',
      'Describe a challenging bug you fixed and how you approached debugging it.',
      'How do you decide between different data structures for a given problem?',
      'Tell me about a time you disagreed with a teammate on a technical decision. How did you resolve it?',
      'How do you approach learning a new technology or framework quickly?',
      'Describe your experience working in an agile or fast-paced development environment.',
      'What does clean, maintainable code mean to you?',
      'Tell me about a project you are most proud of and why.',
      'How would you design an API that needs to support a growing number of users?',
      'How do you choose what to test, and how do you keep tests useful over time?',
      'Describe a code review comment that changed your approach to a problem.',
      'How do you balance delivery speed with technical debt and reliability?'
    ]
  },
  {
    roleName: 'Data Analyst',
    category: 'Data & Analytics',
    description: 'Interview focused on analytical thinking, data storytelling, and business impact.',
    questionBank: [
      'Walk me through a data analysis project you worked on from start to finish.',
      'How do you handle missing or inconsistent data in a dataset?',
      'Describe a time your analysis changed a business decision.',
      'How do you decide which visualization to use for a given dataset?',
      'Tell me about a time you had to explain a technical finding to a non-technical stakeholder.',
      'What steps do you take to validate that your analysis is correct?',
      'How do you prioritize multiple analysis requests with tight deadlines?',
      'How would you investigate a sudden change in a key business metric?',
      'What is the difference between correlation and causation, and how do you communicate it?',
      'How do you protect sensitive data while preparing an analysis?',
      'How would you evaluate whether a proposed experiment produced a meaningful result?'
    ]
  },
  {
    roleName: 'HR Interview',
    category: 'Human Resources',
    description: 'General behavioral/HR round applicable across most roles.',
    questionBank: [
      'Tell me about yourself.',
      'Why do you want to work for this company?',
      'Tell me about a time you faced a significant challenge at work and how you overcame it.',
      'Describe a situation where you had to work with a difficult team member.',
      'Where do you see yourself in five years?',
      'What is your greatest strength and how has it helped you professionally?',
      'Tell me about a time you failed and what you learned from it.',
      'How do you handle stress and tight deadlines?',
      'What kind of feedback helps you do your best work?',
      'Describe a time you had to adapt quickly to a change in priorities.',
      'What questions would you ask to decide whether a role is right for you?'
    ]
  },
  {
    roleName: 'Marketing Specialist',
    category: 'Marketing',
    description: 'Interview covering campaign strategy, analytics, and communication skills.',
    questionBank: [
      'Tell me about a marketing campaign you are proud of and its results.',
      'How do you measure the success of a marketing campaign?',
      'Describe how you would approach marketing a new product with a limited budget.',
      'Tell me about a time you had to adjust a campaign strategy based on data.',
      'How do you stay current with marketing trends and tools?',
      'Describe your experience working with cross-functional teams like sales or design.',
      'How would you identify the right audience for a product launch?',
      'Which metrics would you use to assess a campaign beyond impressions?',
      'Tell me about a campaign that did not meet its goal and what you changed.',
      'How do you keep brand messaging consistent across different channels?'
    ]
  },
  {
    roleName: 'Product Manager',
    category: 'Product',
    description: 'Product discovery, prioritization, roadmap decisions, and cross-functional delivery.',
    questionBank: [
      'How do you identify and validate a customer problem before proposing a solution?',
      'Tell me about a product decision you made using customer or usage data.',
      'How do you prioritize competing requests from customers and stakeholders?',
      'How would you define success metrics for a newly launched feature?',
      'Describe a time you had to change a roadmap after learning something new.',
      'How do you work through disagreement with engineering or design?',
      'How do you distinguish a useful feature request from the underlying user need?',
      'What would you do if a feature shipped on time but adoption remained low?',
      'How do you communicate trade-offs when a deadline cannot include every requirement?',
      'Tell me about a product outcome you are proud of and how you measured it.'
    ]
  },
  {
    roleName: 'UX/UI Designer',
    category: 'Design',
    description: 'User research, interaction design, accessibility, prototyping, and design collaboration.',
    questionBank: [
      'Walk me through your design process from an unclear problem to a tested solution.',
      'How do you choose research methods for a project with limited time?',
      'Tell me about a usability issue you uncovered and how the design changed.',
      'How do you balance user needs, business goals, and technical constraints?',
      'What steps do you take to make an interface accessible?',
      'How do you decide when a design is ready to hand off to engineering?',
      'Describe a time usability testing challenged your original assumptions.',
      'How do you maintain consistency while designing a new feature?',
      'What do you do when stakeholders disagree with research findings?',
      'How do you evaluate whether a design improved the user experience?'
    ]
  },
  {
    roleName: 'QA Engineer',
    category: 'Technology',
    description: 'Test planning, defect investigation, automation strategy, and release quality.',
    questionBank: [
      'How do you turn a product requirement into a practical test plan?',
      'How do you decide which tests should be automated?',
      'Describe a difficult defect you reproduced and how you isolated its cause.',
      'What information makes a bug report useful to the development team?',
      'How would you test a feature when its requirements are incomplete?',
      'How do you balance regression coverage with a tight release schedule?',
      'What risks do you consider when testing an API integration?',
      'How do you handle a defect that cannot be reproduced consistently?',
      'How do you make automated tests reliable and maintainable?',
      'Tell me about a quality improvement you introduced to a team.'
    ]
  },
  {
    roleName: 'DevOps Engineer',
    category: 'Technology',
    description: 'Cloud infrastructure, delivery automation, observability, reliability, and incident response.',
    questionBank: [
      'Describe a deployment pipeline you built or improved.',
      'How do you manage secrets and environment-specific configuration?',
      'What signals do you monitor to understand service health?',
      'Walk me through how you would investigate a production outage.',
      'How do you plan infrastructure changes to reduce deployment risk?',
      'What is your approach to backups and recovery testing?',
      'How do you balance cloud cost with performance and reliability?',
      'How do you make a deployment easy to roll back?',
      'Tell me about a repetitive operational task you automated.',
      'How do you share incident learnings without assigning blame?'
    ]
  },
  {
    roleName: 'Cybersecurity Analyst',
    category: 'Technology',
    description: 'Threat analysis, incident response, security controls, and risk communication.',
    questionBank: [
      'How would you triage an alert that may indicate a compromised account?',
      'What steps would you take after discovering exposed credentials?',
      'How do you distinguish a false positive from a genuine security incident?',
      'How would you explain a technical security risk to a non-technical team?',
      'What information should an incident timeline capture?',
      'How do you prioritize vulnerabilities when a team cannot fix everything at once?',
      'What practices help reduce phishing risk across an organization?',
      'How do you preserve useful evidence while containing an incident?',
      'Tell me about a security control you evaluated or improved.',
      'How do you keep your security knowledge current?'
    ]
  },
  {
    roleName: 'Business Analyst',
    category: 'Business',
    description: 'Requirements discovery, process analysis, stakeholder alignment, and measurable outcomes.',
    questionBank: [
      'How do you clarify a request when different stakeholders describe different problems?',
      'What techniques do you use to document requirements clearly?',
      'Tell me about a process improvement you recommended and its result.',
      'How do you validate that a proposed solution meets the original need?',
      'How do you handle a requirement that changes late in delivery?',
      'What do you include in acceptance criteria for a feature?',
      'How do you map a complex process so others can understand it?',
      'Describe a time you used data to challenge an assumption.',
      'How do you prioritize requirements when time or budget is limited?',
      'How do you measure whether a business change was successful?'
    ]
  },
  {
    roleName: 'Project Manager',
    category: 'Business',
    description: 'Planning, risk management, stakeholder communication, and delivery coordination.',
    questionBank: [
      'How do you build a realistic project plan when some details are unknown?',
      'How do you identify and track risks before they affect delivery?',
      'Tell me about a project that fell behind schedule and how you responded.',
      'How do you keep stakeholders informed without overwhelming them?',
      'How do you resolve a conflict over scope, time, or available resources?',
      'What do you do when a key dependency is delayed?',
      'How do you decide whether a project change needs formal approval?',
      'How do you keep a team focused when priorities compete?',
      'Which signals tell you a project is at risk even if status reports look positive?',
      'How do you capture lessons learned and apply them to later projects?'
    ]
  },
  {
    roleName: 'Sales Representative',
    category: 'Sales',
    description: 'Customer discovery, consultative selling, negotiation, and account follow-through.',
    questionBank: [
      'How do you prepare for a first conversation with a prospective customer?',
      'What questions help you understand a buyer’s real priorities?',
      'Tell me about a time you responded to a customer who was hesitant to proceed.',
      'How do you decide whether a lead is a good fit for your product?',
      'How do you keep follow-up useful rather than repetitive?',
      'Describe a negotiation where you protected value while addressing customer needs.',
      'How do you organize your pipeline and decide what to work on each day?',
      'What do you do after losing a sale?',
      'How do you set expectations when the product cannot meet every request?',
      'Which measures help you understand the quality of your sales performance?'
    ]
  },
  {
    roleName: 'Customer Support Specialist',
    category: 'Customer Experience',
    description: 'Customer communication, issue diagnosis, de-escalation, and service improvement.',
    questionBank: [
      'How do you respond when a customer is upset about an unresolved issue?',
      'How do you gather the right details before troubleshooting a problem?',
      'Tell me about a time you explained a complicated issue in simple language.',
      'How do you decide when to escalate a customer case?',
      'What do you do when you do not know the answer to a customer’s question?',
      'How do you manage several customer requests with different urgency levels?',
      'How do you maintain empathy while following a required support process?',
      'Describe a recurring customer issue you helped prevent or reduce.',
      'How do you handle feedback that feels unfair or inaccurate?',
      'What does a successful customer support interaction look like to you?'
    ]
  },
  {
    roleName: 'Accountant',
    category: 'Finance',
    description: 'Financial reporting, reconciliations, controls, accuracy, and deadline management.',
    questionBank: [
      'How do you check the accuracy of financial information before reporting it?',
      'Describe your approach to investigating a reconciliation difference.',
      'How do you organize work around a close or reporting deadline?',
      'What internal controls help prevent or detect accounting errors?',
      'Tell me about a time you found an inconsistency and how you resolved it.',
      'How do you explain a financial variance to a non-finance colleague?',
      'How do you protect confidential financial information?',
      'What steps do you take when documentation for a transaction is incomplete?',
      'How do you keep up with changes to accounting policies or requirements?',
      'How have you used spreadsheets or accounting tools to improve a process?'
    ]
  }
];

async function seedJobRoles() {
  await connectDB();

  for (const role of DEFAULT_JOB_ROLES) {
    const existing = await JobRole.findOne({ roleName: role.roleName });
    if (existing) {
      const existingQuestions = new Set(existing.questionBank.map((question) => question.text.trim().toLowerCase()));
      const newQuestions = role.questionBank.filter((text) => !existingQuestions.has(text.trim().toLowerCase()));

      if (!newQuestions.length) {
        logger.info(`Job role "${role.roleName}" is up to date, skipping.`);
        continue;
      }

      const nextOrder = existing.questionBank.reduce((max, question) => Math.max(max, question.order), -1) + 1;
      existing.questionBank.push(
        ...newQuestions.map((text, index) => ({ text, order: nextOrder + index }))
      );
      await existing.save();
      logger.info(`Added ${newQuestions.length} questions to "${role.roleName}"`);
      continue;
    }

    await JobRole.create({
      roleName: role.roleName,
      category: role.category,
      description: role.description,
      isActive: true,
      questionsGeneratedAt: new Date(),
      questionBank: role.questionBank.map((text, index) => ({ text, order: index }))
    });
    logger.info(`Seeded job role: ${role.roleName} (${role.questionBank.length} questions)`);
  }

  await disconnectDB();
  process.exit(0);
}

seedJobRoles().catch((err) => {
  logger.error(`Seed job roles failed: ${err.message}`);
  process.exit(1);
});
