import { Platform } from 'react-native';
import { PlanKey, StorePlanResult, StorePurchaseProof, verifyStorePurchase } from '../api/billing';

/**
 * Нативные подписки через Google Play / App Store (react-native-iap v16).
 *
 * Библиотека — нативный модуль (v16 ещё и требует nitro-modules): в сборках,
 * сделанных без них, её нет, и обращение бросает «NitroModules could not be
 * found». Поэтому модуль не загружается ни при импорте, ни при рендере — ТОЛЬКО
 * в момент покупки или восстановления. Если загрузить не удалось, вызывающий
 * получает StoreUnavailableError и уводит пользователя на веб-оплату.
 */

// Зеркало PRODUCT_TO_PLAN на бэкенде: эти же строки заводятся в консолях сторов.
export const PLAN_TO_PRODUCT: Record<Exclude<PlanKey, 'free'>, string> = {
  pro: 'avtotime_pro_monthly',
  business: 'avtotime_business_monthly',
};

type Iap = typeof import('react-native-iap');

let iapModule: Iap | null | undefined;

/** Сборка не несёт нативную часть стора — не ошибка пользователя, а сигнал уйти на веб-оплату. */
export class StoreUnavailableError extends Error {
  constructor() {
    super('store-unavailable');
    this.name = 'StoreUnavailableError';
  }
}

const loadIap = (): Iap | null => {
  if (iapModule !== undefined) return iapModule;
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') {
    iapModule = null;
    return null;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('react-native-iap') as Iap;
    // Бросить может не сам require, а первое обращение к нативной части —
    // поэтому трогаем поверхность модуля здесь, внутри try.
    iapModule = typeof mod?.initConnection === 'function' ? mod : null;
  } catch {
    iapModule = null;
  }
  return iapModule;
};

/**
 * Ошибка отсутствующего нативного модуля: наш собственный сигнал либо жалоба
 * самой библиотеки на ненайденный TurboModule/NitroModules.
 */
export const isStoreUnavailable = (error: unknown): boolean => {
  if (error instanceof StoreUnavailableError) return true;
  const message = String((error as Error)?.message || '');
  return /NitroModules|could not be found|TurboModule|Native.?Module/i.test(message);
};

/**
 * Что понесём серверу. Android: purchaseToken. iOS: НЕ purchaseToken — в v16
 * это JWS StoreKit2, а серверный verifyReceipt понимает только app-чек, его
 * отдаёт getReceiptDataIOS().
 */
const buildProof = async (
  iap: Iap,
  purchase: { purchaseToken?: string | null },
): Promise<StorePurchaseProof | null> => {
  if (Platform.OS === 'ios') {
    const receipt = await iap.getReceiptDataIOS();
    return receipt ? { platform: 'apple', receipt } : null;
  }
  return purchase.purchaseToken
    ? { platform: 'google', purchaseToken: purchase.purchaseToken }
    : null;
};

/**
 * Полный цикл: диалог стора → серверная проверка → finishTransaction.
 *
 * finishTransaction — только ПОСЛЕ того, как сервер подтвердил покупку у стора
 * и выдал тариф: незавершённая транзакция переживает крэш и доигрывается
 * «восстановлением», а завершённая до проверки — потеряна.
 */
export const purchasePlan = async (
  plan: Exclude<PlanKey, 'free'>,
  /** Идентификатор от сервера; своя копия — только запасной вариант. */
  productId?: string,
): Promise<StorePlanResult> => {
  const iap = loadIap();
  if (!iap) throw new StoreUnavailableError();

  const sku = productId || PLAN_TO_PRODUCT[plan];
  await iap.initConnection();

  try {
    const products = await iap.fetchProducts({ skus: [sku], type: 'subs' });
    const product = (products || []).find((p) => p.id === sku);
    if (!product) throw new Error('Тариф недоступен в сторе. Попробуйте позже.');

    const purchase = await new Promise<{ purchaseToken?: string | null; productId: string }>(
      (resolve, reject) => {
        const purchaseSub = iap.purchaseUpdatedListener((p) => {
          if (p.productId !== sku) return;
          cleanup();
          resolve(p);
        });
        const errorSub = iap.purchaseErrorListener((e) => {
          cleanup();
          // Отмена пользователем — решение, а не ошибка.
          const cancelled = String(e.code || '').toLowerCase().includes('cancel');
          reject(
            cancelled
              ? Object.assign(new Error('cancelled'), { cancelled: true })
              : new Error(e.message || 'Покупка не прошла'),
          );
        });
        const cleanup = () => {
          purchaseSub.remove();
          errorSub.remove();
        };

        // Android Billing v5+: подписке нужен offerToken из выдачи стора.
        const offers = (
          product as {
            subscriptionOfferDetailsAndroid?: Array<{ offerToken: string; basePlanId?: string }>;
          }
        ).subscriptionOfferDetailsAndroid;
        const offerToken = offers?.[0]?.offerToken;

        iap
          .requestPurchase({
            type: 'subs',
            request: {
              apple: { sku },
              google: {
                skus: [sku],
                ...(offerToken ? { subscriptionOffers: [{ sku, offerToken }] } : {}),
              },
            },
          })
          .catch((e) => {
            cleanup();
            reject(e);
          });
      },
    );

    const proof = await buildProof(iap, purchase);
    if (!proof) throw new Error('Стор не вернул подтверждение покупки');

    const result = await verifyStorePurchase(proof);

    await iap
      .finishTransaction({ purchase: purchase as never, isConsumable: false })
      .catch(() => {});

    return result;
  } finally {
    iap.endConnection().catch(() => {});
  }
};

/**
 * «Восстановить покупки» — обязательный для Apple сценарий: переустановка,
 * новый телефон. Прогоняется через ту же серверную проверку.
 */
export const restoreStorePurchases = async (): Promise<StorePlanResult | null> => {
  const iap = loadIap();
  if (!iap) throw new StoreUnavailableError();

  await iap.initConnection();
  try {
    const purchases = await iap.getAvailablePurchases();
    const relevant = (purchases || []).filter((p) =>
      Object.values(PLAN_TO_PRODUCT).includes(p.productId || ''),
    );
    if (!relevant.length) return null;

    // Достаточно самой свежей: актуальное состояние сервер выяснит у стора сам.
    const newest = relevant.reduce((a, b) =>
      (a.transactionDate || 0) > (b.transactionDate || 0) ? a : b,
    );
    const proof = await buildProof(iap, newest);
    if (!proof) return null;

    return await verifyStorePurchase(proof);
  } finally {
    iap.endConnection().catch(() => {});
  }
};

export const isCancelled = (error: unknown): boolean =>
  Boolean((error as { cancelled?: boolean })?.cancelled) ||
  (error as Error)?.message === 'cancelled';
