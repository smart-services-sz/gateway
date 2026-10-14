import { ConfigService } from '@nestjs/config';
import { InboundService } from '../../inbound/inbound.service';
import { DispatchHandler } from './dispatch.handler';

describe('DispatchHandler WhatsApp quick replies', () => {
  const inboundService = {
    receiveMessage: jest.fn().mockResolvedValue({ status: 'accepted' }),
  };
  const handler = new DispatchHandler(
    inboundService as unknown as InboundService,
    { get: jest.fn(() => undefined) } as unknown as ConfigService,
  );

  beforeEach(() => jest.clearAllMocks());

  const webhook = (buttonPayload: string) => ({
    object: 'whatsapp_business_account',
    entry: [
      {
        id: 'business-account',
        changes: [
          {
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              metadata: { phone_number_id: 'phone-number-id' },
              contacts: [{ wa_id: '5493415551234' }],
              messages: [
                {
                  id: 'wamid.button',
                  from: '5493415551234',
                  timestamp: '1791980000',
                  type: 'button',
                  button: { text: 'Confirmar', payload: buttonPayload },
                },
              ],
            },
          },
        ],
      },
    ],
  });

  it.each([
    ['smartservice|REC-ABC123|confirm', 'REC-ABC123 CONFORME'],
    ['smartservice|REC-ABC123|disagree', 'REC-ABC123 DISCONFORME'],
    ['smartservice|REC-ABC123|reopen', 'REC-ABC123 REABRIR'],
  ])(
    'maps %s into an AI command without requiring the citizen to retype the code',
    async (buttonPayload, messageText) => {
      const context = { stopped: false, extractedMessages: [] } as never;
      await handler.handle(webhook(buttonPayload) as never, context);

      expect(inboundService.receiveMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: 'whatsapp',
          messageText,
          externalMessageId: 'wamid.button',
          channelIdentity: expect.objectContaining({
            normalizedValue: '5493415551234',
          }),
        }),
      );
    },
  );

  it('ignores invalid button payloads', async () => {
    const context = { stopped: false, extractedMessages: [] } as never;
    await handler.handle(webhook('untrusted-user-payload') as never, context);

    expect(inboundService.receiveMessage).not.toHaveBeenCalled();
  });
});