import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * Global exception filter that unwraps DrizzleQueryError so the underlying
 * postgres-js error (the real root cause) is always visible in logs rather
 * than just the "Failed query: …" wrapper message.
 */
@Catch()
export class DbExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('DbExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // Determine HTTP status
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    // Unwrap DrizzleQueryError → postgres-js cause for logging
    if (exception instanceof Error) {
      const cause = (exception as any).cause;
      if (cause instanceof Error) {
        this.logger.error(
          `DB error on ${request.method} ${request.url} — root cause: [${(cause as any).code ?? cause.constructor.name}] ${cause.message}`,
          cause.stack,
        );
      } else {
        this.logger.error(
          `Unhandled exception on ${request.method} ${request.url}: ${exception.message}`,
          exception.stack,
        );
      }
    }

    response.status(status).json({
      statusCode: status,
      message: status === HttpStatus.INTERNAL_SERVER_ERROR ? 'Internal server error' : (exception as any)?.message,
      path: request.url,
    });
  }
}
