## Gateway - SmartService

API Gateway que orquesta la comunicación entre webhooks de Meta WhatsApp, microservicios internos (ms-ai, ms-geo, ms-reclamos) y sistema de respuesta por WhatsApp.

## Arquitectura

```
Meta WhatsApp Webhook
      ↓
[GET/POST] /api/webhooks/meta/whatsapp
      ↓
WebhooksService (Validación y firma X-Hub-Signature-256)
      ↓
InboundService (Debounce, deduplicación, buffering en Redis)
      ↓
NATS → ms-ai (Procesamiento con OpenAI)
      ↓
WhatsappService (Respuesta vía Meta WhatsApp API)
      ↓
Meta WhatsApp API → Usuario
```

## Configuración Requerida

### Variables de Entorno (.env)

```bash
# Meta WhatsApp Webhook
META_WHATSAPP_WEBHOOK_VERIFY_TOKEN=tu_token_verificacion
META_WHATSAPP_APP_SECRET=tu_app_secret
META_WHATSAPP_ACCESS_TOKEN=tu_access_token_de_meta
META_BUSINESS_ACCOUNT_ID=tu_business_account_id
META_API_VERSION=v25.0

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# NATS (Microservicios)
NATS_SERVERS=nats://localhost:4222

# Inbound Processing
INBOUND_IDEMPOTENCY_TTL_SECONDS=86400
INBOUND_CONTEXT_TTL_SECONDS=86400
INBOUND_MESSAGE_HISTORY_LIMIT=20
INBOUND_MIN_DEBOUNCE_MS=800
INBOUND_MIN_DEBOUNCE_WHATSAPP_MS=2000

# WhatsApp Response Timing
META_WHATSAPP_RESPONSE_DEBOUNCE_MS=2500
META_WHATSAPP_RESPONSE_DELAY_MS=300
META_WHATSAPP_RESPONSE_MAX_ACCUMULATION_MS=8000
```

## Flujo de Mensajes

### Entrada (Inbound)

1. Meta envía webhook a `POST /api/webhooks/meta/whatsapp`
2. Se valida firma `X-Hub-Signature-256`
3. Se extrae el mensaje de texto del payload de Meta
4. Se bufferiza en Redis con debounce (2.5s por defecto)
5. Al vencer el debounce, se envía a ms-ai como payload consolidado

### Salida (Outbound)

1. ms-ai responde con `assistantMessage` vía NATS
2. Gateway invoca `WhatsappService.sendTextMessage()`
3. Se envía a Meta WhatsApp API
4. Meta entrega al usuario por WhatsApp

## Endpoints

### Webhook Verification (GET)
```
GET /api/webhooks/meta/whatsapp
Query Params:
  - hub.mode: "subscribe"
  - hub.verify_token: Tu token de verificación
  - hub.challenge: Challenge de Meta
```

### Webhook Reception (POST)
```
POST /api/webhooks/meta/whatsapp
Headers:
  - X-Hub-Signature-256: sha256=...
Body: Payload de Meta WhatsApp (JSON)
```

### Context Query (Diagnóstico)
```
GET /api/inbound/messages/context?contactKey=whatsapp:phone:5491166660000
```

Retorna contexto completo: mensajes bufferizados, estado de conversación, último resultado de dispatch.

## Project setup

```bash
$ npm install
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
