import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';
import { AuditService } from './modules/audit/audit.service';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // Increase payload size limit for large bulk uploads
  const { json, urlencoded } = require('express');
  app.use(json({ limit: '10mb' }));
  app.use(urlencoded({ extended: true, limit: '10mb' }));

  // Global prefix
  const apiPrefix = configService.get<string>('API_PREFIX', 'api/v1');
  app.setGlobalPrefix(apiPrefix);

  // CORS
  const corsOrigins = configService.get<string>('CORS_ORIGINS', 'http://localhost:5173');
  app.enableCors({
    origin: corsOrigins.split(',').map(origin => origin.trim()),
    credentials: true,
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Swagger API Documentation
  const config = new DocumentBuilder()
    .setTitle('JSC Payroll Management System API')
    .setDescription('Nigerian Judicial Service Committee Payroll Management System - RESTful API Documentation')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('Health', 'Health checks and system status')
    .addTag('Authentication', 'User authentication and authorization')
    .addTag('Staff', 'Staff management and onboarding')
    .addTag('Departments', 'Department management')
    .addTag('Payroll', 'Payroll batch processing')
    .addTag('Allowances', 'Allowance configuration')
    .addTag('Deductions', 'Deduction configuration')
    .addTag('Leaves', 'Leave management')
    .addTag('Loans', 'Loan and cooperative management')
    .addTag('Reports', 'Reports and analytics')
    .addTag('Audit', 'Audit trail')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = configService.get<number>('PORT', 3000);
  // Listen on all interfaces (IPv4 and IPv6)
  const auditService = app.get(AuditService);
  app.useGlobalInterceptors(new AuditInterceptor(auditService));
  await app.listen(port);

  console.log(`
  ╔═══════════════════════════════════════════════════════════╗
  ║                                                           ║
  ║   JSC Payroll Management System - Backend API            ║
  ║                                                           ║
  ║   🚀 Server running on: http://localhost:${port}           ║
  ║   📚 API Documentation: http://localhost:${port}/api/docs  ║
  ║   🌍 Environment: ${configService.get<string>('NODE_ENV')}                    ║
  ║                                                           ║
  ╚═══════════════════════════════════════════════════════════╝
  `);
}

bootstrap();
