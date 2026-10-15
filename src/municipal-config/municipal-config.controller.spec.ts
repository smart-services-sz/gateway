import { MunicipalConfigController } from './municipal-config.controller';
import { MunicipalConfigService } from './municipal-config.service';
import { ROLES_KEY } from '../common/decorators/roles.decorator';

describe('MunicipalConfigController', () => {
  const list = jest.fn();
  const get = jest.fn();
  const save = jest.fn();
  const controller = new MunicipalConfigController({ list, get, save } as unknown as MunicipalConfigService);

  beforeEach(() => jest.clearAllMocks());

  it('limits catalog operations to ADMIN', () => {
    expect(Reflect.getMetadata(ROLES_KEY, MunicipalConfigController)).toEqual([
      'ADMIN',
    ]);
  });

  it('passes request context through list/get/save', () => {
    const context = { userId: 'admin-1', ip: '127.0.0.1' };
    const user = { userId: 'admin-1', roles: ['ADMIN'] };
    const dto = { id: 'funes', name: 'Funes' };

    controller.list(true, context as never);
    controller.get('funes', context as never);
    controller.save(dto as never, user as never, context as never);

    expect(list).toHaveBeenCalledWith(true, context);
    expect(get).toHaveBeenCalledWith('funes', context);
    expect(save).toHaveBeenCalledWith(dto, user, context);
  });
});