import { ApiError } from '../utils/ApiError.js';

/**
 * Validates req.body/query/params against a Zod schema map, e.g.
 * validate({ body: registerSchema }). On failure, throws a 400 with a
 * field-level breakdown so the frontend can highlight the exact input.
 */
export const validate = (schemas) => (req, _res, next) => {
  for (const key of ['body', 'query', 'params']) {
    const schema = schemas[key];
    if (!schema) continue;

    const result = schema.safeParse(req[key]);
    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message
      }));
      return next(ApiError.badRequest('Validation failed', details));
    }
    req[key] = result.data;
  }
  next();
};
