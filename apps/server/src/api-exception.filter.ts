import { Catch, HttpException, Logger } from '@nestjs/common';
import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';

export class ApiException extends HttpException {
  constructor(
    statusCode: number,
    readonly code: string,
    message: string,
  ) {
    super({ code, message }, statusCode);
  }
}

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<FastifyRequest>();
    const reply = context.getResponse<FastifyReply>();

    if (exception instanceof ApiException) {
      reply.status(exception.getStatus()).send({
        code: exception.code,
        message: this.getMessage(exception),
        requestId: request.id,
      });
      return;
    }

    if (exception instanceof HttpException) {
      reply.status(exception.getStatus()).send({
        code: 'REQUEST_ERROR',
        message: this.getMessage(exception),
        requestId: request.id,
      });
      return;
    }

    this.logger.error(
      {
        requestId: request.id,
        route: request.routeOptions.url,
      },
      exception instanceof Error ? exception.stack : 'Unknown server error',
    );
    reply.status(500).send({
      code: 'INTERNAL_SERVER_ERROR',
      message: '서버에서 요청을 처리하지 못했습니다.',
      requestId: request.id,
    });
  }

  private getMessage(exception: HttpException): string {
    const response = exception.getResponse();

    if (typeof response === 'string') {
      return response;
    }

    if (
      typeof response === 'object' &&
      response !== null &&
      'message' in response &&
      typeof response.message === 'string'
    ) {
      return response.message;
    }

    return '요청을 처리할 수 없습니다.';
  }
}
