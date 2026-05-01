export const PLAN_LIMITS = {
    free: {
        maxListings:       3,
        maxPhotos:         5,
        maxDescriptionLen: 500,
        listingDays:       30,   // срок активности объявления
        priority:          0,    // позиция в каталоге
        phoneVisible:      false, // телефон скрыт до запроса
        analyticsEnabled:  false,
        videoEnabled:      false,
        badge:             null,
    },
    pro: {
        maxListings:       20,
        maxPhotos:         20,
        maxDescriptionLen: 2000,
        listingDays:       90,
        priority:          1,
        phoneVisible:      true,
        analyticsEnabled:  true,
        videoEnabled:      true,
        badge:             'pro',
    },
    business: {
        maxListings:       Infinity,
        maxPhotos:         40,
        maxDescriptionLen: Infinity,
        listingDays:       null,   // не истекает
        priority:          2,
        phoneVisible:      true,
        analyticsEnabled:  true,
        videoEnabled:      true,
        badge:             'business',
    },
}

export const getPlanLimits = (plan) => PLAN_LIMITS[plan] ?? PLAN_LIMITS.free

// JSON-safe версия лимитов: Infinity → null
export const serializePlanLimits = (limits) => {
    const safe = (v) => (v === Infinity ? null : v)
    return {
        maxListings:       safe(limits.maxListings),
        maxPhotos:         safe(limits.maxPhotos),
        maxDescriptionLen: safe(limits.maxDescriptionLen),
        listingDays:       limits.listingDays,
        priority:          limits.priority,
        phoneVisible:      limits.phoneVisible,
        analyticsEnabled:  limits.analyticsEnabled,
        videoEnabled:      limits.videoEnabled,
        badge:             limits.badge,
    }
}

// Возвращает фактический план с учётом срока: если истёк → free
export const getEffectivePlan = (plan, planExpiresAt) => {
    if (planExpiresAt && new Date(planExpiresAt) < new Date()) return 'free'
    return plan || 'free'
}
