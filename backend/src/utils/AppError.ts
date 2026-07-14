export class AppError extends Error {
    public statusCode: number;
    public isOperational: boolean;

    constructor(message: string, statusCode: number) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = true; // Distinguishes expected errors from unexpected crashes
        Object.setPrototypeOf(this, AppError.prototype);
    }
}
