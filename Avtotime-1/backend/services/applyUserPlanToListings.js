import MarketCarListing from '../models/marketCarListing.model.js'
import MarketPartListing from '../models/marketPartListing.model.js'
import { getPlanLimits } from '../config/planLimits.js'
import { invalidateMarketListCache } from './marketListCache.js'

/**
 * При смене тарифа применяет новые priority/sellerBadge/expiresAt
 * ко всем активным объявлениям пользователя.
 */
export const applyUserPlanToListings = async (userId, plan) => {
    const limits = getPlanLimits(plan)
    const sellerBadge = limits.badge ?? null
    const priority = limits.priority ?? 0

    const expiresAt = limits.listingDays
        ? new Date(Date.now() + limits.listingDays * 24 * 60 * 60 * 1000)
        : null

    const update = { priority, sellerBadge, expiresAt }

    await Promise.all([
        MarketCarListing.updateMany({ author: userId }, { $set: update }),
        MarketPartListing.updateMany({ author: userId }, { $set: update }),
    ])

    await Promise.all([
        invalidateMarketListCache('cars'),
        invalidateMarketListCache('parts'),
    ])
}
