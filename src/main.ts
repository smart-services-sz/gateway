import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'; 
import cookieParser from 'cookie-parser';

async function bootstrap() {

  const logger = new Logger('GATEWAY');

  const app = await NestFactory.create(AppModule, {
    rawBody: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.set('trust proxy', 1);

  app.setGlobalPrefix('api'); 

  const config = new DocumentBuilder() 
  .setTitle('Servicios API Gateway') 
  .setDescription('API pública del sistema de servicios') 
  .setVersion('1.0') 
  .addBearerAuth()
  .build(); 

  app.use(cookieParser());

  app.enableCors();

  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup('api/docs', app, document);

  const port = Number(process.env.PORT) || 3000;
  await app.listen(port);

  logger.log(`
  ----------------------------------------
    GATEWAY STARTED
    PORT: ${port}
    ENV : ${process.env.NODE_ENV}
    NATS_SERVERS: ${process.env.NATS_SERVERS}
    REDIS: ${process.env.REDIS_URL}
  ----------------------------------------
  `);

}
bootstrap();
