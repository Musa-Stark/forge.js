export interface AppErrorConstructor {
  message: string;
  statusCode: number;
  isOperational?: boolean;
  data?: {
    nextStep: string;
  };
}

class AppError extends Error {
  statusCode;
  isOperational;
  data;
  constructor(values: AppErrorConstructor) {
    super(values.message);
    this.message = values.message;
    this.statusCode = values.statusCode;
    this.isOperational = values.isOperational ?? true;
    this.data = values.data ?? undefined;
  }
}

export default AppError;
