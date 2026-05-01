export const MARKET_TOAST_EVENT = 'market:toast';
export const MARKET_OPEN_PROFILE_EVENT = 'market:open-profile';

export const showMarketToast = (message: string) => {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(MARKET_TOAST_EVENT, {
      detail: { message },
    }),
  );
};

const normalizeUserName = (nickname?: string) => nickname?.trim().replace(/^@+/, '') ?? '';

export const formatAvtotimeNickname = (nickname?: string) => {
  const normalized = normalizeUserName(nickname);

  return normalized ? `@${normalized}` : '';
};

export const getAvtotimeProfileUrl = (nickname?: string) => {
  const normalized = normalizeUserName(nickname);

  if (!normalized) {
    return '';
  }

  return `/profile/${encodeURIComponent(normalized)}`;
};

export const openAvtotimeProfile = (nickname?: string) => {
  if (typeof window === 'undefined') {
    return;
  }

  const normalized = normalizeUserName(nickname);

  if (!normalized) {
    showMarketToast('В объявлении не указан пользователь.');
    return;
  }

  const event = new CustomEvent(MARKET_OPEN_PROFILE_EVENT, {
    detail: { userName: normalized },
    cancelable: true,
  });

  const wasHandled = window.dispatchEvent(event) === false;

  if (!wasHandled) {
    const profileUrl = getAvtotimeProfileUrl(normalized);
    if (!profileUrl) {
      showMarketToast('Пользователь не найден.');
      return;
    }

    window.location.assign(profileUrl);
  }
};
