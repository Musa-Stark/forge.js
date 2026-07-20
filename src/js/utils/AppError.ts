export interface AppErrorConstructor {
  message: string;
  statusCode: number;
  isOperational?: boolean;
  code: string;
  details: {
    handler: string;
    method: string;
    path: string;
  };
  hint: string;
}

class AppError extends Error {
  statusCode;
  isOperational;
  code;
  details;
  hint;
  constructor(values: AppErrorConstructor) {
    super(values.message);
    this.message = values.message;
    this.statusCode = values.statusCode;
    this.isOperational = values.isOperational ?? true;
    this.code = values.code;
    this.details = values.details;
    this.hint = values.hint;
  }
}

export default AppError;
