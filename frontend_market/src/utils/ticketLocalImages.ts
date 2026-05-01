export const getTicketQuestionLocalImageUrl = async (
  ticketNumber?: number | null,
  questionNumber?: number | null,
): Promise<string | undefined> => {
  if (!ticketNumber || !questionNumber) return undefined;
  if (!Number.isFinite(ticketNumber) || !Number.isFinite(questionNumber)) return undefined;
  return `/tickets/ticket${ticketNumber}/${questionNumber}.webp`;
};
