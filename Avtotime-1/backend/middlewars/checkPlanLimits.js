import User from '../models/user.model.js'
import MarketCarListing from '../models/marketCarListing.model.js'
import MarketPartListing from '../models/marketPartListing.model.js'
import MarketCarServiceListing from '../models/marketCarServiceListing.model.js'
import MarketAutoTuningListing from '../models/marketAutoTuningListing.model.js'
import MarketConsultationExpert from '../models/marketConsultationExpert.model.js'
import MarketDryCleaningListing from '../models/marketDryCleaningListing.model.js'
import MarketHelpRequest from '../models/marketHelpRequest.model.js'
import { getPlanLimits, getEffectivePlan } from '../config/planLimits.js'

const LISTING_MODELS = {
    cars:           MarketCarListing,
    parts:          MarketPartListing,
    'car-services': MarketCarServiceListing,
    'auto-tuning':  MarketAutoTuningListing,
    consultations:  MarketConsultationExpert,
    'dry-cleaning': MarketDryCleaningListing,
    'help-others':  MarketHelpRequest,
}

/**
 * Проверяет лимиты плана перед созданием объявления.
 * Используется как middleware: checkPlanLimits('cars') или checkPlanLimits('parts')
 */
export const checkPlanLimits = (listingType) => async (req, res, next) => {
    try {
        const user = await User.findById(req.userId).select('plan planExpiresAt').lean()
        if (!user) return res.status(401).json({ message: 'Пользователь не найден' })

        // Если план истёк — откатываемся на free
        const effectivePlan = getEffectivePlan(user.plan, user.planExpiresAt)

        const limits = getPlanLimits(effectivePlan)
        req.planLimits   = limits
        req.effectivePlan = effectivePlan

        // Проверяем лимит количества объявлений
        if (limits.maxListings !== Infinity) {
            const Model = LISTING_MODELS[listingType]
            if (Model) {
                const count = await Model.countDocuments({ author: req.userId })
                if (count >= limits.maxListings) {
                    return res.status(403).json({
                        message: `Ваш план «${effectivePlan}» позволяет максимум ${limits.maxListings} объявлений. Перейдите на Pro или Business для увеличения лимита.`,
                        code: 'PLAN_LISTING_LIMIT',
                        plan: effectivePlan,
                        limit: limits.maxListings,
                    })
                }
            }
        }

        // Проверяем лимит фотографий
        const files = Array.isArray(req.files) ? req.files : []
        if (files.length > limits.maxPhotos) {
            return res.status(403).json({
                message: `Ваш план «${effectivePlan}» позволяет максимум ${limits.maxPhotos} фото. Загружено: ${files.length}.`,
                code: 'PLAN_PHOTO_LIMIT',
                plan: effectivePlan,
                limit: limits.maxPhotos,
            })
        }

        // Проверяем длину описания
        const description = typeof req.body.description === 'string' ? req.body.description : ''
        if (limits.maxDescriptionLen !== Infinity && description.length > limits.maxDescriptionLen) {
            return res.status(403).json({
                message: `Ваш план «${effectivePlan}» позволяет описание до ${limits.maxDescriptionLen} символов.`,
                code: 'PLAN_DESCRIPTION_LIMIT',
                plan: effectivePlan,
                limit: limits.maxDescriptionLen,
            })
        }

        next()
    } catch (err) {
        return res.status(500).json({ message: err.message })
    }
}
