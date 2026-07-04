export interface AppErrorConstructor {
  message: string;
  statusCode: number;
  isOperational?: boolean;
}

class AppError extends Error {
  statusCode;
  isOperational;
  constructor(values: AppErrorConstructor) {
    super(values.message);
    this.message = values.message;
    this.statusCode = values.statusCode;
    this.isOperational = values.isOperational ?? true;
  }
}

export default AppError;
