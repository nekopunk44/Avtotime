import { useCallback, useSyncExternalStore } from 'react'

const canMatch = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function'

/**
 * Branch on a media query in render instead of hiding a subtree with CSS.
 * Hidden-by-CSS duplicates still mount, which doubles requests and side effects
 * (e.g. two ChatPane recorders), so layout switches must be real conditionals.
 */
export default function useMediaQuery(query) {
    const subscribe = useCallback((onStoreChange) => {
        if (!canMatch()) return () => {}
        const mql = window.matchMedia(query)
        mql.addEventListener('change', onStoreChange)
        return () => mql.removeEventListener('change', onStoreChange)
    }, [query])

    const getSnapshot = useCallback(() => (canMatch() ? window.matchMedia(query).matches : false), [query])

    const getServerSnapshot = useCallback(() => false, [])

    return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
