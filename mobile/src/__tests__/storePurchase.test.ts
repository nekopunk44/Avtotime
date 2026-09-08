/**
 * Логика покупки со сторовым модулем-подменой: порядок finishTransaction
 * относительно серверной проверки — то, что нельзя сломать молча.
 */
const mockListeners: { purchase?: (p: unknown) => void; error?: (e: unknown) => void } = {};
const mockIap = {
  initConnection: jest.fn(async () => true),
  endConnection: jest.fn(async () => true),
  fetchProducts: jest.fn(async () => [
    { id: 'avtotime_pro_monthly', subscriptionOfferDetailsAndroid: [{ offerToken: 'offer-1' }] },
  ]),
  purchaseUpdatedListener: jest.fn((cb: (p: unknown) => void) => {
    mockListeners.purchase = cb;
    return { remove: jest.fn() };
  }),
  purchaseErrorListener: jest.fn((cb: (e: unknown) => void) => {
    mockListeners.error = cb;
    return { remove: jest.fn() };
  }),
  requestPurchase: jest.fn(async () => {
    // Стор отвечает асинхронно через листенер — как в жизни.
    setTimeout(() => mockListeners.purchase?.({ productId: 'avtotime_pro_monthly', purchaseToken: 'tok-42' }), 0);
    return null;
  }),
  finishTransaction: jest.fn(async () => {}),
  getAvailablePurchases: jest.fn(async () => []),
  getReceiptDataIOS: jest.fn(async () => 'app-receipt'),
};
jest.mock('react-native-iap', () => mockIap, { virtual: true });

const mockVerify = jest.fn(async (_proof: unknown) => ({
  plan: 'pro',
  effectivePlan: 'pro',
  planActivatedAt: null,
  planExpiresAt: null,
  planLimits: {} as never,
}));
jest.mock('../api/billing', () => ({
  ...jest.requireActual('../api/billing'),
  verifyStorePurchase: (...args: unknown[]) => mockVerify(...(args as [never])),
}));

import { Platform } from 'react-native';
import { purchasePlan, restoreStorePurchases, isCancelled, isStoreBillingSupported } from '../billing/storePurchase';

// jest-expo по умолчанию эмулирует iOS; андроидный путь (первый к выкладке)
// проверяем явно, iOS-ветка получает собственный тест ниже.
const setPlatform = (os: 'android' | 'ios') => {
  Object.defineProperty(Platform, 'OS', { get: () => os, configurable: true });
};

beforeEach(() => {
  jest.clearAllMocks();
  setPlatform('android');
});

describe('покупка тарифа', () => {
  it('несёт серверу purchaseToken и завершает транзакцию ПОСЛЕ проверки', async () => {
    const order: string[] = [];
    mockVerify.mockImplementationOnce(async () => {
      order.push('verify');
      return { plan: 'pro', effectivePlan: 'pro', planActivatedAt: null, planExpiresAt: null, planLimits: {} as never };
    });
    mockIap.finishTransaction.mockImplementationOnce(async () => {
      order.push('finish');
    });

    const result = await purchasePlan('pro');

    expect(result.effectivePlan).toBe('pro');
    expect(mockVerify).toHaveBeenCalledWith({ platform: 'google', purchaseToken: 'tok-42' });
    // Завершить транзакцию до серверной проверки = потерять покупку при сбое.
    expect(order).toEqual(['verify', 'finish']);
    expect(mockIap.endConnection).toHaveBeenCalled();
  });

  it('передаёт offerToken Android-подписке', async () => {
    await purchasePlan('pro');

    expect(mockIap.requestPurchase).toHaveBeenCalledWith(
      expect.objectContaining({
        request: expect.objectContaining({
          google: expect.objectContaining({
            subscriptionOffers: [{ sku: 'avtotime_pro_monthly', offerToken: 'offer-1' }],
          }),
        }),
      }),
    );
  });

  it('отмена пользователем распознаётся и не выглядит ошибкой', async () => {
    mockIap.requestPurchase.mockImplementationOnce(async () => {
      setTimeout(() => mockListeners.error?.({ code: 'user-cancelled', message: 'x' }), 0);
      return null;
    });

    await expect(purchasePlan('pro')).rejects.toMatchObject({ cancelled: true });
    try {
      await purchasePlan('pro');
    } catch (e) {
      // Второй прогон использует обычный мок и успешен — важен первый.
      expect(isCancelled(e)).toBe(false);
    }
    expect(mockVerify).toHaveBeenCalledTimes(1);
  });

  it('если сервер отверг покупку, транзакция НЕ завершается', async () => {
    mockVerify.mockRejectedValueOnce(new Error('Подписка не активна'));

    await expect(purchasePlan('pro')).rejects.toThrow('Подписка не активна');
    // Незавершённая транзакция доиграется «восстановлением» — потери нет.
    expect(mockIap.finishTransaction).not.toHaveBeenCalled();
  });
});

describe('восстановление покупок', () => {
  it('без покупок возвращает null и не ходит на сервер', async () => {
    const result = await restoreStorePurchases();
    expect(result).toBeNull();
    expect(mockVerify).not.toHaveBeenCalled();
  });

  it('берёт самую свежую релевантную покупку', async () => {
    mockIap.getAvailablePurchases.mockResolvedValueOnce([
      { productId: 'avtotime_pro_monthly', purchaseToken: 'old', transactionDate: 1 },
      { productId: 'somebody_else', purchaseToken: 'x', transactionDate: 99 },
      { productId: 'avtotime_business_monthly', purchaseToken: 'newest', transactionDate: 50 },
    ] as never);

    await restoreStorePurchases();

    expect(mockVerify).toHaveBeenCalledWith({ platform: 'google', purchaseToken: 'newest' });
  });
});

describe('поддержка сторовой оплаты', () => {
  it('в тестовой среде модуль-подмена делает её доступной', () => {
    expect(isStoreBillingSupported()).toBe(true);
  });
});

describe('iOS-ветка', () => {
  it('несёт серверу app-чек из getReceiptDataIOS, а не JWS purchaseToken', async () => {
    setPlatform('ios');

    await purchasePlan('pro');

    // В v16 purchase.purchaseToken на iOS — это JWS StoreKit2, verifyReceipt
    // его не понимает; серверу нужен именно app-чек.
    expect(mockIap.getReceiptDataIOS).toHaveBeenCalled();
    expect(mockVerify).toHaveBeenCalledWith({ platform: 'apple', receipt: 'app-receipt' });
  });
});
